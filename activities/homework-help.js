/* LearnerGenie - Homework Helper */
(function () {
    const root = document.getElementById('page-root');
    let imageUpload;

    function escapeHtml(value) {
        return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
    }

    function pageContent(profileName) {
        return `
            <div class="lg-page">
                <header class="lg-page-header">
                    <div>
                        <div class="lg-eyebrow">Solve and understand</div>
                        <h1 class="lg-page-title">Homework Helper</h1>
                        <p class="lg-page-copy">Ask a homework question or upload a worksheet photo. LearnerGenie will help you work through it${profileName ? `, ${escapeHtml(profileName)}` : ''}.</p>
                    </div>
                </header>

                <section class="lg-panel lg-input-panel">
                    <div class="lg-panel-heading">
                        <div class="lg-panel-icon"><i data-lucide="life-buoy"></i></div>
                        <div><h2>What are you working on?</h2><p>Choose one way to send the homework: type the question or upload a clear photo.</p></div>
                    </div>

                    <div class="lg-homework-grid">
                        <div class="lg-homework-question">
                            <label for="hh-question">Type your question</label>
                            <textarea id="hh-question" class="lg-textarea" style="min-height:170px" placeholder="e.g. What was the main cause of the French Revolution?"></textarea>
                            <div class="lg-field-note"><span>Include the full question if you can.</span></div>
                        </div>

                        <div class="lg-homework-upload">
                            <label>Upload a worksheet photo</label>
                            <div class="lg-homework-upload-zone">
                                <label for="image-upload">
                                    <i data-lucide="camera" width="30" style="color:var(--lg-teal)"></i>
                                    <strong>Choose a photo</strong>
                                    <span>PNG, JPG or GIF up to 10MB</span>
                                    <input id="image-upload" type="file" accept="image/*">
                                </label>
                            </div>
                            <div id="image-preview-wrapper" class="lg-homework-preview hidden">
                                <img id="image-preview" alt="Worksheet preview">
                                <button id="remove-image-btn" type="button"><i data-lucide="x" width="16"></i>Remove image</button>
                            </div>
                        </div>
                    </div>

                    <div id="hh-error" class="lg-inline-error lg-hidden"></div>
                    <div class="lg-action-row"><button id="generate-homework-help-btn" class="lg-primary-button"><i data-lucide="sparkles" width="18"></i>Get homework help</button></div>
                </section>
                <div id="hh-output"></div>
            </div>`;
    }

    function contentToMarkdown(content) {
        if (Array.isArray(content)) return content.map(item => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`).join('\n');
        if (content && typeof content === 'object') return Object.entries(content).map(([key, value]) => `- **${key}:** ${Array.isArray(value) ? value.join(', ') : String(value)}`).join('\n');
        return String(content ?? '');
    }

    function renderSection({ type, icon, title, content }) {
        if (content === null || content === undefined || content === '' || (Array.isArray(content) && !content.length)) return '';
        const id = `hh-section-${Math.random().toString(36).slice(2,9)}`;
        const html = window.LearnerOutput.renderMarkdown(contentToMarkdown(content));
        return `<section class="lg-homework-section lg-homework-section--${type}">
            <div class="lg-homework-section-head">
                <div class="lg-homework-section-title"><i data-lucide="${icon}" width="20"></i><h3>${escapeHtml(title)}</h3></div>
                <button type="button" class="lg-homework-read" title="Read aloud" onclick="window.LearnerOutput.tts.speak(document.getElementById('${id}').innerText,this,document.getElementById('${id}').dataset.ttsLang||'en-ZA')"><i data-lucide="volume-2" width="15"></i><span>Read aloud</span></button>
            </div>
            <div class="prose" id="${id}">${html}</div>
        </section>`;
    }

    function renderHomeworkResult(result, topicLabel) {
        const sections = [];
        if (result.breakdown) sections.push(renderSection({ type:'breakdown', icon:'list-checks', title:"Let's break it down", content:result.breakdown }));
        if (result.hints) sections.push(renderSection({ type:'hints', icon:'lightbulb', title:'How to approach it', content:result.hints }));
        if (result.answer) sections.push(renderSection({ type:'answer', icon:'key-round', title:'Answer', content:result.answer }));
        else if (result.answers) sections.push(renderSection({ type:'answer', icon:'circle-check-big', title:'Check your work', content:result.answers }));

        return `<div class="lg-homework-answer">
            <div class="lg-homework-answer-head"><div class="lg-eyebrow">Homework help</div><h2>Work through it step by step</h2><p>${escapeHtml(topicLabel || 'Your worksheet')}</p></div>
            ${sections.join('')}
        </div>`;
    }

    async function handleGenerateHomeworkHelp(profile) {
        const questionText = document.getElementById('hh-question').value.trim();
        const errorEl = document.getElementById('hh-error');
        const outputEl = document.getElementById('hh-output');
        const button = document.getElementById('generate-homework-help-btn');
        const uploadedImageBase64 = imageUpload.getImageBase64();

        errorEl.classList.add('lg-hidden');
        if (!questionText && !uploadedImageBase64) {
            errorEl.textContent = 'Please enter a question or upload a photo of your worksheet.';
            errorEl.classList.remove('lg-hidden');
            return;
        }
        if (questionText && uploadedImageBase64) {
            errorEl.textContent = 'Please use either a typed question or an uploaded image, not both at the same time.';
            errorEl.classList.remove('lg-hidden');
            return;
        }
        if (!await window.LearnerUsage.checkAndIncrementUsage()) return;

        button.disabled = true;
        button.innerHTML = `<span class="lg-spinner" style="width:20px;height:20px;border-width:2px;border-top-color:white"></span>Thinking…`;
        outputEl.innerHTML = `<div class="lg-panel lg-homework-loading"><div class="lg-spinner"></div><h3>Working through the homework…</h3><p>Looking for the clearest way to explain the task and guide you towards the answer.</p></div>`;

        let prompt = '';
        let imageData = uploadedImageBase64;
        let inputPromptForDb = questionText;

        if (questionText) {
            prompt = `You are a helpful and safe AI assistant for school students. Explain educational topics in an age-appropriate way. The learner asked: "${questionText}".
Return valid JSON with exactly two keys: "hints" and "answer".
- "hints": an array of 2-4 useful steps or clues that help the learner understand how to approach the question before seeing the answer.
- "answer": a clear, concise final answer with enough explanation to understand why it is correct.
Do not add keys outside this structure.`;
            imageData = null;
        } else {
            prompt = `You are a helpful and safe AI assistant for school students. Analyse the uploaded worksheet image.
Return valid JSON with exactly three keys: "breakdown", "hints", and "answers".
- "breakdown": a concise summary of what the worksheet is asking the learner to do.
- "hints": an array of useful clues or steps for the worksheet questions.
- "answers": an array of final answers the learner can use to check their own work.
Do not add keys outside this structure.`;
            inputPromptForDb = 'Homework Help (Image)';
        }

        try {
            const jsonText = await window.LearnerAPI.fetchWithRetry(prompt, true, 1, 'text', imageData);
            const result = JSON.parse(jsonText);

            window.LearnerAuth.supabase.from('saved_work').insert({
                profile_id: profile.id,
                work_type: 'homeworkHelper',
                input_prompt: { prompt: inputPromptForDb },
                output_content: result
            }).then(({ error }) => { if (error) console.error('Error saving work:', error.message); });

            const topicLabel = questionText || 'Uploaded worksheet';
            const outputHtml = renderHomeworkResult(result, topicLabel);
            outputEl.innerHTML = `<div class="lg-homework-output"><div class="lg-homework-toolbar" id="hh-answer-toolbar"></div><div id="hh-answer-content">${outputHtml}</div></div>`;

            window.LearnerOutput.attachTextTranslationToolbar({
                toolbarId: 'hh-answer-toolbar',
                contentId: 'hh-answer-content',
                originalHtml: outputHtml,
                sourceTool: 'homeworkHelper',
                topic: inputPromptForDb
            });

            if (window.lucide?.createIcons) window.lucide.createIcons();
            outputEl.scrollIntoView({ behavior:'smooth', block:'start' });
        } catch (error) {
            errorEl.textContent = `Could not generate homework help: ${error.message}`;
            errorEl.classList.remove('lg-hidden');
            outputEl.innerHTML = '';
        } finally {
            button.disabled = false;
            button.innerHTML = `<i data-lucide="sparkles" width="18"></i>Get homework help`;
            if (window.lucide?.createIcons) window.lucide.createIcons();
        }
    }

    async function init() {
        const result = await window.LearnerAuth.requireSessionAndProfile();
        if (!result) return;
        const { profile, account } = result;

        window.LearnerShell.render({ root, profile, account, activeKey:'homework', title:'Homework Helper', mobileTitle:'Homework Helper', content:pageContent(profile.name) });
        imageUpload = window.LearnerImageUpload.attach();
        document.getElementById('generate-homework-help-btn').addEventListener('click', () => handleGenerateHomeworkHelp(profile));
    }

    init();
})();
