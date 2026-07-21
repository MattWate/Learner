/*
 * LearnerGenie - Learning Hub (standalone page)
 *
 * Same behavior as handleGenerateLearningHelp() in app.html: revision notes,
 * learning objectives, and an AI-marked practice test, with structured
 * (JSON-level) translation so the quiz keeps working after translation.
 */
(function () {
    const root = document.getElementById('page-root');
    let imageUpload;
    let currentTest = [];

    const LEARNING_HUB_TRANSLATION_INSTRUCTIONS = `
Keep the same JSON structure for Learning Hub.
Translate learner-facing text only.
Preserve these keys exactly: learning_objectives, revision_notes, practice_test.
For practice_test, preserve question order, question type, and number of questions.
Translate question text, options, and correct_answer.
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
                    <div class="bg-white p-8 rounded-xl shadow-xl border-t-4 border-indigo-500 print:hidden">
                        <h2 class="text-3xl font-bold text-gray-800 mb-2">Learning Hub</h2>
                        <p class="text-gray-500 mb-8">Describe a topic or upload a photo to get revision notes and a practice test${profileName ? ` for ${profileName}` : ''}.</p>
                        <div class="space-y-6">
                            <div>
                                <label for="learn-topic" class="block text-sm font-medium text-gray-700 mb-1">What do you want to learn about?</label>
                                <textarea id="learn-topic" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., The planets in our solar system"></textarea>
                            </div>
                            <div class="text-center text-sm font-medium text-gray-500">OR</div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Upload a Photo (optional)</label>
                                <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                    <div class="space-y-1 text-center">
                                        <i data-lucide="camera" class="mx-auto h-12 w-12 text-gray-400"></i>
                                        <div class="flex text-sm text-gray-600">
                                            <label for="image-upload" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500"><span>Upload a file</span><input id="image-upload" type="file" class="sr-only" accept="image/*"></label>
                                        </div>
                                    </div>
                                </div>
                                <div id="image-preview-wrapper" class="hidden mt-4">
                                    <img id="image-preview" class="rounded-lg max-h-64 mx-auto" />
                                    <button id="remove-image-btn" class="mt-2 mx-auto flex items-center text-sm text-red-600 hover:text-red-800"><i data-lucide="x" class="h-4 w-4 mr-1"></i>Remove image</button>
                                </div>
                            </div>
                        </div>
                        <button id="generate-learning-help-btn" class="mt-6 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 flex items-center justify-center disabled:bg-indigo-300"><i data-lucide="sparkles" class="w-5 h-5 mr-2"></i>Help Me Learn</button>
                        <div id="lh-error" class="text-red-500 text-sm mt-2 hidden"></div>
                    </div>
                    <div id="lh-output" class="mt-8"></div>
                </main>
            </div>
        `;
    }

    function renderLearningHubContent(content) {
        const safeContent = content || {};
        const practiceTest = safeContent.practice_test || [];

        currentTest = practiceTest;
        const quizHtml = window.LearnerQuiz.renderPracticeTest(currentTest);

        return `
            <div class="bg-gray-50/50 p-6 rounded-lg space-y-6">
                ${window.LearnerOutput.createSectionHTML('check-circle', 'green', 'Key Learning Objectives', safeContent.learning_objectives)}
                ${window.LearnerOutput.createSectionHTML('book-open', 'indigo', 'Revision Notes', safeContent.revision_notes)}

                <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                     <h3 class="text-lg font-semibold text-gray-800 flex items-center mb-3">
                        <i data-lucide="file-check-2" class="text-blue-500"></i>
                        <span class="ml-2">Practice Test</span>
                     </h3>
                     <p class="text-sm text-gray-600 mb-6">Test your knowledge! Check your answers at the end.</p>
                     <div id="quiz-results" class="mb-6"></div>
                     ${quizHtml}
                </div>
            </div>
        `;
    }

    async function handleGenerateLearningHelp(profile) {
        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        const topic = document.getElementById('learn-topic').value;
        const errorEl = document.getElementById('lh-error');
        const outputEl = document.getElementById('lh-output');
        const button = document.getElementById('generate-learning-help-btn');
        const uploadedImageBase64 = imageUpload.getImageBase64();

        errorEl.classList.add('hidden');
        if (!topic && !uploadedImageBase64) {
            errorEl.textContent = 'Please enter a topic or upload a photo.';
            errorEl.classList.remove('hidden');
            return;
        }

        button.disabled = true;
        button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div> Generating...`;
        outputEl.innerHTML = `<div class="text-center text-gray-600"><p>Building your learning guide...</p></div>`;
        currentTest = [];

        const prompt = `You are a helpful and safe AI assistant for students. Your primary goal is to explain educational topics in an age-appropriate and safe manner. Analyze the following topic or image.
Provide a JSON object with three keys: "learning_objectives", "revision_notes", and "practice_test".
- "learning_objectives": A bulleted list of key things a student should know.
- "revision_notes": Detailed and comprehensive notes, broken into key sections.
- "practice_test": An array of 5-7 question objects. Each object must have three keys:
    1. "question": The string of the question text.
    2. "type": A string, either "MCQ" (Multiple Choice), "TrueFalse", or "ShortAnswer".
    3. "options": An array of strings for "MCQ" and "TrueFalse" types. Leave empty [] for "ShortAnswer".
    4. "correct_answer": The string of the correct answer. For "MCQ" and "TrueFalse", this must exactly match one of the strings in the "options" array. For "ShortAnswer", this is the expected answer.
The topic is: ${topic}`;
        const inputPromptForDb = topic || "Learning Hub (Image)";

        try {
            const jsonText = await window.LearnerAPI.fetchWithRetry(prompt, true, 1, 'text', uploadedImageBase64);
            const result = JSON.parse(jsonText);

            window.LearnerAuth.supabase.from('saved_work').insert({
                profile_id: profile.id,
                work_type: 'learningHub',
                input_prompt: { prompt: inputPromptForDb },
                output_content: {
                    learning_objectives: result.learning_objectives,
                    revision_notes: result.revision_notes,
                    practice_test: result.practice_test
                }
            }).then(({ error }) => {
                if (error) console.error('Error saving work:', error.message);
            });

            const originalLearningHubContent = {
                learning_objectives: result.learning_objectives,
                revision_notes: result.revision_notes,
                practice_test: result.practice_test || []
            };

            const outputHtml = renderLearningHubContent(originalLearningHubContent);

            outputEl.innerHTML = window.LearnerOutput.createTranslatedOutputShell(
                'lh-answer-toolbar',
                'lh-answer-content',
                outputHtml
            );

            window.LearnerOutput.attachStructuredTranslationToolbar({
                toolbarId: 'lh-answer-toolbar',
                contentId: 'lh-answer-content',
                originalContent: originalLearningHubContent,
                sourceTool: 'learningHub',
                topic: inputPromptForDb,
                structureInstructions: LEARNING_HUB_TRANSLATION_INSTRUCTIONS,
                renderContent: renderLearningHubContent,
                onRerender: () => window.LearnerQuiz.wireQuizForm(() => currentTest)
            });

            if (window.lucide?.createIcons) window.lucide.createIcons();
            window.LearnerQuiz.wireQuizForm(() => currentTest);
        } catch (e) {
            errorEl.textContent = `An error occurred: ${e.message}`;
            errorEl.classList.remove('hidden');
            outputEl.innerHTML = '';
        } finally {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="sparkles" class="w-5 h-5 mr-2"></i>Help Me Learn`;
            if (window.lucide?.createIcons) window.lucide.createIcons();
        }
    }

    async function init() {
        const result = await window.LearnerAuth.requireSessionAndProfile();
        if (!result) return;

        const { profile } = result;

        root.innerHTML = pageTemplate(profile.name);
        if (window.lucide?.createIcons) window.lucide.createIcons();

        imageUpload = window.LearnerImageUpload.attach();

        document.getElementById('generate-learning-help-btn').addEventListener('click', () => {
            handleGenerateLearningHelp(profile);
        });
    }

    init();
})();
