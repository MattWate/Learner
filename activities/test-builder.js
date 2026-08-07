/* LearnerGenie - Practice Test */
(function () {
    const root = document.getElementById('page-root');
    let currentTest = [];
    let currentQuestionIndex = 0;

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

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function pageContent(profileName) {
        return `
            <div class="lg-page">
                <header class="lg-page-header">
                    <div>
                        <div class="lg-eyebrow">Practise</div>
                        <h1 class="lg-page-title">Practice Test</h1>
                        <p class="lg-page-copy">Build a focused test on any topic, choose the question mix, then work through it one question at a time${profileName ? `, ${escapeHtml(profileName)}` : ''}.</p>
                    </div>
                </header>

                <section class="lg-panel lg-input-panel" id="tb-setup">
                    <div class="lg-panel-heading">
                        <div class="lg-panel-icon" style="background:var(--lg-coral-soft);color:var(--lg-coral)"><i data-lucide="clipboard-check"></i></div>
                        <div><h2>Build your practice test</h2><p>Choose a topic, test length and the types of questions you want to practise.</p></div>
                    </div>
                    <div class="lg-test-setup-grid">
                        <div class="lg-field" style="margin-top:0">
                            <label for="tb-topic">Topic or learning content</label>
                            <textarea id="tb-topic" class="lg-textarea" placeholder="e.g. World War 2 key battles"></textarea>
                            <div class="lg-field-note"><span>Be specific if you want the test to focus on one part of a subject.</span></div>
                        </div>
                        <div class="lg-test-options">
                            <div class="lg-test-option-card">
                                <label for="tb-num-questions">Number of questions</label>
                                <select id="tb-num-questions" class="lg-test-select"><option value="10" selected>10 questions</option><option value="20">20 questions</option><option value="30">30 questions</option></select>
                            </div>
                            <div class="lg-test-option-card">
                                <label>Question mix</label>
                                <div class="lg-question-types">
                                    <label class="lg-question-type"><input type="checkbox" id="tb-qt-mcq" checked><span>Multiple choice</span></label>
                                    <label class="lg-question-type"><input type="checkbox" id="tb-qt-tf" checked><span>True / False</span></label>
                                    <label class="lg-question-type"><input type="checkbox" id="tb-qt-short" checked><span>Short answer</span></label>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div id="tb-error" class="lg-inline-error lg-hidden"></div>
                    <div class="lg-action-row"><button id="generate-test-builder-btn" class="lg-primary-button"><i data-lucide="sparkles" width="18"></i>Build practice test</button></div>
                </section>
                <div id="tb-output"><div class="lg-test-empty"><i data-lucide="clipboard-list" width="30"></i><p>Your practice test will appear here when you are ready.</p></div></div>
            </div>`;
    }

    function renderTestBuilderContent(testData) {
        currentTest = Array.isArray(testData) ? testData : [];
        currentQuestionIndex = 0;
        const quizHtml = window.LearnerQuiz.renderPracticeTest(currentTest);
        const map = currentTest.map((_, index) => `<button type="button" data-question-jump="${index}">${index + 1}</button>`).join('');
        return `<div class="lg-test-shell">
            <section class="lg-test-main" id="lg-test-main">
                <div class="lg-test-results" id="quiz-results"></div>
                <div class="lg-test-progress-row" id="lg-test-progress-row"><strong id="lg-test-progress-label">Question 1 of ${currentTest.length}</strong><div class="lg-test-progress-track"><div class="lg-test-progress-bar" id="lg-test-progress-bar"></div></div></div>
                ${quizHtml}
                <div class="lg-test-nav" id="lg-test-nav"><button type="button" class="lg-test-back" id="lg-test-back">Back</button><button type="button" class="lg-test-next" id="lg-test-next">Next question</button></div>
            </section>
            <aside class="lg-test-side" id="lg-test-side"><h3>Test progress</h3><div class="lg-question-map" id="lg-question-map">${map}</div><div class="lg-test-tip"><strong>Take your time</strong><p>This is practice. Use the test to find what you understand and what needs another look.</p></div></aside>
        </div>`;
    }

    function isQuestionAnswered(index) {
        const question = currentTest[index];
        if (!question) return false;
        if (question.type === 'MCQ' || question.type === 'TrueFalse') return Boolean(document.querySelector(`input[name="question_${index}"]:checked`));
        return Boolean(document.querySelector(`input[name="question_${index}"]`)?.value.trim());
    }

    function refreshQuestionView() {
        const blocks = Array.from(document.querySelectorAll('.quiz-question-wrapper'));
        if (!blocks.length) return;
        currentQuestionIndex = Math.max(0, Math.min(currentQuestionIndex, blocks.length - 1));
        blocks.forEach((block, index) => block.classList.toggle('lg-current-question', index === currentQuestionIndex));
        document.getElementById('lg-test-progress-label').textContent = `Question ${currentQuestionIndex + 1} of ${blocks.length}`;
        document.getElementById('lg-test-progress-bar').style.width = `${((currentQuestionIndex + 1) / blocks.length) * 100}%`;
        const back = document.getElementById('lg-test-back');
        const next = document.getElementById('lg-test-next');
        back.disabled = currentQuestionIndex === 0;
        back.style.opacity = currentQuestionIndex === 0 ? '.45' : '1';
        next.textContent = currentQuestionIndex === blocks.length - 1 ? 'Check my answers' : 'Next question';
        document.querySelectorAll('[data-question-jump]').forEach(button => {
            const index = Number(button.dataset.questionJump);
            button.classList.toggle('is-current', index === currentQuestionIndex);
            button.classList.toggle('is-answered', index !== currentQuestionIndex && isQuestionAnswered(index));
        });
    }

    async function showResultsReview() {
        await window.LearnerQuiz.submitQuiz(currentTest);
        const main = document.getElementById('lg-test-main');
        main?.classList.add('lg-review-mode');
        main?.parentElement?.classList.add('lg-review-shell');
        document.getElementById('lg-test-progress-row')?.classList.add('lg-hidden');
        document.getElementById('lg-test-nav')?.classList.add('lg-hidden');
        document.getElementById('lg-test-side')?.classList.add('lg-hidden');
        main?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function wireFocusedTest() {
        const blocks = Array.from(document.querySelectorAll('.quiz-question-wrapper'));
        if (!blocks.length) return;
        document.getElementById('lg-test-back')?.addEventListener('click', () => { currentQuestionIndex -= 1; refreshQuestionView(); });
        document.getElementById('lg-test-next')?.addEventListener('click', async () => {
            if (currentQuestionIndex === blocks.length - 1) return showResultsReview();
            currentQuestionIndex += 1;
            refreshQuestionView();
        });
        document.querySelectorAll('[data-question-jump]').forEach(button => button.addEventListener('click', () => { currentQuestionIndex = Number(button.dataset.questionJump); refreshQuestionView(); }));
        document.querySelectorAll('#quiz-form input').forEach(input => input.addEventListener('change', refreshQuestionView));
        document.querySelectorAll('#quiz-form input[type="text"]').forEach(input => input.addEventListener('input', refreshQuestionView));
        refreshQuestionView();
    }

    async function handleGenerateTestBuilder(profile) {
        const topic = document.getElementById('tb-topic').value.trim();
        const numQuestions = document.getElementById('tb-num-questions').value;
        const errorEl = document.getElementById('tb-error');
        const outputEl = document.getElementById('tb-output');
        const button = document.getElementById('generate-test-builder-btn');
        const questionTypes = [];
        if (document.getElementById('tb-qt-mcq').checked) questionTypes.push('MCQ');
        if (document.getElementById('tb-qt-tf').checked) questionTypes.push('TrueFalse');
        if (document.getElementById('tb-qt-short').checked) questionTypes.push('ShortAnswer');

        errorEl.classList.add('lg-hidden');
        if (!topic || questionTypes.length === 0) {
            errorEl.textContent = 'Please provide a topic and select at least one question type.';
            errorEl.classList.remove('lg-hidden');
            return;
        }
        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        button.disabled = true;
        button.innerHTML = `<span class="lg-spinner" style="width:20px;height:20px;border-width:2px;border-top-color:white"></span>Building test…`;
        outputEl.innerHTML = `<div class="lg-panel lg-test-loading"><div class="lg-spinner"></div><h3>Building your practice test…</h3><p>Creating ${numQuestions} questions about ${escapeHtml(topic)}.</p></div>`;
        currentTest = [];

        const prompt = `You are an AI test generator for school learners. Create an age-appropriate practice test based on the following parameters.
Provide a JSON object with a single key: "practice_test".
- "practice_test": An array of exactly ${numQuestions} question objects.
Each object must have these four keys:
1. "question": The question text.
2. "type": One of: ${questionTypes.join(', ')}. Use a sensible mix when multiple types are selected.
3. "options": An array of strings for MCQ and TrueFalse. Use [] for ShortAnswer.
4. "correct_answer": The correct answer. For MCQ and TrueFalse it must exactly match one option.
Do not include trick questions. Questions should test understanding, not only memorisation.
The topic is: ${topic}`;

        try {
            const jsonText = await window.LearnerAPI.fetchWithRetry(prompt, true);
            const result = JSON.parse(jsonText);
            const practiceTest = Array.isArray(result.practice_test) ? result.practice_test : [];
            if (!practiceTest.length) throw new Error('No valid questions were returned.');

            window.LearnerAuth.supabase.from('saved_work').insert({ profile_id: profile.id, work_type: 'testBuilder', input_prompt: { prompt: topic }, output_content: { practice_test: practiceTest } })
                .then(({ error }) => { if (error) console.error('Error saving work:', error.message); });

            const originalContent = { practice_test: practiceTest };
            outputEl.innerHTML = `<div class="lg-test-stage"><div class="lg-test-toolbar" id="tb-answer-toolbar"></div><div id="tb-answer-content">${renderTestBuilderContent(practiceTest)}</div></div>`;
            window.LearnerOutput.attachStructuredTranslationToolbar({
                toolbarId: 'tb-answer-toolbar', contentId: 'tb-answer-content', originalContent, sourceTool: 'testBuilder', topic,
                structureInstructions: TEST_BUILDER_TRANSLATION_INSTRUCTIONS,
                renderContent: content => renderTestBuilderContent(content?.practice_test || []),
                onRerender: wireFocusedTest
            });
            if (window.lucide?.createIcons) window.lucide.createIcons();
            wireFocusedTest();
            outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            errorEl.textContent = `Could not build the test: ${error.message}`;
            errorEl.classList.remove('lg-hidden');
            outputEl.innerHTML = `<div class="lg-inline-error">The practice test could not be generated. Please try again.</div>`;
        } finally {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="sparkles" width="18"></i>Build practice test`;
            if (window.lucide?.createIcons) window.lucide.createIcons();
        }
    }

    async function init() {
        const result = await window.LearnerAuth.requireSessionAndProfile();
        if (!result) return;
        const { profile, account } = result;
        window.LearnerShell.render({ root, profile, account, activeKey: 'test', title: 'Practice Test', mobileTitle: 'Practice Test', content: pageContent(profile.name) });
        document.getElementById('generate-test-builder-btn').addEventListener('click', () => handleGenerateTestBuilder(profile));
    }
    init();
})();
