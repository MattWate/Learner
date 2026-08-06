/* LearnerGenie - Explain It Simply standalone activity. */
(function () {
    const root = document.getElementById('page-root');

    function pageContent(profileName) {
        return `
            <div class="lg-page">
                <header class="lg-page-header">
                    <div>
                        <div class="lg-eyebrow">Understand</div>
                        <h1 class="lg-page-title">Explain It Simply</h1>
                        <p class="lg-page-copy">Turn a difficult topic into a clear explanation that feels easier to understand${profileName ? ` for ${escapeHtml(profileName)}` : ''}.</p>
                    </div>
                    <div class="lg-header-actions">
                        <a class="lg-icon-button" href="${window.LearnerShell.profileLink('/app.html#history')}" title="Activity history" aria-label="Activity history"><i data-lucide="history" width="19"></i></a>
                    </div>
                </header>

                <section class="lg-panel lg-input-panel" id="es-input-panel">
                    <div class="lg-panel-heading">
                        <div class="lg-panel-icon"><i data-lucide="lightbulb"></i></div>
                        <div>
                            <h2>What do you want explained?</h2>
                            <p>Ask about a topic, idea or question. LearnerGenie will break it into simpler parts.</p>
                        </div>
                    </div>
                    <div class="lg-field">
                        <label for="explain-topic">Your topic or question</label>
                        <textarea id="explain-topic" class="lg-textarea" placeholder="For example: Why does it sometimes snow and sometimes sleet?"></textarea>
                        <div class="lg-field-note"><span>Try to be as specific as you can.</span><span id="es-character-count">0 characters</span></div>
                    </div>
                    <div id="es-error" class="lg-inline-error lg-hidden" role="alert"></div>
                    <div class="lg-action-row">
                        <button id="generate-explanation-btn" class="lg-primary-button" type="button">
                            <i data-lucide="sparkles" width="18"></i><span>Explain it simply</span>
                        </button>
                    </div>
                </section>

                <section id="es-loading" class="lg-panel lg-loading-panel lg-hidden" aria-live="polite">
                    <div class="lg-spinner"></div>
                    <h3>Making this easier to understand…</h3>
                    <p>We are turning the topic into a clear, learner-friendly explanation.</p>
                </section>

                <div id="es-output" class="lg-output" aria-live="polite"></div>
            </div>`;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function setLoading(isLoading) {
        const inputPanel = document.getElementById('es-input-panel');
        const loadingPanel = document.getElementById('es-loading');
        const button = document.getElementById('generate-explanation-btn');
        inputPanel.classList.toggle('lg-hidden', isLoading);
        loadingPanel.classList.toggle('lg-hidden', !isLoading);
        button.disabled = isLoading;
    }

    async function handleGenerateExplanation(profile) {
        const topicEl = document.getElementById('explain-topic');
        const topic = topicEl.value.trim();
        const errorEl = document.getElementById('es-error');
        const outputEl = document.getElementById('es-output');

        errorEl.classList.add('lg-hidden');
        if (!topic) {
            errorEl.textContent = 'Please enter a topic or question.';
            errorEl.classList.remove('lg-hidden');
            topicEl.focus();
            return;
        }

        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        setLoading(true);
        outputEl.innerHTML = '';

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

            const outputHtml = `<div class="lg-output-card">${window.LearnerOutput.createSectionHTML('baby', 'amber', 'Here is a simple explanation', text)}</div>`;
            outputEl.innerHTML = window.LearnerOutput.createTranslatedOutputShell('es-answer-toolbar', 'es-answer-content', outputHtml);

            window.LearnerOutput.attachTextTranslationToolbar({
                toolbarId: 'es-answer-toolbar',
                contentId: 'es-answer-content',
                originalHtml: outputHtml,
                sourceTool: 'explainSimply',
                topic
            });

            if (window.lucide?.createIcons) window.lucide.createIcons();
        } catch (error) {
            errorEl.textContent = `We could not create the explanation: ${error.message}`;
            errorEl.classList.remove('lg-hidden');
            outputEl.innerHTML = '';
        } finally {
            setLoading(false);
        }
    }

    async function init() {
        const result = await window.LearnerAuth.requireSessionAndProfile();
        if (!result) return;

        const { profile, account } = result;
        window.LearnerShell.render({ root, profile, account, activeKey: 'explain', title: 'Explain It Simply', content: pageContent(profile.name) });

        const topicEl = document.getElementById('explain-topic');
        const countEl = document.getElementById('es-character-count');
        topicEl.addEventListener('input', () => {
            countEl.textContent = `${topicEl.value.length} character${topicEl.value.length === 1 ? '' : 's'}`;
        });
        document.getElementById('generate-explanation-btn').addEventListener('click', () => handleGenerateExplanation(profile));
    }

    init();
})();
