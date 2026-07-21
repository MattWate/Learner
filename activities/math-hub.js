/*
 * LearnerGenie - Mathematics Hub (standalone page)
 *
 * Same behavior as handleGenerateMathHelp() in app.html: UK/SA curriculum
 * math tutoring with step-by-step solution and practice problems.
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
                        <h2 class="text-3xl font-bold text-gray-800 mb-2">Mathematics Hub</h2>
                        <p class="text-gray-500 mb-8">Enter a math problem or topic to get a step-by-step breakdown and practice examples${profileName ? ` for ${profileName}` : ''}.</p>
                        <div class="space-y-6">
                            <div>
                                <label for="math-input" class="block text-sm font-medium text-gray-700 mb-1">What are we solving today?</label>
                                <div class="flex flex-wrap gap-2 mb-2">
                                    <button type="button" onclick="document.getElementById('math-input').value += ' + '" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm font-bold">+</button>
                                    <button type="button" onclick="document.getElementById('math-input').value += ' - '" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm font-bold">-</button>
                                    <button type="button" onclick="document.getElementById('math-input').value += ' x '" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm font-bold">x</button>
                                    <button type="button" onclick="document.getElementById('math-input').value += ' ÷ '" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm font-bold">÷</button>
                                    <button type="button" onclick="document.getElementById('math-input').value += ' = '" class="px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 text-sm font-bold">=</button>
                                    <button type="button" onclick="document.getElementById('math-input').value += 'x'" class="px-3 py-1 bg-indigo-50 text-indigo-700 rounded hover:bg-indigo-100 text-sm font-bold italic">x</button>
                                    <button type="button" onclick="document.getElementById('math-input').value = ''" class="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-sm font-medium ml-auto">Clear</button>
                                </div>
                                <textarea id="math-input" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., Solve for x: 2x + 5 = 15 or Explain long division"></textarea>
                            </div>
                        </div>
                        <button id="generate-math-help-btn" class="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 flex items-center justify-center disabled:bg-indigo-300">
                            <i data-lucide="calculator" class="w-5 h-5 mr-2"></i> Solve & Explain
                        </button>
                        <div id="math-error" class="text-red-500 text-sm mt-2 hidden"></div>
                    </div>
                    <div id="math-output" class="mt-8"></div>
                </main>
            </div>
        `;
    }

    async function handleGenerateMathHelp(profile) {
        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        const mathProblem = document.getElementById('math-input').value.trim();
        const errorEl = document.getElementById('math-error');
        const outputEl = document.getElementById('math-output');
        const button = document.getElementById('generate-math-help-btn');

        errorEl.classList.add('hidden');
        if (!mathProblem) {
            errorEl.textContent = 'Please enter a math problem or topic.';
            errorEl.classList.remove('hidden');
            return;
        }

        button.disabled = true;
        button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div> Verifying Accuracy...`;
        outputEl.innerHTML = `<div class="text-center text-gray-600"><p>Calculating precisely...</p></div>`;

        const prompt = `You are an expert math tutor for students in South Africa and the UK. 
Analyze the following math problem or topic: "${mathProblem}".

IMPORTANT RULES:
1. Use UK/South African English spelling and terminology (e.g., "brackets", "indices", "gradient").
2. Follow standard pedagogical methods used in the UK/SA curriculum.
3. If the problem involves basic arithmetic, apply BODMAS (Brackets, Orders, Division, Multiplication, Addition, Subtraction).
4. If the problem involves Algebra, Trigonometry, or Geometry, use the appropriate logical steps for those subjects while maintaining UK/SA naming conventions.
5. In the "Now You Try!" section, ensure all practice problems are written with clear mathematical operators.

Provide a JSON object with these keys:
- "explanation": A simple introduction to the concept or topic.
- "steps": An array of strings with numbered, step-by-step instructions showing the logical path to the solution.
- "final_answer": The definitive result.
- "practice_problems": An array of 2 similar practice problems for the student to solve next.`;

        try {
            const jsonText = await window.LearnerAPI.fetchWithRetry(prompt, true);
            const result = JSON.parse(jsonText);

            window.LearnerAuth.supabase.from('saved_work').insert({
                profile_id: profile.id,
                work_type: 'mathHub',
                input_prompt: { prompt: mathProblem },
                output_content: result
            }).then(({ error }) => {
                if (error) console.error('Error saving work:', error.message);
            });

            const outputHtml = `
                <div class="bg-gray-50/50 p-6 rounded-lg space-y-6">
                    ${window.LearnerOutput.createSectionHTML('info', 'blue', 'Understanding the Concept', result.explanation)}
                    ${window.LearnerOutput.createSectionHTML('list', 'indigo', 'Step-by-Step Solution', result.steps)}
                    ${window.LearnerOutput.createSectionHTML('check-circle', 'green', 'Final Answer', result.final_answer)}

                    <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 class="text-lg font-semibold text-gray-800 flex items-center mb-3">
                            <i data-lucide="edit-3" class="text-amber-500"></i>
                            <span class="ml-2">Now You Try!</span>
                        </h3>
                        <div class="space-y-2">
                            ${result.practice_problems.map(prob => `
                                <button onclick="document.getElementById('math-input').value = '${prob.replace(/'/g, "\\'")}'; window.scrollTo({top: 0, behavior: 'smooth'});" 
                                        class="w-full text-left p-3 rounded-lg border border-dashed border-amber-200 hover:bg-amber-50 text-amber-900 transition-colors flex justify-between items-center group">
                                    <span>${prob}</span>
                                    <span class="text-xs font-medium text-amber-500 opacity-0 group-hover:opacity-100 transition-opacity">Solve this one →</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;

            outputEl.innerHTML = window.LearnerOutput.createTranslatedOutputShell(
                'math-answer-toolbar',
                'math-answer-content',
                outputHtml
            );

            window.LearnerOutput.attachTextTranslationToolbar({
                toolbarId: 'math-answer-toolbar',
                contentId: 'math-answer-content',
                originalHtml: outputHtml,
                sourceTool: 'mathHub',
                topic: mathProblem
            });

            if (window.lucide?.createIcons) window.lucide.createIcons();
        } catch (e) {
            errorEl.textContent = `An error occurred: ${e.message}`;
            errorEl.classList.remove('hidden');
            outputEl.innerHTML = '';
        } finally {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="calculator" class="w-5 h-5 mr-2"></i> Solve & Explain`;
            if (window.lucide?.createIcons) window.lucide.createIcons();
        }
    }

    async function init() {
        const result = await window.LearnerAuth.requireSessionAndProfile();
        if (!result) return;

        const { profile } = result;

        root.innerHTML = pageTemplate(profile.name);
        if (window.lucide?.createIcons) window.lucide.createIcons();

        document.getElementById('generate-math-help-btn').addEventListener('click', () => {
            handleGenerateMathHelp(profile);
        });
    }

    init();
})();
