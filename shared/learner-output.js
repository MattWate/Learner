/*
 * LearnerGenie - shared output rendering module
 *
 * Extracted from app.html: createSectionHTML, the tts engine, and the
 * translation-toolbar helpers that wrap window.LearnerGenieAnswerTools
 * (answer-tools.js). Behavior is unchanged from app.html.
 *
 * Load answer-tools.js before this file if you want translation/toolbar
 * support:
 *   <script src="/answer-tools.js"></script>
 *   <script src="/answer-tools-tts-language-patch.js"></script>
 *   <script src="/shared/learner-output.js"></script>
 */
(function () {
    // --- TEXT-TO-SPEECH ENGINE (unchanged from app.html) ---
    const tts = {
        synth: window.speechSynthesis,
        currentUtterance: null,
        isSpeaking: false,

        speak(text, btnEl, lang = 'en-ZA') {
            if (this.isSpeaking) {
                this.stop();
                if (btnEl) this._resetBtn(btnEl);
                return;
            }

            const clean = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            if (!clean) return;

            const utterance = new SpeechSynthesisUtterance(clean);
            utterance.rate = 0.92;
            utterance.pitch = 1.05;
            utterance.lang = lang;

            const voices = this.synth.getVoices();
            const normalise = value => String(value || '').toLowerCase();
            let preferred = null;

            if (lang.toLowerCase().startsWith('af')) {
                preferred =
                    voices.find(v => normalise(v.lang).startsWith('af-za')) ||
                    voices.find(v => normalise(v.lang).startsWith('af')) ||
                    voices.find(v => normalise(v.name).includes('afrikaans')) ||
                    voices.find(v => normalise(v.lang).startsWith('en-za')) ||
                    voices.find(v => normalise(v.lang).startsWith('en-gb')) ||
                    voices.find(v => normalise(v.lang).startsWith('en-au')) ||
                    voices.find(v => normalise(v.lang).startsWith('en'));
            } else {
                preferred =
                    voices.find(v => normalise(v.lang).startsWith(lang.toLowerCase())) ||
                    voices.find(v => normalise(v.lang).startsWith('en-za')) ||
                    voices.find(v => normalise(v.lang).startsWith('en-gb')) ||
                    voices.find(v => normalise(v.lang).startsWith('en-au')) ||
                    voices.find(v => normalise(v.lang).startsWith('en'));
            }

            if (preferred) {
                utterance.voice = preferred;
                utterance.lang = preferred.lang || lang;
            }

            utterance.onstart = () => {
                this.isSpeaking = true;
                if (btnEl) this._setPlayingBtn(btnEl);
            };
            utterance.onend = utterance.onerror = () => {
                this.isSpeaking = false;
                this.currentUtterance = null;
                if (btnEl) this._resetBtn(btnEl);
            };

            this.currentUtterance = utterance;
            this.synth.cancel();
            this.synth.speak(utterance);
        },

        stop() {
            this.synth.cancel();
            this.isSpeaking = false;
            this.currentUtterance = null;
        },

        _setPlayingBtn(btn) {
            btn.dataset.playing = 'true';
            btn.title = 'Stop reading';
            btn.innerHTML = '<i data-lucide="square" class="h-4 w-4 mr-1.5 text-rose-500"></i><span class="text-rose-500">Stop</span>';
            if (window.lucide?.createIcons) window.lucide.createIcons({ nodes: [btn] });
        },

        _resetBtn(btn) {
            delete btn.dataset.playing;
            btn.title = 'Read aloud';
            btn.innerHTML = '<i data-lucide="volume-2" class="h-4 w-4 mr-1.5"></i><span>Read Aloud</span>';
            if (window.lucide?.createIcons) window.lucide.createIcons({ nodes: [btn] });
        }
    };

    function stopTTS() { tts.stop(); }

    // --- SECTION CARD RENDERING (unchanged from app.html) ---
    function createSectionHTML(icon, color, title, content) {
        const cleanMarkdown = (text) => {
            return String(text)
                .replace(/\*\*\*(.*?)\*\*\*/g, '<hr class="my-4 border-gray-200"><strong><em>$1</em></strong><hr class="my-4 border-gray-200">')
                .replace(/\*\*/g, '')
                .replace(/\*/g, '')
                .replace(/## /g, '<h3 class="text-md font-semibold mt-4">')
                .replace(/\n/g, '<br>');
        };

        let textContent = 'No content provided.';
        if (typeof content === 'string') {
            textContent = cleanMarkdown(content);
        } else if (Array.isArray(content)) {
            textContent = `<ol class="list-decimal list-inside">${content.map(item => `<li>${cleanMarkdown(item)}</li>`).join('')}</ol>`;
        } else if (typeof content === 'object' && content !== null) {
            const formatObject = (obj) => {
                return `<ul class="list-disc list-inside ml-4">${Object.entries(obj).map(([key, value]) => `<li><strong>${key}:</strong> ${formatContent(value)}</li>`).join('')}</ul>`;
            };
            const formatArray = (arr) => {
                return `<ol class="list-decimal list-inside">${arr.map(item => `<li>${formatContent(item)}</li>`).join('')}</ol>`;
            };
            const formatContent = (item) => {
                if (typeof item === 'string') return cleanMarkdown(item);
                if (Array.isArray(item)) return formatArray(item);
                if (typeof item === 'object' && item !== null) return formatObject(item);
                return cleanMarkdown(String(item));
            };
            textContent = formatContent(content);
        } else if (content) {
            textContent = cleanMarkdown(String(content));
        }

        const sectionId = 'section-' + Math.random().toString(36).substr(2, 9);
        return `<div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 break-inside-avoid">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                    <i data-lucide="${icon}" class="text-${color}-500"></i>
                    <span class="ml-2">${title}</span>
                </h3>
                <button
                    class="tts-btn flex items-center text-xs font-medium text-gray-500 hover:text-indigo-600 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-200 px-3 py-1.5 rounded-full transition-all"
                    title="Read aloud"
                    data-section-id="${sectionId}"
                    onclick="window.LearnerOutput.tts.speak(document.getElementById('${sectionId}').innerText, this, document.getElementById('${sectionId}').dataset.ttsLang || 'en-ZA')"
                >
                    <i data-lucide="volume-2" class="h-4 w-4 mr-1.5"></i><span>Read Aloud</span>
                </button>
            </div>
            <div id="${sectionId}" class="prose prose-sm max-w-none text-gray-600">${textContent}</div>
        </div>`;
    }

    // --- TRANSLATION TOOL HELPERS (unchanged from app.html) ---
    function answerToolsAvailable() {
        return Boolean(window.LearnerGenieAnswerTools?.createOutputToolbar);
    }

    function getOutputTextFromHtml(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html || '';
        return (temp.innerText || temp.textContent || '').trim();
    }

    function createTranslatedOutputShell(toolbarId, contentId, contentHtml) {
        return `
            <div class="space-y-4">
                <div id="${toolbarId}" class="print:hidden"></div>
                <div id="${contentId}">
                    ${contentHtml}
                </div>
            </div>
        `;
    }

    function attachTextTranslationToolbar({ toolbarId, contentId, originalHtml, sourceTool, topic = '' }) {
        if (!answerToolsAvailable()) {
            console.warn('Answer Tools module was not found. Translation toolbar skipped.');
            return;
        }

        const toolbarMount = document.getElementById(toolbarId);
        const contentElement = document.getElementById(contentId);

        if (!toolbarMount || !contentElement) {
            console.warn('Translation toolbar mount or content element not found.', { toolbarId, contentId });
            return;
        }

        try {
            window.LearnerGenieAnswerTools.createOutputToolbar({
                mount: toolbarMount,
                contentElement,
                originalHtml,
                originalText: getOutputTextFromHtml(originalHtml),
                sourceTool,
                topic,
                defaultLanguage: 'af',
                showCopy: true,
                showTranslate: true,
                onViewChanged: () => {
                    if (window.lucide?.createIcons) {
                        window.lucide.createIcons();
                    }
                }
            });
        } catch (error) {
            console.error('Could not attach translation toolbar:', error);
        }
    }

    // --- STRUCTURED (JSON) TRANSLATION HELPER (unchanged from app.html) ---
    function attachStructuredTranslationToolbar({
        toolbarId,
        contentId,
        originalContent,
        sourceTool,
        topic = '',
        structureInstructions = '',
        renderContent,
        onRerender
    }) {
        if (!answerToolsAvailable()) {
            console.warn('Answer Tools module was not found. Structured translation toolbar skipped.');
            return;
        }

        const toolbarMount = document.getElementById(toolbarId);
        const contentElement = document.getElementById(contentId);

        if (!toolbarMount || !contentElement) {
            console.warn('Structured translation toolbar mount or content element not found.', { toolbarId, contentId });
            return;
        }

        const renderAndBind = (content) => {
            contentElement.innerHTML = renderContent(content);

            if (window.lucide?.createIcons) {
                window.lucide.createIcons();
            }

            if (typeof onRerender === 'function') {
                onRerender(content);
            }
        };

        try {
            window.LearnerGenieAnswerTools.createOutputToolbar({
                mount: toolbarMount,
                contentElement,
                originalContent,
                originalText: JSON.stringify(originalContent || {}, null, 2),
                sourceTool,
                topic,
                defaultLanguage: 'af',
                translationMode: 'structured',
                structureInstructions,
                showCopy: true,
                showTranslate: true,
                onBeforeViewChange: () => {
                    if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                    }
                },
                onRenderOriginal: ({ originalContent }) => {
                    renderAndBind(originalContent);
                },
                onRenderTranslated: ({ translatedContent }) => {
                    renderAndBind(translatedContent);
                },
                onViewChanged: () => {
                    if (window.lucide?.createIcons) {
                        window.lucide.createIcons();
                    }
                }
            });
        } catch (error) {
            console.error('Could not attach structured translation toolbar:', error);
            renderAndBind(originalContent);
        }
    }

    window.LearnerOutput = {
        tts,
        stopTTS,
        createSectionHTML,
        answerToolsAvailable,
        getOutputTextFromHtml,
        createTranslatedOutputShell,
        attachTextTranslationToolbar,
        attachStructuredTranslationToolbar
    };
})();
