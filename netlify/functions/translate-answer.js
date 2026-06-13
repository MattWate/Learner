exports.handler = async function (event) {
    const { GOOGLE_API_KEY } = process.env;

    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 204, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    if (!GOOGLE_API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Server configuration error.' })
        };
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const {
            text,
            html,
            targetLanguage = 'Afrikaans',
            targetLanguageCode = 'af',
            subject = '',
            topic = '',
            grade = '',
            sourceTool = ''
        } = body;

        const sourceText = String(text || '').trim();
        const sourceHtml = String(html || '').trim();

        if (!sourceText && !sourceHtml) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No answer text was provided for translation.' })
            };
        }

        const safeTargetLanguage = String(targetLanguage || 'Afrikaans').trim();
        const safeTargetLanguageCode = String(targetLanguageCode || '').trim();

        const prompt = `Translate the learner-facing answer below into ${safeTargetLanguage}.

Rules:
- Keep the meaning the same.
- Keep it age-appropriate for ${grade || 'a school learner'}.
- Do not add new facts or examples unless they are already implied by the original.
- Preserve headings, bullet points, numbered steps, and simple HTML structure where possible.
- Keep mathematical notation, formulas, units, names, and proper nouns unchanged unless translation is clearly appropriate.
- Use natural, school-friendly ${safeTargetLanguage}.
- Return JSON only with this exact shape:
{
  "translatedText": "plain text version",
  "translatedHtml": "simple HTML version"
}

Context:
Subject: ${subject || 'Not specified'}
Topic: ${topic || 'Not specified'}
Source tool: ${sourceTool || 'Not specified'}
Target language code: ${safeTargetLanguageCode || 'Not specified'}

Original answer as plain text:
${sourceText || '[No plain text supplied]'}

Original answer as HTML:
${sourceHtml || '[No HTML supplied]'}`;

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GOOGLE_API_KEY}`;

        const payload = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: prompt }]
                }
            ],
            generationConfig: {
                responseMimeType: 'application/json',
                temperature: 0.1
            },
            systemInstruction: {
                parts: [
                    {
                        text: 'You are a careful educational translator for LearnerGenie. You translate learner-facing educational content accurately and safely. You do not solve new problems, add new facts, or change the academic meaning. Return valid JSON only.'
                    }
                ]
            }
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const responseBody = await response.json();

        if (!response.ok) {
            throw new Error(responseBody.error?.message || 'Translation API request failed.');
        }

        const modelText = responseBody.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!modelText) {
            throw new Error('The translation model did not return content.');
        }

        let parsed;
        try {
            parsed = JSON.parse(modelText);
        } catch (jsonError) {
            throw new Error('The translation model returned invalid JSON.');
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                translatedText: parsed.translatedText || '',
                translatedHtml: parsed.translatedHtml || parsed.translatedText || '',
                targetLanguage: safeTargetLanguage,
                targetLanguageCode: safeTargetLanguageCode
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message || 'Translation failed.' })
        };
    }
};
