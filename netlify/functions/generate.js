exports.handler = async function (event) {
    const { GOOGLE_API_KEY } = process.env;

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    if (!GOOGLE_API_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error.' }) };
    }
    
    try {
        const { requestType, prompt, isJson, imageData } = JSON.parse(event.body);

        const textUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`;
        
        const parts = [{ text: prompt }];
        if (imageData) {
            parts.push({
                inlineData: {
                    mimeType: 'image/png', 
                    data: imageData,
                },
            });
        }

        const textPayload = {
            contents: [{ role: 'user', parts: parts }],
            generationConfig: {
                ...(isJson && { responseMimeType: 'application/json' }),
                temperature: 0.1, // Reduced temperature for more reliable grading
            },
            systemInstruction: {
                parts: [{ text: "You are an expert pedagogical assistant and objective grader. When evaluating student answers, prioritize semantic meaning over exact matches. Accept answers that are factually correct even if phrased differently or contain minor spelling errors. If the prompt asks for a grade, always return a JSON object with 'isCorrect' (boolean) and 'feedback' (string) keys." }]
            }
        };

        const response = await fetch(textUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(textPayload),
        });
        
        const responseBody = await response.json();
        
        if (!response.ok) {
            throw new Error(`API Error: ${responseBody.error?.message || 'Unknown'}`);
        }
        
        return { 
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responseBody)
        };

    } catch (error) {
        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
