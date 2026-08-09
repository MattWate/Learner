/* LearnerGenie - shared API module */
(function () {
    if (!window.LearnerAuth) { console.error('LearnerAPI: LearnerAuth not found.'); return; }

    function contextualPrompt(prompt) {
        const context = window.LearnerRegion?.buildPromptContext?.();
        if (!context) return prompt;
        return `${prompt}${context}`;
    }

    async function fetchWithRetry(prompt, isJson, retries = 1, requestType = 'text', imageData = null) {
        try {
            const { data: { session }, error: sessionError } = await window.LearnerAuth.supabase.auth.getSession();
            if (sessionError || !session) throw new Error('Your session has expired. Please log in again.');
            const finalPrompt = requestType === 'image' ? prompt : contextualPrompt(prompt);
            const response = await fetch('/api/generate', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: finalPrompt, isJson, requestType, imageData })
            });
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text(); console.error('Non-JSON Response:', text.substring(0,100)+'...');
                throw new Error('Server Error: The AI service is currently unavailable.');
            }
            if (!response.ok) { const errorBody = await response.json(); throw new Error(errorBody.error || errorBody.message || `API request failed with status ${response.status}`); }
            const result = await response.json();
            if (requestType === 'image') {
                if (!result.predictions?.[0]?.bytesBase64Encoded) throw new Error('Image generation failed.');
                return `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
            }
            const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('The AI returned an empty response.');
            return text;
        } catch (error) {
            if (retries > 0 && !String(error).includes('session') && !String(error).includes('Server Error')) {
                console.warn('Request failed, retrying...', error); await new Promise(resolve=>setTimeout(resolve,1000));
                return fetchWithRetry(prompt,isJson,retries-1,requestType,imageData);
            }
            throw error;
        }
    }
    window.LearnerAPI = { fetchWithRetry, contextualPrompt };
})();