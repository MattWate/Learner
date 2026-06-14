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

    function safeJsonParse(value) {
        if (!value) return null;

        let cleanValue = String(value).trim();

        if (cleanValue.startsWith('```')) {
            cleanValue = cleanValue
                .replace(/^```json\s*/i, '')
                .replace(/^```\s*/i, '')
                .replace(/```$/i, '')
                .trim();
        }

        return JSON.parse(cleanValue);
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function plainTextToHtml(value) {
        const text = String(value || '').trim();
        if (!text) return '';

        return text
            .split(/\n{2,}/)
            .map(block => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
            .join('\n');
    }

    function buildPlainTextPrompt({
        sourceText,
        safeTargetLanguage,
        safeTargetLanguageCode,
        subject,
        topic,
        grade,
        sourceTool
    }) {
        return `Translate the learner-facing answer below into ${safeTargetLanguage}.

Rules:
- Keep the meaning the same.
- Keep it age-appropriate for ${grade || 'a school learner'}.
- Do not add new facts or examples unless they are already implied by the original.
- Preserve headings, bullet points, numbered steps, line breaks, and paragraph breaks where possible.
- Keep mathematical notation, formulas, units, names, and proper nouns unchanged unless translation is clearly appropriate.
- Use natural, school-friendly ${safeTargetLanguage}.
- Return JSON only with this exact shape:
{
  "translatedText": "translated plain text"
}

Context:
Subject: ${subject || 'Not specified'}
Topic: ${topic || 'Not specified'}
Source tool: ${sourceTool || 'Not specified'}
Target language code: ${safeTargetLanguageCode || 'Not specified'}

Original answer:
${sourceText || '[No plain text supplied]'}`;
    }

    function buildStructuredPrompt({
        structuredContent,
        safeTargetLanguage,
        safeTargetLanguageCode,
        subject,
        topic,
        grade,
        sourceTool,
        structureInstructions
    }) {
        return `Translate the structured LearnerGenie output below into ${safeTargetLanguage}.

This is a structured educational object, not a web page. Translate the learner-facing values inside the object, then return the same object structure.

Rules:
- Return valid JSON only.
- Return JSON with this exact shape:
{
  "translatedContent": { "same structure as the original object" },
  "translatedText": "plain text summary of the translated learner-facing content",
  "translatedHtml": "simple HTML summary of the translated learner-facing content"
}
- Do not change object keys.
- Do not remove fields.
- Do not add new questions, answers, sections, facts, or examples.
- Preserve arrays and item order.
- Preserve IDs, database IDs, flags, booleans, numbers, dates, URLs, image paths, and internal metadata exactly.
- Translate learner-facing strings only.
- Keep mathematical notation, formulas, units, code, equations, and variable names unchanged unless translation is clearly required.
- For multiple-choice questions, translate the question and options, and make sure correct_answer exactly matches the translated correct option.
- For true/false questions, translate the visible options and correct_answer consistently. The correct_answer must exactly match one of the translated options when options exist.
- For short-answer or memo fields, translate the expected answer or memo without changing the academic meaning.
- Keep the level age-appropriate for ${grade || 'a school learner'}.
- Use natural, school-friendly ${safeTargetLanguage}.
${structureInstructions ? `\nExtra structure instructions:\n${structureInstructions}\n` : ''}

Context:
Subject: ${subject || 'Not specified'}
Topic: ${topic || 'Not specified'}
Source tool: ${sourceTool || 'Not specified'}
Target language code: ${safeTargetLanguageCode || 'Not specified'}

Original structured content:
${JSON.stringify(structuredContent, null, 2)}`;
    }

    try {
        const body = JSON.parse(event.body || '{}');
        const {
            text,
            targetLanguage = 'Afrikaans',
            targetLanguageCode = 'af',
            subject = '',
            topic = '',
            grade = '',
            sourceTool = '',
            structuredContent = null,
            structureInstructions = ''
        } = body;

        const mode = String(body.mode || body.translationMode || (structuredContent ? 'structured' : 'text')).trim();
        const sourceText = String(text || '').trim();
        const safeTargetLanguage = String(targetLanguage || 'Afrikaans').trim();
        const safeTargetLanguageCode = String(targetLanguageCode || '').trim();
        const isStructured = mode === 'structured';

        if (isStructured && (!structuredContent || typeof structuredContent !== 'object')) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No structured content was provided for translation.' })
            };
        }

        if (!isStructured && !sourceText) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'No answer text was provided for translation.' })
            };
        }

        const prompt = isStructured
            ? buildStructuredPrompt({
                structuredContent,
                safeTargetLanguage,
                safeTargetLanguageCode,
                subject,
                topic,
                grade,
                sourceTool,
                structureInstructions
            })
            : buildPlainTextPrompt({
                sourceText,
                safeTargetLanguage,
                safeTargetLanguageCode,
                subject,
                topic,
                grade,
                sourceTool
            });

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
                        text: 'You are a careful educational translator for LearnerGenie. You translate learner-facing educational content accurately and safely. You do not solve new problems, add new facts, change quiz logic, or change the academic meaning. Return valid JSON only.'
                    }
                ]
            }
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 22000);

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        clearTimeout(timeout);

        let responseBody;
        try {
            responseBody = await response.json();
        } catch (parseError) {
            throw new Error('Translation API returned an unreadable response.');
        }

        if (!response.ok) {
            throw new Error(responseBody.error?.message || 'Translation API request failed.');
        }

        const modelText = responseBody.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!modelText) {
            throw new Error('The translation model did not return content.');
        }

        let parsed;
        try {
            parsed = safeJsonParse(modelText);
        } catch (jsonError) {
            throw new Error('The translation model returned invalid JSON.');
        }

        if (isStructured && (!parsed || !parsed.translatedContent || typeof parsed.translatedContent !== 'object')) {
            throw new Error('The translation model did not return translated structured content.');
        }

        const translatedText = parsed.translatedText || '';
        const translatedHtml = isStructured
            ? (parsed.translatedHtml || translatedText || '')
            : plainTextToHtml(translatedText);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                mode: isStructured ? 'structured' : 'text',
                translatedText,
                translatedHtml,
                translatedContent: isStructured ? parsed.translatedContent : undefined,
                targetLanguage: safeTargetLanguage,
                targetLanguageCode: safeTargetLanguageCode
            })
        };
    } catch (error) {
        const isAbort = error?.name === 'AbortError';
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: isAbort
                    ? 'Translation took too long. Please try a shorter answer or try again.'
                    : (error.message || 'Translation failed.')
            })
        };
    }
};