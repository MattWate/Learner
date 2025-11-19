// Drop-in Replacement for netlify/functions/generate.js
const { createClient } = require('@supabase/supabase-js');
// The explicit require('node-fetch') is REMOVED to stabilize the function runtime.

// Helper function to validate the Supabase JWT
async function getUserFromSupabaseToken(supabaseAdmin, authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return { userId: null, userEmail: null, error: 'Missing or invalid Authorization header.' };
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userResponse, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !userResponse.user) { 
        return { userId: null, userEmail: null, error: `Token validation failed: ${authError?.message || 'User object is empty.'}` };
    }
    return { userId: userResponse.user.id, userEmail: userResponse.user.email, error: null };
}

exports.handler = async function (event) {
    // 1. Get environment variables
    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        GOOGLE_API_KEY
    } = process.env;

    // 2. Check for POST request
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    
    // 3. CRITICAL: AUTHENTICATE THE USER
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
             throw new Error('CRITICAL: Supabase keys are missing for authentication.');
        }

        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const authHeader = event.headers.authorization;
        
        const authResult = await getUserFromSupabaseToken(supabaseAdmin, authHeader);
        if (authResult.error) {
             return { statusCode: 401, body: JSON.stringify({ error: authResult.error }) };
        }
        // User is authenticated, proceed.

    } catch (error) {
        console.error("Generate Function Auth/Setup Error:", error.message);
        return { statusCode: 500, body: JSON.stringify({ error: 'Server initialization error.' }) };
    }
    
    const { requestType, prompt, isJson, imageData } = JSON.parse(event.body);
    const apiKey = GOOGLE_API_KEY; 

    if (!apiKey) {
        console.error("CRITICAL: GOOGLE_API_KEY environment variable is not set.");
        return { statusCode: 500, body: JSON.stringify({ error: 'API key is not set on the server.' }) };
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
            // ... (rest of image logic)
            const responseBody = await response.json();
            if (!response.ok) {
                console.error("Image Generation API Error:", JSON.stringify(responseBody, null, 2));
                throw new Error(`Image API request failed: ${responseBody.error?.message || 'Unknown error'}`);
            }
            return { statusCode: 200, body: JSON.stringify(responseBody) };
        } catch (error) {
            console.error("Caught Image Generation Exception:", error);
            return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
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
        return { statusCode: 200, body: JSON.stringify(responseBody) };
    } catch (error) {
        console.error("Caught Text/Multimodal Generation Exception:", error);
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
