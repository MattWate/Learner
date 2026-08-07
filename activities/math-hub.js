/* LearnerGenie - Mathematics Hub */
(function () {
    const root = document.getElementById('page-root');

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
                        <div class="lg-eyebrow">Solve</div>
                        <h1 class="lg-page-title">Mathematics</h1>
                        <p class="lg-page-copy">Work through a maths problem step by step, understand the method, and then try a similar problem${profileName ? `, ${escapeHtml(profileName)}` : ''}.</p>
                    </div>
                </header>

                <section class="lg-panel lg-input-panel">
                    <div class="lg-panel-heading">
                        <div class="lg-panel-icon"><i data-lucide="calculator"></i></div>
                        <div><h2>What are we solving?</h2><p>Enter a calculation, equation, word problem or maths topic.</p></div>
                    </div>
                    <div class="lg-math-input-wrap">
                        <div class="lg-math-symbols" aria-label="Maths symbols">
                            <button type="button" class="lg-math-symbol" data-math-symbol=" + ">+</button>
                            <button type="button" class="lg-math-symbol" data-math-symbol=" - ">−</button>
                            <button type="button" class="lg-math-symbol" data-math-symbol=" × ">×</button>
                            <button type="button" class="lg-math-symbol" data-math-symbol=" ÷ ">÷</button>
                            <button type="button" class="lg-math-symbol" data-math-symbol=" = ">=</button>
                            <button type="button" class="lg-math-symbol" data-math-symbol="x">x</button>
                            <button type="button" class="lg-math-symbol lg-math-symbol--clear" id="math-clear">Clear</button>
                        </div>
                        <div class="lg-field" style="margin-top:0">
                            <label for="math-input">Problem or topic</label>
                            <textarea id="math-input" class="lg-textarea" placeholder="e.g. Solve for x: 2x + 5 = 15, or explain long division"></textarea>
                            <div class="lg-field-note"><span>We use UK/South African terminology and BODMAS where appropriate.</span></div>
                        </div>
                    </div>
                    <div id="math-error" class="lg-inline-error lg-hidden"></div>
                    <div class="lg-action-row"><button id="generate-math-help-btn" class="lg-primary-button"><i data-lucide="sparkles" width="18"></i>Solve & explain</button></div>
                </section>
                <div id="math-output"></div>
            </div>`;
    }

    function renderMarkdown(value) {
        if (window.LearnerOutput?.renderMarkdown) return window.LearnerOutput.renderMarkdown(value ?? '');
        return `<p>${escapeHtml(value ?? '')}</p>`;
    }

    function readButton(targetId) {
        return `<button type="button" class="lg-math-read" onclick="window.LearnerOutput.tts.speak(document.getElementById('${targetId}').innerText, this, document.getElementById('${targetId}').dataset.ttsLang || 'en-ZA')"><i data-lucide="volume-2" width="15"></i><span>Read aloud</span></button>`;
    }

    function renderMathAnswer(result, mathProblem) {
        const steps = Array.isArray(result.steps) ? result.steps.filter(Boolean) : [];
        const practice = Array.isArray(result.practice_problems) ? result.practice_problems.filter(Boolean).slice(0, 3) : [];
        const method = result.method || result.explanation || '';

        return `
            <div class="lg-math-answer">
                <div class="lg-math-answer-head">
                    <div class="lg-panel-icon" style="background:var(--lg-gold-soft);color:#a27714"><i data-lucide="square-function"></i></div>
                    <div><div class="lg-eyebrow">Worked example</div><h2>Let's work through it</h2><p>${escapeHtml(mathProblem)}</p></div>
                </div>

                <div class="lg-math-grid">
                    ${result.explanation ? `<section class="lg-math-card lg-math-card--concept"><div class="lg-math-card-head"><h3><i data-lucide="lightbulb" width="20" style="color:var(--lg-navy)"></i>Understand the idea</h3>${readButton('math-concept')}</div><div class="lg-math-content" id="math-concept">${renderMarkdown(result.explanation)}</div></section>` : ''}

                    <section class="lg-math-card lg-math-card--steps"><div class="lg-math-card-head"><h3><i data-lucide="list-ordered" width="20" style="color:var(--lg-teal)"></i>Working</h3>${readButton('math-working')}</div><div id="math-working" class="lg-math-steps">${steps.length ? steps.map(step => `<div class="lg-math-step">${renderMarkdown(step)}</div>`).join('') : `<div class="lg-math-step">${renderMarkdown(method)}</div>`}</div></section>

                    ${result.method && result.method !== result.explanation ? `<section class="lg-math-card"><div class="lg-math-card-head"><h3><i data-lucide="route" width="20" style="color:var(--lg-teal)"></i>Method</h3>${readButton('math-method')}</div><div class="lg-math-content" id="math-method">${renderMarkdown(result.method)}</div></section>` : ''}

                    <section class="lg-math-card lg-math-card--answer"><div class="lg-math-card-head"><h3><i data-lucide="circle-check" width="20" style="color:var(--lg-teal)"></i>Final answer</h3>${readButton('math-final')}</div><div class="lg-math-final" id="math-final">${renderMarkdown(result.final_answer || 'Check the working above.')}</div></section>
                </div>

                ${practice.length ? `<section class="lg-math-practice"><h3><i data-lucide="pencil-line" width="20" style="color:#a27714"></i>Now you try</h3><p>Choose a similar problem and LearnerGenie will place it in the problem box for you.</p><div class="lg-math-practice-list">${practice.map(prob => `<button type="button" class="lg-math-practice-button" data-practice-problem="${escapeHtml(encodeURIComponent(String(prob)))}"><span>${escapeHtml(prob)}</span><span>Try this one →</span></button>`).join('')}</div></section>` : ''}
            </div>`;
    }

    function wirePracticeProblems() {
        document.querySelectorAll('[data-practice-problem]').forEach(button => {
            button.onclick = () => {
                const input = document.getElementById('math-input');
                if (!input) return;
                input.value = decodeURIComponent(button.dataset.practiceProblem || '');
                input.focus();
                document.querySelector('.lg-input-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            };
        });
    }

    async function handleGenerateMathHelp(profile) {
        const mathProblem = document.getElementById('math-input').value.trim();
        const errorEl = document.getElementById('math-error');
        const outputEl = document.getElementById('math-output');
        const button = document.getElementById('generate-math-help-btn');

        errorEl.classList.add('lg-hidden');
        if (!mathProblem) {
            errorEl.textContent = 'Please enter a maths problem or topic.';
            errorEl.classList.remove('lg-hidden');
            return;
        }
        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        button.disabled = true;
        button.innerHTML = `<span class="lg-spinner" style="width:20px;height:20px;border-width:2px;border-top-color:white"></span>Checking the maths…`;
        outputEl.innerHTML = `<div class="lg-panel lg-math-loading"><div class="lg-spinner"></div><h3>Working it through carefully…</h3><p>Checking the method and calculation before showing the steps.</p></div>`;

        const prompt = `You are an expert maths tutor for school learners in South Africa and the UK.
Analyse this maths problem or topic: "${mathProblem}".

Rules:
1. Use UK/South African English spelling and terminology, such as brackets, indices and gradient.
2. Use standard pedagogical methods from UK/South African curricula.
3. Apply BODMAS for arithmetic where appropriate.
4. For algebra, trigonometry and geometry, show a logical, age-appropriate method and do not skip important working.
5. Check the calculation before giving the final answer.
6. Keep mathematical operators and notation clear.

Return valid JSON only with these keys:
- "explanation": a short explanation of what the learner needs to understand.
- "method": a concise description of the method being used.
- "steps": an array of clear step-by-step working, in order.
- "final_answer": the definitive result or conclusion.
- "practice_problems": an array of 2 similar problems for the learner to try.`;

        try {
            const jsonText = await window.LearnerAPI.fetchWithRetry(prompt, true);
            const result = JSON.parse(jsonText);

            window.LearnerAuth.supabase.from('saved_work').insert({
                profile_id: profile.id,
                work_type: 'mathHub',
                input_prompt: { prompt: mathProblem },
                output_content: result
            }).then(({ error }) => { if (error) console.error('Error saving work:', error.message); });

            const outputHtml = renderMathAnswer(result, mathProblem);
            outputEl.innerHTML = `<div class="lg-math-output"><div class="lg-math-toolbar" id="math-answer-toolbar"></div><div id="math-answer-content">${outputHtml}</div></div>`;

            window.LearnerOutput.attachTextTranslationToolbar({
                toolbarId: 'math-answer-toolbar',
                contentId: 'math-answer-content',
                originalHtml: outputHtml,
                sourceTool: 'mathHub',
                topic: mathProblem,
                onRerender: wirePracticeProblems
            });

            wirePracticeProblems();
            if (window.lucide?.createIcons) window.lucide.createIcons();
            outputEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
            errorEl.textContent = `Could not solve this problem: ${error.message}`;
            errorEl.classList.remove('lg-hidden');
            outputEl.innerHTML = '';
        } finally {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="sparkles" width="18"></i>Solve & explain`;
            if (window.lucide?.createIcons) window.lucide.createIcons();
        }
    }

    async function init() {
        const result = await window.LearnerAuth.requireSessionAndProfile();
        if (!result) return;
        const { profile, account } = result;

        window.LearnerShell.render({
            root,
            profile,
            account,
            activeKey: 'math',
            title: 'Mathematics',
            mobileTitle: 'Mathematics',
            content: pageContent(profile.name)
        });

        document.querySelectorAll('[data-math-symbol]').forEach(button => {
            button.addEventListener('click', () => {
                const input = document.getElementById('math-input');
                input.value += button.dataset.mathSymbol;
                input.focus();
            });
        });
        document.getElementById('math-clear').addEventListener('click', () => {
            document.getElementById('math-input').value = '';
            document.getElementById('math-input').focus();
        });
        document.getElementById('generate-math-help-btn').addEventListener('click', () => handleGenerateMathHelp(profile));
    }

    init();
})();
