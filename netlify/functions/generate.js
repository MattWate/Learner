// The code for our secure backend function
// This function can now handle text, image generation, and multimodal (text + image) requests.

exports.handler = async function (event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const { requestType, prompt, isJson, imageData } = JSON.parse(event.body);
  const apiKey = process.env.GOOGLE_API_KEY; 

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
        mimeType: 'image/png', // Assuming PNG, can be made more dynamic if needed
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
