/* LearnerGenie - Revision Notes with built-in knowledge check. */
(function () {
    const root = document.getElementById('page-root');
    let imageUpload;
    let currentTest = [];

    const TRANSLATION_INSTRUCTIONS = `
Keep the same JSON structure for Revision Notes.
Translate learner-facing text only.
Preserve these keys exactly: learning_objectives, revision_notes, practice_test.
For practice_test, preserve question order, question type, and number of questions.
Translate question text, options, and correct_answer.
For MCQ and TrueFalse questions, correct_answer must exactly match one translated option.
Do not add or remove questions. Keep mathematical notation unchanged. Return valid JSON only.
    `.trim();

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
    }

    function pageContent(profileName) {
        return `
            <div class="lg-page">
                <header class="lg-page-header">
                    <div>
                        <div class="lg-eyebrow">Revise</div>
                        <h1 class="lg-page-title">Revision Notes</h1>
                        <p class="lg-page-copy">Turn a topic or worksheet into clear study notes and a quick knowledge check${profileName ? ` for ${escapeHtml(profileName)}` : ''}.</p>
                    </div>
                    <div class="lg-header-actions">
                        <a class="lg-icon-button" href="${window.LearnerShell.profileLink('/activities/activity-history.html')}" title="Activity history"><i data-lucide="history" width="19"></i></a>
                    </div>
                </header>

                <section class="lg-panel lg-input-panel" id="lh-input-panel">
                    <div class="lg-panel-heading">
                        <div class="lg-panel-icon"><i data-lucide="book-open-check"></i></div>
                        <div><h2>What are you revising?</h2><p>Enter a topic, paste learning content or upload a clear photo of the material.</p></div>
                    </div>
                    <div class="lg-revision-input-grid">
                        <div class="lg-field">
                            <label for="learn-topic">Topic or learning content</label>
                            <textarea id="learn-topic" class="lg-textarea" placeholder="For example: The water cycle, or paste the content you need to revise."></textarea>
                        </div>
                        <div class="lg-field">
                            <label for="image-upload">Upload learning material</label>
                            <div class="lg-upload-zone">
                                <label for="image-upload"><i data-lucide="upload-cloud" width="30"></i><strong>Choose a photo</strong><span>Worksheet, textbook page or handwritten notes</span><input id="image-upload" type="file" accept="image/*"></label>
                            </div>
                            <div id="image-preview-wrapper" class="lg-image-preview lg-hidden">
                                <img id="image-preview" alt="Uploaded learning material preview">
                                <button id="remove-image-btn" type="button"><i data-lucide="x" width="16"></i>Remove image</button>
                            </div>
                        </div>
                    </div>
                    <div id="lh-error" class="lg-inline-error lg-hidden" role="alert"></div>
                    <div class="lg-action-row"><button id="generate-learning-help-btn" class="lg-primary-button" type="button"><i data-lucide="sparkles" width="18"></i>Create revision notes</button></div>
                </section>

                <section id="lh-loading" class="lg-panel lg-inline-loading lg-hidden" aria-live="polite">
                    <div class="lg-spinner"></div><h3>Building your revision guide…</h3><p>We are organising the material into useful notes and preparing a short knowledge check.</p>
                </section>
                <div id="lh-output" aria-live="polite"></div>
            </div>`;
    }

    function hasContent(value) {
        if (value == null) return false;
        if (Array.isArray(value)) return value.some(hasContent);
        if (typeof value === 'object') return Object.values(value).some(hasContent);
        return String(value).trim().length > 0;
    }

    function contentHtml(value) {
        if (Array.isArray(value)) {
            const items = value.filter(hasContent).map(item => `<li>${contentHtml(item)}</li>`).join('');
            return items ? `<ul>${items}</ul>` : '';
        }
        if (value && typeof value === 'object') {
            return Object.entries(value).filter(([, item]) => hasContent(item)).map(([key, item]) =>
                `<div><strong>${escapeHtml(key.replace(/_/g, ' '))}:</strong> ${contentHtml(item)}</div>`
            ).join('');
        }
        return window.LearnerOutput.renderMarkdown
            ? window.LearnerOutput.renderMarkdown(String(value || ''))
            : escapeHtml(value);
    }

    function normaliseSections(content) {
        const notes = content?.revision_notes;
        const sections = [];
        if (hasContent(content?.learning_objectives)) {
            sections.push({ type: 'key', icon: 'list-checks', title: 'What to know', content: content.learning_objectives });
        }
        if (Array.isArray(notes)) {
            notes.filter(hasContent).forEach((item, index) => sections.push({ type: index === 0 ? 'overview' : 'default', icon: index === 0 ? 'map' : 'book-open', title: index === 0 ? 'Overview' : `Key section ${index + 1}`, content: item }));
        } else if (notes && typeof notes === 'object') {
            Object.entries(notes).filter(([, value]) => hasContent(value)).forEach(([key, value], index) => {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
                const lowered = key.toLowerCase();
                let type = 'default', icon = 'book-open';
                if (lowered.includes('overview') || index === 0) { type = 'overview'; icon = 'map'; }
                if (lowered.includes('term') || lowered.includes('definition')) { type = 'terms'; icon = 'book-a'; }
                if (lowered.includes('summary') || lowered.includes('remember')) { type = 'summary'; icon = 'bookmark-check'; }
                sections.push({ type, icon, title: label, content: value });
            });
        } else if (hasContent(notes)) {
            sections.push({ type: 'overview', icon: 'book-open', title: 'Revision notes', content: notes });
        }
        return sections;
    }

    function renderRevisionContent(content) {
        const sections = normaliseSections(content);
        currentTest = Array.isArray(content?.practice_test) ? content.practice_test.filter(question => question?.question) : [];
        const noteCards = sections.map(section => `
            <section class="lg-note-card lg-note-card--${section.type}">
                <h3><i data-lucide="${section.icon}" width="20"></i>${escapeHtml(section.title)}</h3>
                ${contentHtml(section.content)}
            </section>`).join('');
        const quizHtml = currentTest.length ? `
            <section class="lg-quiz-card">
                <div class="lg-quiz-intro">
                    <div><div class="lg-eyebrow">Quick knowledge check</div><h2>Check what you remember</h2><p>${currentTest.length} questions based on these revision notes.</p></div>
                    <button id="lh-start-quiz" class="lg-primary-button lg-quiz-start" type="button"><i data-lucide="play" width="17"></i>Start quiz</button>
                </div>
                <div id="lh-quiz-body" class="lg-quiz-body lg-hidden"><div id="quiz-results"></div>${window.LearnerQuiz.renderPracticeTest(currentTest)}</div>
            </section>` : '';

        return `
            <div class="lg-revision-guide">
                <section class="lg-revision-hero"><div class="lg-eyebrow">Revision guide</div><h2>Your study notes</h2><p>Review the useful sections below, then try the short quiz while the ideas are still fresh.</p></section>
                ${noteCards ? `<div class="lg-note-grid">${noteCards}</div>` : '<div class="lg-panel" style="margin-top:16px"><p>No usable revision sections were returned. Please try again with a little more detail.</p></div>'}
                ${quizHtml}
            </div>`;
    }

    function wireRenderedContent() {
        const startButton = document.getElementById('lh-start-quiz');
        const quizBody = document.getElementById('lh-quiz-body');
        if (startButton && quizBody) {
            startButton.addEventListener('click', () => {
                quizBody.classList.remove('lg-hidden');
                startButton.classList.add('lg-hidden');
                quizBody.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
        window.LearnerQuiz.wireQuizForm(() => currentTest);
        if (window.lucide?.createIcons) window.lucide.createIcons();
    }

    function setLoading(isLoading) {
        document.getElementById('lh-input-panel').classList.toggle('lg-hidden', isLoading);
        document.getElementById('lh-loading').classList.toggle('lg-hidden', !isLoading);
        document.getElementById('generate-learning-help-btn').disabled = isLoading;
    }

    async function handleGenerateLearningHelp(profile) {
        const topicEl = document.getElementById('learn-topic');
        const topic = topicEl.value.trim();
        const uploadedImageBase64 = imageUpload.getImageBase64();
        const errorEl = document.getElementById('lh-error');
        const outputEl = document.getElementById('lh-output');

        errorEl.classList.add('lg-hidden');
        if (!topic && !uploadedImageBase64) {
            errorEl.textContent = 'Please enter a topic or upload a photo.';
            errorEl.classList.remove('lg-hidden');
            topicEl.focus();
            return;
        }
        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        setLoading(true);
        outputEl.innerHTML = '';
        currentTest = [];
        const prompt = `You are a helpful and safe AI assistant for students. Analyse the topic or image and create age-appropriate revision material.
Return a valid JSON object with exactly these keys: "learning_objectives", "revision_notes", and "practice_test".
- "learning_objectives": a concise array of the most important things to know. Omit filler.
- "revision_notes": use an object of clearly named sections when that improves the material, or a concise string/array for a small topic. Include only sections that add real learning value; do not create empty or repetitive sections.
- "practice_test": an array of 3-5 questions based only on the notes. Each question must contain "question", "type", "options", and "correct_answer". Type must be "MCQ", "TrueFalse", or "ShortAnswer". MCQ and TrueFalse correct_answer must exactly match one option. ShortAnswer options must be [].
Topic or content: ${topic || 'Use the uploaded image.'}`;
        const inputPromptForDb = topic || 'Revision Notes (Image)';

        try {
            const jsonText = await window.LearnerAPI.fetchWithRetry(prompt, true, 1, 'text', uploadedImageBase64);
            const result = JSON.parse(jsonText);
            const savedContent = {
                learning_objectives: result.learning_objectives,
                revision_notes: result.revision_notes,
                practice_test: Array.isArray(result.practice_test) ? result.practice_test : []
            };

            window.LearnerAuth.supabase.from('saved_work').insert({
                profile_id: profile.id,
                work_type: 'learningHub',
                input_prompt: { prompt: inputPromptForDb },
                output_content: savedContent
            }).then(({ error }) => { if (error) console.error('Error saving work:', error.message); });

            const outputHtml = renderRevisionContent(savedContent);
            outputEl.innerHTML = `<div class="lg-toolbar-wrap">${window.LearnerOutput.createTranslatedOutputShell('lh-answer-toolbar', 'lh-answer-content', outputHtml)}</div>`;
            window.LearnerOutput.attachStructuredTranslationToolbar({
                toolbarId: 'lh-answer-toolbar', contentId: 'lh-answer-content', originalContent: savedContent,
                sourceTool: 'learningHub', topic: inputPromptForDb, structureInstructions: TRANSLATION_INSTRUCTIONS,
                renderContent: renderRevisionContent, onRerender: wireRenderedContent
            });
            wireRenderedContent();
        } catch (error) {
            errorEl.textContent = `We could not create the revision guide: ${error.message}`;
            errorEl.classList.remove('lg-hidden');
            outputEl.innerHTML = '';
        } finally {
            document.getElementById('lh-loading').classList.add('lg-hidden');
            document.getElementById('lh-input-panel').classList.remove('lg-hidden');
            document.getElementById('generate-learning-help-btn').disabled = false;
        }
    }

    async function init() {
        const result = await window.LearnerAuth.requireSessionAndProfile();
        if (!result) return;
        const { profile, account } = result;
        window.LearnerShell.render({ root, profile, account, activeKey: 'revision', title: 'Revision Notes', content: pageContent(profile.name) });
        imageUpload = window.LearnerImageUpload.attach();
        document.getElementById('generate-learning-help-btn').addEventListener('click', () => handleGenerateLearningHelp(profile));
    }

    init();
})();
