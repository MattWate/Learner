/*
 * LearnerGenie - Homework Helper (standalone page)
 *
 * Same behavior as handleGenerateHomeworkHelp() in app.html: typed question
 * OR worksheet photo (not both), JSON response with hints/answer(s).
 */
(function () {
    const root = document.getElementById('page-root');
    let imageUpload;

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
                        <h2 class="text-3xl font-bold text-gray-800 mb-2">Homework Helper</h2>
                        <p class="text-gray-500 mb-8">Type your question or upload a photo of your worksheet to get started${profileName ? ` for ${profileName}` : ''}.</p>
                        <div class="space-y-6">
                            <div>
                                <label for="hh-question" class="block text-sm font-medium text-gray-700 mb-1">Enter your question</label>
                                <textarea id="hh-question" rows="3" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g., What was the main cause of the French Revolution?"></textarea>
                            </div>
                            <div class="text-center text-sm font-medium text-gray-500">OR</div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Upload Worksheet Photo</label>
                                <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                                    <div class="space-y-1 text-center">
                                        <i data-lucide="camera" class="mx-auto h-12 w-12 text-gray-400"></i>
                                        <div class="flex text-sm text-gray-600">
                                            <label for="image-upload" class="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500"><span>Upload a file</span><input id="image-upload" type="file" class="sr-only" accept="image/*"></label>
                                        </div>
                                        <p class="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                                    </div>
                                </div>
                                <div id="image-preview-wrapper" class="hidden mt-4">
                                    <img id="image-preview" class="rounded-lg max-h-64 mx-auto" />
                                    <button id="remove-image-btn" class="mt-2 mx-auto flex items-center text-sm text-red-600 hover:text-red-800"><i data-lucide="x" class="h-4 w-4 mr-1"></i>Remove image</button>
                                </div>
                            </div>
                        </div>
                        <button id="generate-homework-help-btn" class="mt-8 w-full bg-indigo-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-indigo-700 flex items-center justify-center disabled:bg-indigo-300"><i data-lucide="sparkles" class="w-5 h-5 mr-2"></i>Get Help</button>
                        <div id="hh-error" class="text-red-500 text-sm mt-2 hidden"></div>
                    </div>
                    <div id="hh-output" class="mt-8"></div>
                </main>
            </div>
        `;
    }

    async function handleGenerateHomeworkHelp(profile) {
        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        const questionText = document.getElementById('hh-question').value.trim();
        const errorEl = document.getElementById('hh-error');
        const outputEl = document.getElementById('hh-output');
        const button = document.getElementById('generate-homework-help-btn');
        const uploadedImageBase64 = imageUpload.getImageBase64();

        errorEl.classList.add('hidden');
        if (!questionText && !uploadedImageBase64) {
            errorEl.textContent = 'Please enter a question or upload a photo of your worksheet.';
            errorEl.classList.remove('hidden');
            return;
        }
        if (questionText && uploadedImageBase64) {
            errorEl.textContent = 'Please provide either a typed question OR an uploaded image, not both.';
            errorEl.classList.remove('hidden');
            return;
        }

        button.disabled = true;
        button.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div> Analyzing...`;
        outputEl.innerHTML = `<div class="text-center text-gray-600"><p>Thinking...</p></div>`;

        let prompt = '';
        let imageData = uploadedImageBase64;
        let inputPromptForDb = questionText;

        if (questionText) {
            prompt = `You are a helpful and safe AI assistant for students. Your primary goal is to explain educational topics in an age-appropriate and safe manner. The user asked the following question: "${questionText}". 
Provide a JSON object with two keys: "hints" and "answer". 
- "hints": An array of gentle hints to guide the student towards the answer.
- "answer": A clear and concise final answer to the question.`;
            imageData = null;
        } else if (imageData) {
            prompt = `You are a helpful and safe AI assistant for students. Your primary goal is to explain educational topics in an age-appropriate and safe manner. Analyze the uploaded worksheet image. Provide a JSON object with three keys: "breakdown", "hints", and "answers". "breakdown" should be a simple, bullet-pointed summary of the instructions. "hints" should be an array of gentle hints for each question to guide the student. "answers" should be an array with the final answers to check against.`;
            inputPromptForDb = "Homework Help (Image)";
        }

        try {
            const jsonText = await window.LearnerAPI.fetchWithRetry(prompt, true, 1, 'text', imageData);
            const result = JSON.parse(jsonText);

            window.LearnerAuth.supabase.from('saved_work').insert({
                profile_id: profile.id,
                work_type: 'homeworkHelper',
                input_prompt: { prompt: inputPromptForDb },
                output_content: result
            }).then(({ error }) => {
                if (error) console.error('Error saving work:', error.message);
            });

            let outputHtml = '<div class="bg-gray-50/50 p-6 rounded-lg space-y-6">';
            if (result.breakdown) {
                outputHtml += window.LearnerOutput.createSectionHTML('list-checks', 'blue', "Let's Break It Down", result.breakdown);
            }
            if (result.hints) {
                outputHtml += window.LearnerOutput.createSectionHTML('lightbulb', 'yellow', 'Helpful Hints', result.hints);
            }
            if (result.answer) {
                outputHtml += window.LearnerOutput.createSectionHTML('key-round', 'green', 'Answer', result.answer);
            } else if (result.answers) {
                outputHtml += window.LearnerOutput.createSectionHTML('key-round', 'green', 'Check Your Work', result.answers);
            }
            outputHtml += '</div>';

            outputEl.innerHTML = window.LearnerOutput.createTranslatedOutputShell(
                'hh-answer-toolbar',
                'hh-answer-content',
                outputHtml
            );

            window.LearnerOutput.attachTextTranslationToolbar({
                toolbarId: 'hh-answer-toolbar',
                contentId: 'hh-answer-content',
                originalHtml: outputHtml,
                sourceTool: 'homeworkHelper',
                topic: inputPromptForDb
            });

            if (window.lucide?.createIcons) window.lucide.createIcons();

        } catch (e) {
            errorEl.textContent = `An error occurred: ${e.message}`;
            errorEl.classList.remove('hidden');
            outputEl.innerHTML = '';
        } finally {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="sparkles" class="w-5 h-5 mr-2"></i>Get Help`;
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

        document.getElementById('generate-homework-help-btn').addEventListener('click', () => {
            handleGenerateHomeworkHelp(profile);
        });
    }

    init();
})();
