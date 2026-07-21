/*
 * LearnerGenie - Explain Simply (standalone page)
 *
 * Real pilot for the full-page-navigation architecture: same behavior as
 * handleGenerateExplanation() in app.html, but as its own page using the
 * shared/learner-*.js modules instead of duplicating that logic.
 *
 * app.html is untouched by this file. This page is reached by full page
 * navigation and expects a ?profile_id= query param, the same convention
 * study-squads.html already uses.
 */
(function () {
    const root = document.getElementById('page-root');

    function pageTemplate(profileName) {
        return `
            <div class="min-h-screen">
                <header class="max-w-4xl mx-auto px-4 pt-6">
                    <a href="${window.LearnerAuth.withProfileId('/app.html')}" class="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-700">
                        <i data-lucide="arrow-left" class="h-4 w-4 mr-1"></i>
                        Back to dashboard
                    </a>
                </header>

                <main class="max-w-4xl mx-auto px-4 py-6">
                    <div class="bg-white p-8 rounded-xl shadow-xl border-t-4 border-indigo-500 print:hidden">
                        <h2 class="text-3xl font-bold text-gray-800 mb-2">Explain It Simply</h2>
                        <p class="text-gray-500 mb-8">Enter a complex topic or question to get a simple explanation${profileName ? ` for ${profileName}` : ''}.</p>
                        <div>
                            <label for="explain-topic" class="block text-sm font-medium text-gray-700 mb-1">What do you want explained?</label>
                            <textarea id="explain-topic" rows="4" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., What is photosynthesis? or Explain black holes"></textarea>
                        </div>
                        <button id="generate-explanation-btn" class="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 flex items-center justify-center disabled:bg-indigo-300">
                            <i data-lucide="sparkles" class="w-5 h-5 mr-2"></i>Explain
                        </button>
                        <div id="es-error" class="text-red-500 text-sm mt-2 hidden"></div>
                    </div>
                    <div id="es-output" class="mt-8"></div>
                </main>
            </div>
        `;
    }

    async function handleGenerateExplanation(profile) {
        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        const topic = document.getElementById('explain-topic').value;
        const errorEl = document.getElementById('es-error');
        const outputEl = document.getElementById('es-output');
        const button = document.getElementById('generate-explanation-btn');

        errorEl.classList.add('hidden');
        if (!topic) {
            errorEl.textContent = 'Please enter a topic or question.';
            errorEl.classList.remove('hidden');
            return;
        }

        button.disabled = true;
        button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div> Explaining...`;
        outputEl.innerHTML = `<div class="text-center text-gray-600"><p>Thinking of a simple explanation...</p></div>`;

        const prompt = `You are a helpful and safe AI assistant for students. Your primary goal is to explain educational topics in an age-appropriate and safe manner. Explain the following topic or question in a simple, easy-to-understand way, as if you were explaining it to a child. Use analogies and simple language. Topic: "${topic}"`;

        try {
            const text = await window.LearnerAPI.fetchWithRetry(prompt, false);

            window.LearnerAuth.supabase.from('saved_work').insert({
                profile_id: profile.id,
                work_type: 'explainSimply',
                input_prompt: { prompt: topic },
                output_content: { explanation: text }
            }).then(({ error }) => {
                if (error) console.error('Error saving work:', error.message);
            });

            const outputHtml = `
                <div class="bg-gray-50/50 p-6 rounded-lg">
                    ${window.LearnerOutput.createSectionHTML('baby', 'amber', 'Here is a simple explanation', text)}
                </div>
            `;

            outputEl.innerHTML = window.LearnerOutput.createTranslatedOutputShell(
                'es-answer-toolbar',
                'es-answer-content',
                outputHtml
            );

            window.LearnerOutput.attachTextTranslationToolbar({
                toolbarId: 'es-answer-toolbar',
                contentId: 'es-answer-content',
                originalHtml: outputHtml,
                sourceTool: 'explainSimply',
                topic
            });

            if (window.lucide?.createIcons) window.lucide.createIcons();
        } catch (e) {
            errorEl.textContent = `An error occurred: ${e.message}`;
            errorEl.classList.remove('hidden');
            outputEl.innerHTML = '';
        } finally {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="sparkles" class="w-5 h-5 mr-2"></i>Explain`;
            if (window.lucide?.createIcons) window.lucide.createIcons();
        }
    }

    async function init() {
        const result = await window.LearnerAuth.requireSessionAndProfile();
        if (!result) return; // requireSessionAndProfile already redirected

        const { profile } = result;

        root.innerHTML = pageTemplate(profile.name);
        if (window.lucide?.createIcons) window.lucide.createIcons();

        document.getElementById('generate-explanation-btn').addEventListener('click', () => {
            handleGenerateExplanation(profile);
        });
    }

    init();
})();
