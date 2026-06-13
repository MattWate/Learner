/*
 * LearnerGenie Answer Tools
 * Standalone module for post-answer actions such as read aloud, translation,
 * copy, and original/translated toggling.
 *
 * This file is intentionally independent from app.html so it can be tested
 * safely before being wired into the main learner app.
 */
(function () {
    const DEFAULT_TRANSLATION_ENDPOINT = '/.netlify/functions/translate-answer';

    const DEFAULT_LANGUAGES = [
        { code: 'af', label: 'Afrikaans' },
        { code: 'zu', label: 'isiZulu' },
        { code: 'xh', label: 'isiXhosa' },
        { code: 'st', label: 'Sesotho' },
        { code: 'fr', label: 'French' },
        { code: 'pt', label: 'Portuguese' },
        { code: 'es', label: 'Spanish' }
    ];

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function stripHtml(value) {
        const temp = document.createElement('div');
        temp.innerHTML = value || '';
        return temp.textContent || temp.innerText || '';
    }

    function normaliseLanguageLabel(languageCode, languages) {
        const match = languages.find(language => language.code === languageCode);
        return match ? match.label : languageCode;
    }

    function renderLanguageOptions(languages, defaultLanguage) {
        return languages.map(language => {
            const selected = language.code === defaultLanguage ? 'selected' : '';
            return `<option value="${escapeHtml(language.code)}" ${selected}>${escapeHtml(language.label)}</option>`;
        }).join('');
    }

    function createAnswerTools(options) {
        const config = {
            mount: null,
            answerHtml: '',
            answerText: '',
            title: 'Answer Tools',
            subject: '',
            topic: '',
            grade: '',
            sourceTool: '',
            defaultLanguage: 'af',
            languages: DEFAULT_LANGUAGES,
            translationEndpoint: DEFAULT_TRANSLATION_ENDPOINT,
            showCopy: true,
            showReadAloud: true,
            showTranslate: true,
            onSave: null,
            onTranslated: null,
            ...options
        };

        const mount = typeof config.mount === 'string'
            ? document.querySelector(config.mount)
            : config.mount;

        if (!mount) {
            throw new Error('Answer Tools mount element was not found.');
        }

        const state = {
            originalHtml: config.answerHtml || escapeHtml(config.answerText || ''),
            originalText: config.answerText || stripHtml(config.answerHtml || ''),
            translatedHtml: '',
            translatedText: '',
            currentView: 'original',
            selectedLanguage: config.defaultLanguage,
            isTranslating: false,
            error: '',
            isSpeaking: false
        };

        function getContentElement() {
            return mount.querySelector('[data-answer-tools-content]');
        }

        function getStatusElement() {
            return mount.querySelector('[data-answer-tools-status]');
        }

        function setStatus(message, type) {
            const status = getStatusElement();
            if (!status) return;

            const colours = {
                info: 'text-slate-500',
                success: 'text-emerald-600',
                error: 'text-rose-600'
            };

            status.className = `min-h-5 text-sm ${colours[type] || colours.info}`;
            status.textContent = message || '';
        }

        function updateContent() {
            const content = getContentElement();
            if (!content) return;

            content.innerHTML = state.currentView === 'translated'
                ? state.translatedHtml
                : state.originalHtml;

            const originalButton = mount.querySelector('[data-answer-tools-view="original"]');
            const translatedButton = mount.querySelector('[data-answer-tools-view="translated"]');

            if (originalButton) {
                originalButton.classList.toggle('bg-indigo-600', state.currentView === 'original');
                originalButton.classList.toggle('text-white', state.currentView === 'original');
                originalButton.classList.toggle('bg-slate-100', state.currentView !== 'original');
                originalButton.classList.toggle('text-slate-700', state.currentView !== 'original');
            }

            if (translatedButton) {
                translatedButton.disabled = !state.translatedHtml;
                translatedButton.classList.toggle('bg-indigo-600', state.currentView === 'translated');
                translatedButton.classList.toggle('text-white', state.currentView === 'translated');
                translatedButton.classList.toggle('bg-slate-100', state.currentView !== 'translated');
                translatedButton.classList.toggle('text-slate-700', state.currentView !== 'translated');
                translatedButton.classList.toggle('opacity-50', !state.translatedHtml);
                translatedButton.textContent = state.translatedHtml
                    ? normaliseLanguageLabel(state.selectedLanguage, config.languages)
                    : 'Translated';
            }
        }

        function getCurrentPlainText() {
            return state.currentView === 'translated'
                ? state.translatedText
                : state.originalText;
        }

        function readAloud() {
            if (!('speechSynthesis' in window)) {
                setStatus('Read aloud is not available in this browser.', 'error');
                return;
            }

            if (window.speechSynthesis.speaking) {
                window.speechSynthesis.cancel();
                state.isSpeaking = false;
                setStatus('Read aloud stopped.', 'info');
                return;
            }

            const utterance = new SpeechSynthesisUtterance(getCurrentPlainText());
            utterance.rate = 0.95;
            utterance.pitch = 1;

            if (state.currentView === 'translated') {
                utterance.lang = state.selectedLanguage === 'af' ? 'af-ZA' : state.selectedLanguage;
            } else {
                utterance.lang = 'en-ZA';
            }

            utterance.onstart = () => {
                state.isSpeaking = true;
                setStatus('Reading aloud… click again to stop.', 'info');
            };

            utterance.onend = () => {
                state.isSpeaking = false;
                setStatus('', 'info');
            };

            utterance.onerror = () => {
                state.isSpeaking = false;
                setStatus('There was a problem using read aloud.', 'error');
            };

            window.speechSynthesis.speak(utterance);
        }

        async function copyAnswer() {
            try {
                await navigator.clipboard.writeText(getCurrentPlainText());
                setStatus('Copied to clipboard.', 'success');
            } catch (error) {
                setStatus('Could not copy this answer. Please select the text manually.', 'error');
            }
        }

        async function translateAnswer() {
            if (state.isTranslating) return;

            const languageSelect = mount.querySelector('[data-answer-tools-language]');
            state.selectedLanguage = languageSelect?.value || state.selectedLanguage;
            const targetLanguage = normaliseLanguageLabel(state.selectedLanguage, config.languages);

            state.isTranslating = true;
            state.error = '';
            setStatus(`Translating to ${targetLanguage}…`, 'info');

            const translateButton = mount.querySelector('[data-answer-tools-action="translate"]');
            if (translateButton) {
                translateButton.disabled = true;
                translateButton.textContent = 'Translating…';
            }

            try {
                const response = await fetch(config.translationEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: state.originalText,
                        html: state.originalHtml,
                        targetLanguage,
                        targetLanguageCode: state.selectedLanguage,
                        subject: config.subject,
                        topic: config.topic,
                        grade: config.grade,
                        sourceTool: config.sourceTool
                    })
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || 'Translation failed.');
                }

                state.translatedHtml = data.translatedHtml || escapeHtml(data.translatedText || '').replace(/\n/g, '<br>');
                state.translatedText = data.translatedText || stripHtml(state.translatedHtml);
                state.currentView = 'translated';

                if (typeof config.onTranslated === 'function') {
                    config.onTranslated({
                        languageCode: state.selectedLanguage,
                        languageLabel: targetLanguage,
                        translatedText: state.translatedText,
                        translatedHtml: state.translatedHtml
                    });
                }

                updateContent();
                setStatus(`Translated to ${targetLanguage}.`, 'success');
            } catch (error) {
                state.error = error.message;
                setStatus(error.message || 'Translation failed. Please try again.', 'error');
            } finally {
                state.isTranslating = false;
                if (translateButton) {
                    translateButton.disabled = false;
                    translateButton.textContent = 'Translate';
                }
            }
        }

        function bindEvents() {
            mount.addEventListener('click', event => {
                const actionButton = event.target.closest('[data-answer-tools-action]');
                const viewButton = event.target.closest('[data-answer-tools-view]');

                if (actionButton) {
                    const action = actionButton.dataset.answerToolsAction;
                    if (action === 'read') readAloud();
                    if (action === 'copy') copyAnswer();
                    if (action === 'translate') translateAnswer();
                    if (action === 'save' && typeof config.onSave === 'function') config.onSave();
                }

                if (viewButton) {
                    const view = viewButton.dataset.answerToolsView;
                    if (view === 'translated' && !state.translatedHtml) return;
                    state.currentView = view;
                    updateContent();
                    setStatus('', 'info');
                }
            });
        }

        function render() {
            mount.innerHTML = `
                <section class="answer-tools-shell grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">
                    <article class="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 px-5 py-4">
                            <div>
                                <p class="text-xs font-bold uppercase tracking-wide text-indigo-600">LearnerGenie Answer</p>
                                <h2 class="text-xl font-bold text-slate-900">${escapeHtml(config.title)}</h2>
                            </div>
                            <div class="flex items-center gap-2">
                                <button type="button" data-answer-tools-view="original" class="rounded-full px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white">Original</button>
                                <button type="button" data-answer-tools-view="translated" class="rounded-full px-3 py-1.5 text-sm font-semibold bg-slate-100 text-slate-700 opacity-50" disabled>Translated</button>
                            </div>
                        </div>
                        <div data-answer-tools-content class="prose prose-slate max-w-none px-5 py-5 text-slate-800 leading-relaxed"></div>
                    </article>

                    <aside class="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 h-fit">
                        <p class="text-xs font-bold uppercase tracking-wide text-slate-400 mb-3">Answer Tools</p>
                        <div class="space-y-3">
                            ${config.showReadAloud ? `
                                <button type="button" data-answer-tools-action="read" class="w-full flex items-center justify-between rounded-xl bg-indigo-50 px-4 py-3 text-left font-semibold text-indigo-700 hover:bg-indigo-100">
                                    <span>Read aloud</span>
                                    <span aria-hidden="true">▶</span>
                                </button>
                            ` : ''}

                            ${config.showTranslate ? `
                                <div class="rounded-xl border border-slate-200 p-3">
                                    <label class="block text-sm font-semibold text-slate-700 mb-2">Translate answer</label>
                                    <select data-answer-tools-language class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        ${renderLanguageOptions(config.languages, config.defaultLanguage)}
                                    </select>
                                    <button type="button" data-answer-tools-action="translate" class="mt-3 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">
                                        Translate
                                    </button>
                                </div>
                            ` : ''}

                            ${config.showCopy ? `
                                <button type="button" data-answer-tools-action="copy" class="w-full flex items-center justify-between rounded-xl bg-slate-100 px-4 py-3 text-left font-semibold text-slate-700 hover:bg-slate-200">
                                    <span>Copy answer</span>
                                    <span aria-hidden="true">⧉</span>
                                </button>
                            ` : ''}
                        </div>
                        <p data-answer-tools-status class="min-h-5 text-sm text-slate-500 mt-4"></p>
                    </aside>
                </section>
            `;

            updateContent();
            bindEvents();
        }

        render();

        return {
            translate: translateAnswer,
            readAloud,
            copy: copyAnswer,
            setView(view) {
                if (view === 'translated' && !state.translatedHtml) return;
                state.currentView = view === 'translated' ? 'translated' : 'original';
                updateContent();
            },
            getState() {
                return { ...state };
            },
            destroy() {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                }
                mount.innerHTML = '';
            }
        };
    }

    window.LearnerGenieAnswerTools = {
        create: createAnswerTools,
        languages: DEFAULT_LANGUAGES
    };
})();
