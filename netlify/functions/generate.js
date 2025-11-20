exports.handler = async function (event) {
    // 1. Get environment variables
    const { GOOGLE_API_KEY } = process.env;

    // 2. Check for POST request
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    // 3. Validate API Key
    if (!GOOGLE_API_KEY) {
        console.error("CRITICAL: GOOGLE_API_KEY environment variable is not set.");
        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Server configuration error.' })
        };
    }
    
    try {
        // 4. Parse the incoming request
        const { requestType, prompt, isJson, imageData } = JSON.parse(event.body);

        // --- Handle Image Generation Request ---
        if (requestType === 'image') {
            const imageUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GOOGLE_API_KEY}`;
            const imagePayload = {
                instances: [{ prompt: prompt }],
                parameters: { "sampleCount": 1 }
            };

            const response = await fetch(imageUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(imagePayload),
            });
            
            const responseBody = await response.json();
            
            if (!response.ok) {
                console.error("Image Generation API Error:", JSON.stringify(responseBody, null, 2));
                throw new Error(`Image API request failed: ${responseBody.error?.message || 'Unknown error'}`);
            }
            
            return { 
                statusCode: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(responseBody)
            };
        }

        // --- Handle Text & Multimodal Requests ---
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
            ...(isJson && { generationConfig: { responseMimeType: 'application/json' } }),
        };

        const response = await fetch(textUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(textPayload),
        });
        
        const responseBody = await response.json();
        
        if (!response.ok) {
            console.error("Text/Multimodal API Error:", JSON.stringify(responseBody, null, 2));
            throw new Error(`Text/Multimodal API request failed: ${responseBody.error?.message || 'Unknown error'}`);
        }
        
        return { 
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(responseBody)
        };

    } catch (error) {
        console.error("Generate Function Error:", error);
        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message || 'Internal Server Error' })
        };
    }
};
