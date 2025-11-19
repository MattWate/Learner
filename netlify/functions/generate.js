// Fixed netlify/functions/generate.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async function (event) {
    // 1. Get environment variables
    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        GOOGLE_API_KEY
    } = process.env;

    // 2. Check for POST request
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }
    
    // 3. AUTHENTICATE THE USER (FIXED)
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            throw new Error('CRITICAL: Supabase keys are missing for authentication.');
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        
        const authHeader = event.headers.authorization || event.headers.Authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('Auth Error: Missing or malformed Authorization header');
            return { 
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'You must be logged in.' })
            };
        }
        
        const token = authHeader.replace('Bearer ', '');
        
        // CRITICAL FIX: Proper JWT validation
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        
        if (authError || !user) {
            console.error('JWT Verification Failed:', authError?.message);
            return { 
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid or expired session.' })
            };
        }
        
        console.log('User authenticated:', user.id);

    } catch (error) {
        console.error("Generate Function Auth Error:", error.message);
        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Server initialization error.' })
        };
    }
    
    const { requestType, prompt, isJson, imageData } = JSON.parse(event.body);
    const apiKey = GOOGLE_API_KEY; 

    if (!apiKey) {
        console.error("CRITICAL: GOOGLE_API_KEY environment variable is not set.");
        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'API key is not set on the server.' })
        };
    }

    // --- Handle Image Generation Request ---
    if (requestType === 'image') {
        const imageUrl = `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${apiKey}`;
        const imagePayload = {
            instances: [{ prompt: prompt }],
            parameters: { "sampleCount": 1 }
        };
        try {
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
        } catch (error) {
            console.error("Image Generation Exception:", error);
            return { 
                statusCode: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: error.message })
            };
        }
    }

    // --- Handle Text & Multimodal Requests ---
    const textUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    
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

    try {
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
        console.error("Text Generation Exception:", error);
        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message })
        };
    }
};
