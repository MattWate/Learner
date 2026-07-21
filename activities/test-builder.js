/*
 * LearnerGenie - Test Builder (standalone page)
 *
 * Same behavior as handleGenerateTestBuilder() in app.html: custom practice
 * test by topic, question count, and question types, with structured
 * translation support.
 */
(function () {
    const root = document.getElementById('page-root');
    let currentTest = [];

    const TEST_BUILDER_TRANSLATION_INSTRUCTIONS = `
Keep the same JSON structure for Test Builder.
Preserve the practice_test array.
Preserve question order, question type, and number of questions.
Translate learner-facing text only: question, options, and correct_answer.
For MCQ and TrueFalse questions, correct_answer must exactly match one translated option.
Do not add new questions.
Do not remove questions.
Keep mathematical notation unchanged.
Return valid JSON only.
    `.trim();

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
                    <div class="bg-white p-8 rounded-xl shadow-xl border-t-4 border-teal-500 print:hidden">
                        <h2 class="text-3xl font-bold text-gray-800 mb-2">Test Builder</h2>
                        <p class="text-gray-500 mb-8">Create a custom practice test on any topic${profileName ? ` for ${profileName}` : ''}.</p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                            <div class="md:col-span-2">
                                <label for="tb-topic" class="block text-sm font-medium text-gray-700 mb-1">Topic</label>
                                <textarea id="tb-topic" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., World War 2 Key Battles"></textarea>
                            </div>
                            <div>
                                <label for="tb-num-questions" class="block text-sm font-medium text-gray-700 mb-1">Number of Questions</label>
                                <select id="tb-num-questions" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 bg-white">
                                    <option value="10" selected>10</option>
                                    <option value="20">20</option>
                                    <option value="30">30</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Question Types</label>
                                <div class="space-y-2 mt-2">
                                    <label class="flex items-center"><input type="checkbox" id="tb-qt-mcq" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" checked> <span class="ml-2 text-sm text-gray-700">Multiple Choice</span></label>
                                    <label class="flex items-center"><input type="checkbox" id="tb-qt-tf" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" checked> <span class="ml-2 text-sm text-gray-700">True/False</span></label>
                                    <label class="flex items-center"><input type="checkbox" id="tb-qt-short" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" checked> <span class="ml-2 text-sm text-gray-700">Short Answer</span></label>
                                </div>
                            </div>
                        </div>
                        <button id="generate-test-builder-btn" class="w-full bg-teal-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-teal-700 transition-all duration-300 flex items-center justify-center disabled:bg-teal-300 mb-8"><i data-lucide="sparkles" class="w-5 h-5 mr-2"></i>Generate Test</button>
                        <div id="tb-error" class="text-red-500 text-sm mt-2 mb-6 hidden"></div>
                    </div>
                    <div id="tb-output" class="mt-8">
                         <div class="text-center p-12 bg-white rounded-xl shadow-lg border-t-4 border-gray-200">
                            <i data-lucide="lightbulb" class="mx-auto h-16 w-16 text-gray-300"></i>
                            <h3 class="mt-4 text-lg font-semibold text-gray-700">Your test will appear here.</h3>
                            <p class="mt-1 text-gray-500">Fill out the form above to create a practice test.</p>
                        </div>
                    </div>
                </main>
            </div>
        `;
    }

    function renderTestBuilderContent(testData) {
        currentTest = testData || [];
        const quizHtml = window.LearnerQuiz.renderPracticeTest(currentTest);

        return `
            <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                 <h3 class="text-lg font-semibold text-gray-800 flex items-center mb-3">
                    <i data-lucide="clipboard-check" class="text-teal-500"></i>
                    <span class="ml-2">Your Custom Test</span>
                 </h3>
                 <p class="text-sm text-gray-600 mb-6">Test your knowledge! Check your answers at the end.</p>
                 <div id="quiz-results" class="mb-6"></div>
                 ${quizHtml}
            </div>
        `;
    }

    async function handleGenerateTestBuilder(profile) {
        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        const topic = document.getElementById('tb-topic').value;
        const numQuestions = document.getElementById('tb-num-questions').value;
        const errorEl = document.getElementById('tb-error');
        const outputEl = document.getElementById('tb-output');
        const button = document.getElementById('generate-test-builder-btn');

        const questionTypes = [];
        if (document.getElementById('tb-qt-mcq').checked) questionTypes.push('MCQ');
        if (document.getElementById('tb-qt-tf').checked) questionTypes.push('TrueFalse');
        if (document.getElementById('tb-qt-short').checked) questionTypes.push('ShortAnswer');

        errorEl.classList.add('hidden');
        if (!topic || questionTypes.length === 0) {
            errorEl.textContent = 'Please provide a topic and select at least one question type.';
            errorEl.classList.remove('hidden');
            return;
        }

        button.disabled = true;
        button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div> Generating...`;
        outputEl.innerHTML = `<div class="text-center text-gray-600"><p>Building your practice test...</p></div>`;
        currentTest = [];

        const prompt = `You are an AI test generator. Create a practice test based on the following parameters.
Provide a JSON object with a single key: "practice_test".
- "practice_test": An array of exactly ${numQuestions} question objects. Each object must have three keys:
    1. "question": The string of the question text.
    2. "type": A string, must be one of the selected types: ${questionTypes.join(', ')}. Try to include a mix if multiple types are selected.
    3. "options": An array of strings for "MCQ" and "TrueFalse" types. Leave empty [] for "ShortAnswer".
    4. "correct_answer": The string of the correct answer. For "MCQ" and "TrueFalse", this must exactly match one of the strings in the "options" array. For "ShortAnswer", this is the expected answer.
The topic for the test is: ${topic}`;

        try {
            const jsonText = await window.LearnerAPI.fetchWithRetry(prompt, true);
            const result = JSON.parse(jsonText);

            window.LearnerAuth.supabase.from('saved_work').insert({
                profile_id: profile.id,
                work_type: 'testBuilder',
                input_prompt: { prompt: topic },
                output_content: result
            }).then(({ error }) => {
                if (error) console.error('Error saving work:', error.message);
            });

            const originalTestBuilderContent = {
                practice_test: result.practice_test || []
            };

            const outputHtml = renderTestBuilderContent(originalTestBuilderContent.practice_test);

            outputEl.innerHTML = window.LearnerOutput.createTranslatedOutputShell(
                'tb-answer-toolbar',
                'tb-answer-content',
                outputHtml
            );

            window.LearnerOutput.attachStructuredTranslationToolbar({
                toolbarId: 'tb-answer-toolbar',
                contentId: 'tb-answer-content',
                originalContent: originalTestBuilderContent,
                sourceTool: 'testBuilder',
                topic,
                structureInstructions: TEST_BUILDER_TRANSLATION_INSTRUCTIONS,
                renderContent: (content) => renderTestBuilderContent(content?.practice_test || []),
                onRerender: () => window.LearnerQuiz.wireQuizForm(() => currentTest)
            });

            if (window.lucide?.createIcons) window.lucide.createIcons();
            window.LearnerQuiz.wireQuizForm(() => currentTest);

        } catch (e) {
            errorEl.textContent = `An error occurred: ${e.message}`;
            errorEl.classList.remove('hidden');
            outputEl.innerHTML = '<div class="text-center text-red-600"><p>Could not generate test. Please try again.</p></div>';
        } finally {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="sparkles" class="w-5 h-5 mr-2"></i>Generate Test`;
            if (window.lucide?.createIcons) window.lucide.createIcons();
        }
    }

    async function init() {
        const result = await window.LearnerAuth.requireSessionAndProfile();
        if (!result) return;

        const { profile } = result;

        root.innerHTML = pageTemplate(profile.name);
        if (window.lucide?.createIcons) window.lucide.createIcons();

        document.getElementById('generate-test-builder-btn').addEventListener('click', () => {
            handleGenerateTestBuilder(profile);
        });
    }

    init();
})();
