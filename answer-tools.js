/*
 * LearnerGenie Answer Tools
 * Shared module for post-answer actions.
 *
 * Design direction:
 * - Output-level tools act on the whole generated answer: translate, copy, view original/translated.
 * - Section-level tools act on one block of content: read aloud.
 * - Simple outputs are translated as learner-facing content blocks and then rehydrated into the original HTML shell.
 * - Structured outputs, such as Learning Hub and Test Builder, can be translated at data level
 *   and re-rendered by the host activity so quiz logic is not broken.
 */
(function () {
    const DEFAULT_TRANSLATION_ENDPOINT = '/api/translate-answer';
    const STRUCTURED_QUIZ_BATCH_SIZE = 2;

    const DEFAULT_LANGUAGES = [
        { code: 'af', label: 'Afrikaans', speechLang: 'af-ZA' },
        { code: 'zu', label: 'isiZulu', speechLang: 'zu-ZA' },
        { code: 'xh', label: 'isiXhosa', speechLang: 'xh-ZA' },
        { code: 'st', label: 'Sesotho', speechLang: 'st-ZA' },
        { code: 'fr', label: 'French', speechLang: 'fr-FR' },
        { code: 'pt', label: 'Portuguese', speechLang: 'pt-PT' },
        { code: 'es', label: 'Spanish', speechLang: 'es-ES' }
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

    function getElement(value) {
        return typeof value === 'string' ? document.querySelector(value) : value;
    }

    function setButtonBusy(button, isBusy, busyText, normalText) {
        if (!button) return;
        button.disabled = isBusy;
        button.textContent = isBusy ? busyText : normalText;
    }

    function getFriendlyTranslationError(response, rawBody) {
        const trimmedBody = String(rawBody || '').trim();
        const endpointHint = 'Translation service did not return JSON. Check that /api/translate-answer is deployed and accessible.';

        if (trimmedBody.startsWith('<')) {
            if (response.status === 404) {
                return 'Translation service was not found. Netlify may not have deployed the translate-answer function yet.';
            }
            if (response.status >= 500) {
                return 'Translation service returned a server error page. Check the Netlify function logs for translate-answer.';
            }
            return endpointHint;
        }

        return `Translation service returned an unexpected response${response.status ? ` (${response.status})` : ''}.`;
    }

    function speakText(text, options = {}) {
        if (!('speechSynthesis' in window)) {
            if (typeof options.onError === 'function') {
                options.onError('Read aloud is not available in this browser.');
            }
            return false;
        }

        if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            if (typeof options.onStop === 'function') options.onStop();
            return 'stopped';
        }

        const cleanText = String(text || '').trim();
        if (!cleanText) {
            if (typeof options.onError === 'function') {
                options.onError('There is no text to read aloud.');
            }
            return false;
        }

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.rate = options.rate || 0.95;
        utterance.pitch = options.pitch || 1;
        utterance.lang = options.lang || 'en-ZA';

        utterance.onstart = () => {
            if (typeof options.onStart === 'function') options.onStart();
        };

        utterance.onend = () => {
            if (typeof options.onEnd === 'function') options.onEnd();
        };

        utterance.onerror = () => {
            if (typeof options.onError === 'function') {
                options.onError('There was a problem using read aloud.');
            }
        };

        window.speechSynthesis.speak(utterance);
        return true;
    }

    function stringifyStructuredContent(content) {
        try {
            return JSON.stringify(content || {}, null, 2);
        } catch (error) {
            return String(content || '');
        }
    }

    function cleanMarkdownText(value) {
        return String(value || '')
            .replace(/```[\s\S]*?```/g, match => match.replace(/```/g, ''))
            .replace(/\r\n/g, '\n')
            .replace(/^\s*#{1,6}\s+/gm, '')
            .replace(/\*\*(.*?)\*\*/g, '$1')
            .replace(/__(.*?)__/g, '$1')
            .replace(/^\s*[-*]\s+/gm, '• ')
            .trim();
    }

    function splitTextIntoTranslationBlocks(value) {
        const text = cleanMarkdownText(value)
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        if (!text) return [];

        const paragraphBlocks = text
            .split(/\n{2,}/)
            .map(block => block.trim())
            .filter(Boolean);

        if (paragraphBlocks.length > 1) return paragraphBlocks;

        const lineBlocks = text
            .split('\n')
            .map(block => block.trim())
            .filter(Boolean);

        if (lineBlocks.length > 1) return lineBlocks;

        // Add gentle breaks before common lesson-style headings if the text came back as one long block.
        const headingSplit = text
            .replace(/\s+(Hier is|Hoe werk|Waarom is|Wat gebeur|Voorbeeld|Onthou|Kortliks|In kort|Now you try|Quick check|Why does|How does|What is)\b/g, '\n\n$1')
            .split(/\n{2,}/)
            .map(block => block.trim())
            .filter(Boolean);

        return headingSplit.length > 1 ? headingSplit : [text];
    }

    function isMeaningfulElement(element) {
        if (!element || !element.tagName) return false;
        const tag = element.tagName.toLowerCase();
        if (['script', 'style', 'svg', 'button', 'select', 'label', 'input', 'textarea'].includes(tag)) return false;
        const text = cleanMarkdownText(element.innerText || element.textContent || '');
        return Boolean(text);
    }

    function collectSemanticBlocks(element) {
        const clone = element.cloneNode(true);
        clone.querySelectorAll('script, style, svg, button, select, label, input, textarea').forEach(node => node.remove());

        const semanticSelector = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre';
        const semanticNodes = Array.from(clone.querySelectorAll(semanticSelector))
            .filter(isMeaningfulElement);

        if (semanticNodes.length > 1) {
            return semanticNodes
                .map(node => cleanMarkdownText(node.innerText || node.textContent || ''))
                .filter(Boolean);
        }

        const directChildren = Array.from(clone.children).filter(isMeaningfulElement);
        if (directChildren.length > 1) {
            return directChildren
                .map(child => cleanMarkdownText(child.innerText || child.textContent || ''))
                .filter(Boolean);
        }

        return splitTextIntoTranslationBlocks(clone.innerText || clone.textContent || '');
    }

    function extractBlockGroupsFromHtml(html, selector = '.prose') {
        const temp = document.createElement('div');
        temp.innerHTML = html || '';
        const blockElements = Array.from(temp.querySelectorAll(selector));

        if (!blockElements.length) {
            const fallbackBlocks = splitTextIntoTranslationBlocks(stripHtml(html));
            return {
                flatBlocks: fallbackBlocks,
                groups: fallbackBlocks.length ? [{ index: 0, count: fallbackBlocks.length }] : []
            };
        }

        const groups = [];
        const flatBlocks = [];

        blockElements.forEach((element, index) => {
            const blocks = collectSemanticBlocks(element);
            groups.push({ index, count: blocks.length });
            flatBlocks.push(...blocks);
        });

        return { flatBlocks, groups };
    }

    function extractBlocksFromHtml(html, selector = '.prose') {
        return extractBlockGroupsFromHtml(html, selector).flatBlocks;
    }

    function renderTranslatedChunk(chunk) {
        const lines = cleanMarkdownText(chunk)
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean);

        if (!lines.length) return '';

        // Keep numbered or bullet lines visually separate, but do not try to turn them into interactive markup.
        if (lines.length > 1) {
            return `<div class="space-y-2">${lines.map(line => `<p class="m-0">${escapeHtml(line)}</p>`).join('')}</div>`;
        }

        return `<p class="m-0 leading-relaxed">${escapeHtml(lines[0])}</p>`;
    }

    function renderTranslatedChunks(chunks = []) {
        const html = chunks
            .map(chunk => String(chunk || '').trim())
            .filter(Boolean)
            .map(chunk => `<div class="mb-4 last:mb-0">${renderTranslatedChunk(chunk)}</div>`)
            .join('');

        return `<div class="space-y-4">${html}</div>`;
    }

    function plainTextToHtml(value) {
        const chunks = splitTextIntoTranslationBlocks(value);
        return renderTranslatedChunks(chunks);
    }

    function applyTranslatedBlocksToHtmlShell(originalHtml, translatedBlocks = [], selector = '.prose', blockGroups = []) {
        const temp = document.createElement('div');
        temp.innerHTML = originalHtml || '';
        const blockElements = Array.from(temp.querySelectorAll(selector));

        if (!blockElements.length || !translatedBlocks.length) {
            return plainTextToHtml(translatedBlocks.join('\n\n'));
        }

        let cursor = 0;

        blockElements.forEach((element, index) => {
            const group = blockGroups.find(item => item.index === index);
            const count = group?.count || 1;
            let translatedChunks = translatedBlocks
                .slice(cursor, cursor + count)
                .map(block => String(block || '').trim())
                .filter(Boolean);

            cursor += count;

            if (!translatedChunks.length) return;

            // If the model merged the translated response into one item, split it again for readability.
            if (translatedChunks.length === 1 && count > 1) {
                translatedChunks = splitTextIntoTranslationBlocks(translatedChunks[0]);
            }

            element.innerHTML = renderTranslatedChunks(translatedChunks);
        });

        return temp.innerHTML;
    }

    async function translateContent(options) {
        const isStructured = options.mode === 'structured' || options.translationMode === 'structured' || Boolean(options.structuredContent);
        const textBlocks = Array.isArray(options.textBlocks) ? options.textBlocks : [];

        const response = await fetch(options.translationEndpoint || DEFAULT_TRANSLATION_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: isStructured ? 'structured' : 'text',
                text: options.text || '',
                textBlocks: isStructured ? undefined : textBlocks,
                html: options.html || '',
                structuredContent: isStructured ? (options.structuredContent || {}) : undefined,
                structureInstructions: options.structureInstructions || '',
                targetLanguage: options.targetLanguage || 'Afrikaans',
                targetLanguageCode: options.targetLanguageCode || 'af',
                subject: options.subject || '',
                topic: options.topic || '',
                grade: options.grade || '',
                sourceTool: options.sourceTool || ''
            })
        });

        const rawBody = await response.text();
        let data;

        try {
            data = rawBody ? JSON.parse(rawBody) : {};
        } catch (error) {
            throw new Error(getFriendlyTranslationError(response, rawBody));
        }

        if (!response.ok) {
            throw new Error(data.error || 'Translation failed.');
        }

        return {
            mode: data.mode || (isStructured ? 'structured' : 'text'),
            translatedText: data.translatedText || stripHtml(data.translatedHtml || ''),
            translatedHtml: data.translatedHtml || escapeHtml(data.translatedText || '').replace(/\n/g, '<br>'),
            translatedBlocks: Array.isArray(data.translatedBlocks) ? data.translatedBlocks : [],
            translatedContent: data.translatedContent || null,
            targetLanguage: data.targetLanguage || options.targetLanguage,
            targetLanguageCode: data.targetLanguageCode || options.targetLanguageCode
        };
    }

    function cloneStructuredContent(value) {
        try {
            return JSON.parse(JSON.stringify(value || {}));
        } catch (error) {
            return {};
        }
    }

    function chunkArray(items = [], size = STRUCTURED_QUIZ_BATCH_SIZE) {
        const chunks = [];

        for (let index = 0; index < items.length; index += size) {
            chunks.push({
                startIndex: index,
                items: items.slice(index, index + size)
            });
        }

        return chunks;
    }

    function createStructuredTranslationChunks(originalContent, sourceTool) {
        const content = originalContent || {};
        const tool = String(sourceTool || '').toLowerCase();
        const chunks = [];

        if (tool === 'learninghub') {
            if (content.learning_objectives) {
                chunks.push({
                    label: 'learning objectives',
                    type: 'learning_objectives',
                    content: {
                        learning_objectives: content.learning_objectives
                    }
                });
            }

            if (content.revision_notes) {
                chunks.push({
                    label: 'revision notes',
                    type: 'revision_notes',
                    content: {
                        revision_notes: content.revision_notes
                    }
                });
            }

            const practiceTest = Array.isArray(content.practice_test) ? content.practice_test : [];
            chunkArray(practiceTest).forEach(batch => {
                chunks.push({
                    label: `practice questions ${batch.startIndex + 1}-${batch.startIndex + batch.items.length}`,
                    type: 'practice_test',
                    startIndex: batch.startIndex,
                    content: {
                        practice_test: batch.items
                    }
                });
            });

            return chunks.length ? chunks : [{ label: 'Learning Hub content', type: 'full', content }];
        }

        if (tool === 'testbuilder') {
            const practiceTest = Array.isArray(content.practice_test) ? content.practice_test : [];
            chunkArray(practiceTest).forEach(batch => {
                chunks.push({
                    label: `test questions ${batch.startIndex + 1}-${batch.startIndex + batch.items.length}`,
                    type: 'practice_test',
                    startIndex: batch.startIndex,
                    content: {
                        practice_test: batch.items
                    }
                });
            });

            return chunks.length ? chunks : [{ label: 'Test Builder content', type: 'full', content }];
        }

        return [{ label: 'structured content', type: 'full', content }];
    }

    function mergeStructuredTranslationChunk(target, chunk, translatedContent) {
        if (!translatedContent || typeof translatedContent !== 'object') return;

        if (chunk.type === 'learning_objectives' && Object.prototype.hasOwnProperty.call(translatedContent, 'learning_objectives')) {
            target.learning_objectives = translatedContent.learning_objectives;
            return;
        }

        if (chunk.type === 'revision_notes' && Object.prototype.hasOwnProperty.call(translatedContent, 'revision_notes')) {
            target.revision_notes = translatedContent.revision_notes;
            return;
        }

        if (chunk.type === 'practice_test' && Array.isArray(translatedContent.practice_test)) {
            if (!Array.isArray(target.practice_test)) target.practice_test = [];

            translatedContent.practice_test.forEach((question, offset) => {
                target.practice_test[chunk.startIndex + offset] = question;
            });

            return;
        }

        Object.assign(target, translatedContent);
    }

    async function translateStructuredContentInChunks({
        originalContent,
        sourceTool,
        baseOptions,
        onProgress
    }) {
        const chunks = createStructuredTranslationChunks(originalContent, sourceTool);

        if (chunks.length <= 1) {
            return translateContent({
                ...baseOptions,
                mode: 'structured',
                structuredContent: originalContent
            });
        }

        const translatedContent = cloneStructuredContent(originalContent);
        const translatedTextParts = [];

        for (let index = 0; index < chunks.length; index += 1) {
            const chunk = chunks[index];

            if (typeof onProgress === 'function') {
                onProgress(`Translating ${chunk.label} (${index + 1}/${chunks.length})…`);
            }

            const result = await translateContent({
                ...baseOptions,
                mode: 'structured',
                structuredContent: chunk.content,
                structureInstructions: `
${baseOptions.structureInstructions || ''}

You are translating one smaller chunk of a larger structured output.
Preserve only the keys that are present in this chunk.
Do not add missing keys from the larger object.
Return the same chunk structure you received.
                `.trim()
            });

            mergeStructuredTranslationChunk(translatedContent, chunk, result.translatedContent);

            if (result.translatedText) {
                translatedTextParts.push(result.translatedText);
            }
        }

        return {
            mode: 'structured',
            translatedContent,
            translatedText: translatedTextParts.join('\n\n'),
            translatedHtml: ''
        };
    }

    function createOutputToolbar(options) {
        const config = {
            mount: null,
            contentElement: null,
            originalHtml: '',
            originalText: '',
            originalContent: null,
            getOriginalContent: null,
            subject: '',
            topic: '',
            grade: '',
            sourceTool: '',
            defaultLanguage: 'af',
            languages: DEFAULT_LANGUAGES,
            translationEndpoint: DEFAULT_TRANSLATION_ENDPOINT,
            translationMode: 'text',
            contentBlockSelector: '.prose',
            structureInstructions: '',
            showCopy: false,
            showTranslate: true,
            onViewChanged: null,
            onTranslated: null,
            onStatus: null,
            onRenderOriginal: null,
            onRenderTranslated: null,
            onBeforeViewChange: null,
            ...options
        };

        const mount = getElement(config.mount);
        const contentElement = getElement(config.contentElement);

        if (!mount) throw new Error('Output toolbar mount element was not found.');
        if (!contentElement) throw new Error('Output toolbar content element was not found.');

        const isStructuredMode = config.translationMode === 'structured';
        const originalHtml = config.originalHtml || escapeHtml(config.originalText || '').replace(/\n/g, '<br>');
        const originalBlockData = !isStructuredMode
            ? extractBlockGroupsFromHtml(originalHtml, config.contentBlockSelector)
            : { flatBlocks: [], groups: [] };
        const originalBlocks = originalBlockData.flatBlocks;
        const originalBlockGroups = originalBlockData.groups;
        const originalText = config.originalText || (originalBlocks.length ? originalBlocks.join('\n\n') : stripHtml(originalHtml));

        const state = {
            originalHtml,
            originalText,
            originalBlocks,
            originalBlockGroups,
            originalContent: config.originalContent || null,
            translatedHtml: '',
            translatedText: '',
            translatedBlocks: [],
            translatedContent: null,
            currentView: 'original',
            selectedLanguage: config.defaultLanguage,
            isTranslating: false,
            translationMode: config.translationMode
        };

        function status(message, type = 'info') {
            const statusEl = mount.querySelector('[data-answer-toolbar-status]');
            if (statusEl) {
                const colours = {
                    info: 'text-slate-500',
                    success: 'text-emerald-600',
                    error: 'text-rose-600'
                };
                statusEl.className = `text-sm min-h-5 ${colours[type] || colours.info}`;
                statusEl.textContent = message || '';
            }

            if (typeof config.onStatus === 'function') {
                config.onStatus(message, type);
            }
        }

        function getCurrentText() {
            if (state.currentView === 'translated') {
                return state.translatedBlocks.length ? state.translatedBlocks.join('\n\n') : state.translatedText;
            }
            if (isStructuredMode && state.originalContent) return stringifyStructuredContent(state.originalContent);
            return state.originalText;
        }

        function getFreshOriginalContent() {
            if (typeof config.getOriginalContent === 'function') {
                const freshContent = config.getOriginalContent();
                if (freshContent) state.originalContent = freshContent;
            }
            return state.originalContent || config.originalContent || null;
        }

        function renderContent() {
            if (typeof config.onBeforeViewChange === 'function') {
                config.onBeforeViewChange({ ...state });
            }

            if (isStructuredMode) {
                if (state.currentView === 'translated' && typeof config.onRenderTranslated === 'function') {
                    config.onRenderTranslated({
                        contentElement,
                        translatedContent: state.translatedContent,
                        translatedText: state.translatedText,
                        translatedHtml: state.translatedHtml,
                        languageCode: state.selectedLanguage,
                        languageLabel: normaliseLanguageLabel(state.selectedLanguage, config.languages),
                        state: { ...state }
                    });
                } else if (state.currentView === 'original' && typeof config.onRenderOriginal === 'function') {
                    config.onRenderOriginal({
                        contentElement,
                        originalContent: state.originalContent,
                        originalText: state.originalText,
                        originalHtml: state.originalHtml,
                        state: { ...state }
                    });
                } else {
                    contentElement.innerHTML = state.currentView === 'translated'
                        ? (state.translatedHtml || escapeHtml(state.translatedText || '').replace(/\n/g, '<br>'))
                        : state.originalHtml;
                }
            } else {
                contentElement.innerHTML = state.currentView === 'translated'
                    ? state.translatedHtml
                    : state.originalHtml;
            }

            const originalButton = mount.querySelector('[data-answer-toolbar-view="original"]');
            const translatedButton = mount.querySelector('[data-answer-toolbar-view="translated"]');
            const noteEl = mount.querySelector('[data-answer-toolbar-note]');

            if (originalButton) {
                originalButton.classList.toggle('bg-indigo-600', state.currentView === 'original');
                originalButton.classList.toggle('text-white', state.currentView === 'original');
                originalButton.classList.toggle('bg-slate-100', state.currentView !== 'original');
                originalButton.classList.toggle('text-slate-700', state.currentView !== 'original');
            }

            if (translatedButton) {
                const hasTranslation = isStructuredMode ? Boolean(state.translatedContent) : Boolean(state.translatedHtml);
                translatedButton.disabled = !hasTranslation;
                translatedButton.classList.toggle('bg-indigo-600', state.currentView === 'translated');
                translatedButton.classList.toggle('text-white', state.currentView === 'translated');
                translatedButton.classList.toggle('bg-slate-100', state.currentView !== 'translated');
                translatedButton.classList.toggle('text-slate-700', state.currentView !== 'translated');
                translatedButton.classList.toggle('opacity-50', !hasTranslation);
                translatedButton.textContent = hasTranslation
                    ? normaliseLanguageLabel(state.selectedLanguage, config.languages)
                    : 'Translated';
            }

            if (noteEl) {
                const hasTranslation = isStructuredMode ? Boolean(state.translatedContent) : Boolean(state.translatedHtml);
                noteEl.classList.toggle('hidden', !(hasTranslation && state.currentView === 'translated'));
            }

            if (typeof config.onViewChanged === 'function') {
                config.onViewChanged({ ...state });
            }
        }

        async function copyOutput() {
            try {
                await navigator.clipboard.writeText(getCurrentText());
                status('Copied to clipboard.', 'success');
            } catch (error) {
                status('Could not copy this answer. Please select the text manually.', 'error');
            }
        }

        async function translateOutput() {
            if (state.isTranslating) return;

            const select = mount.querySelector('[data-answer-toolbar-language]');
            state.selectedLanguage = select?.value || state.selectedLanguage;

            const targetLanguage = normaliseLanguageLabel(state.selectedLanguage, config.languages);
            const button = mount.querySelector('[data-answer-toolbar-action="translate"]');

            state.isTranslating = true;
            setButtonBusy(button, true, 'Translating…', 'Translate');
            status(`Translating to ${targetLanguage}…`, 'info');

            try {
                const originalContent = isStructuredMode ? getFreshOriginalContent() : null;
                const baseTranslationOptions = {
                    text: isStructuredMode ? stringifyStructuredContent(originalContent) : state.originalText,
                    textBlocks: isStructuredMode ? [] : state.originalBlocks,
                    html: isStructuredMode ? '' : state.originalHtml,
                    structuredContent: originalContent,
                    structureInstructions: config.structureInstructions,
                    targetLanguage,
                    targetLanguageCode: state.selectedLanguage,
                    subject: config.subject,
                    topic: config.topic,
                    grade: config.grade,
                    sourceTool: config.sourceTool,
                    translationEndpoint: config.translationEndpoint
                };

                const result = isStructuredMode
                    ? await translateStructuredContentInChunks({
                        originalContent,
                        sourceTool: config.sourceTool,
                        baseOptions: baseTranslationOptions,
                        onProgress: message => status(message, 'info')
                    })
                    : await translateContent({
                        ...baseTranslationOptions,
                        mode: 'text'
                    });

                state.translatedBlocks = result.translatedBlocks || [];
                state.translatedText = result.translatedText || state.translatedBlocks.join('\n\n');
                state.translatedContent = result.translatedContent;

                if (!isStructuredMode && state.originalBlocks.length && state.translatedBlocks.length) {
                    state.translatedHtml = applyTranslatedBlocksToHtmlShell(
                        state.originalHtml,
                        state.translatedBlocks,
                        config.contentBlockSelector,
                        state.originalBlockGroups
                    );
                } else {
                    state.translatedHtml = result.translatedHtml;
                }

                state.currentView = 'translated';

                renderContent();
                status(`Translated to ${targetLanguage}.`, 'success');

                if (typeof config.onTranslated === 'function') {
                    config.onTranslated({
                        languageCode: state.selectedLanguage,
                        languageLabel: targetLanguage,
                        translatedText: state.translatedText,
                        translatedHtml: state.translatedHtml,
                        translatedBlocks: state.translatedBlocks,
                        translatedContent: state.translatedContent,
                        mode: isStructuredMode ? 'structured' : 'text'
                    });
                }
            } catch (error) {
                status(error.message || 'Translation failed. Please try again.', 'error');
            } finally {
                state.isTranslating = false;
                setButtonBusy(button, false, 'Translating…', 'Translate');
            }
        }

        function setView(view) {
            const nextView = view === 'translated' ? 'translated' : 'original';
            const hasTranslation = isStructuredMode ? Boolean(state.translatedContent) : Boolean(state.translatedHtml);
            if (nextView === 'translated' && !hasTranslation) return;
            state.currentView = nextView;
            renderContent();
            status('', 'info');
        }

        function renderToolbar() {
            mount.innerHTML = `
                <div class="bg-white border border-slate-200 rounded-2xl shadow-sm px-4 py-3">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div class="flex items-center gap-2">
                            <button type="button" data-answer-toolbar-view="original" class="rounded-full px-3 py-1.5 text-sm font-semibold bg-indigo-600 text-white">Original</button>
                            <button type="button" data-answer-toolbar-view="translated" class="rounded-full px-3 py-1.5 text-sm font-semibold bg-slate-100 text-slate-700 opacity-50" disabled>Translated</button>
                        </div>

                        <div class="flex flex-col sm:flex-row sm:items-center gap-2">
                            ${config.showTranslate ? `
                                <div class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2">
                                    <label class="text-sm font-semibold text-slate-600" for="answer-toolbar-language">Translate to</label>
                                    <select id="answer-toolbar-language" data-answer-toolbar-language class="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                        ${renderLanguageOptions(config.languages, config.defaultLanguage)}
                                    </select>
                                    <button type="button" data-answer-toolbar-action="translate" class="rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">Translate</button>
                                </div>
                            ` : ''}

                            ${config.showCopy ? `
                                <button type="button" data-answer-toolbar-action="copy" class="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200">Copy full answer</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="mt-2 space-y-1">
                        <p data-answer-toolbar-status class="text-sm min-h-5 text-slate-500"></p>
                        <p data-answer-toolbar-note class="hidden text-xs text-slate-500">Translation may vary. Check important details against the original answer.</p>
                    </div>
                </div>
            `;
        }

        function bindEvents() {
            mount.addEventListener('click', event => {
                const viewButton = event.target.closest('[data-answer-toolbar-view]');
                const actionButton = event.target.closest('[data-answer-toolbar-action]');

                if (viewButton) {
                    setView(viewButton.dataset.answerToolbarView);
                }

                if (actionButton) {
                    const action = actionButton.dataset.answerToolbarAction;
                    if (action === 'translate') translateOutput();
                    if (action === 'copy') copyOutput();
                }
            });
        }

        renderToolbar();
        renderContent();
        bindEvents();

        return {
            translate: translateOutput,
            copy: copyOutput,
            setView,
            getState() {
                return { ...state };
            },
            destroy() {
                mount.innerHTML = '';
            }
        };
    }

    function attachSectionReadAloud(options) {
        const config = {
            button: null,
            text: '',
            lang: 'en-ZA',
            readingText: 'Stop',
            idleText: 'Read aloud',
            onStatus: null,
            ...options
        };

        const button = getElement(config.button);
        if (!button) throw new Error('Section read aloud button was not found.');

        const setIdle = () => {
            button.disabled = false;
            button.textContent = config.idleText;
        };

        const setReading = () => {
            button.disabled = false;
            button.textContent = config.readingText;
        };

        button.addEventListener('click', () => {
            speakText(config.text, {
                lang: config.lang,
                onStart: () => {
                    setReading();
                    if (typeof config.onStatus === 'function') config.onStatus('Reading section aloud…', 'info');
                },
                onStop: () => {
                    setIdle();
                    if (typeof config.onStatus === 'function') config.onStatus('Read aloud stopped.', 'info');
                },
                onEnd: () => {
                    setIdle();
                    if (typeof config.onStatus === 'function') config.onStatus('', 'info');
                },
                onError: message => {
                    setIdle();
                    if (typeof config.onStatus === 'function') config.onStatus(message, 'error');
                }
            });
        });

        return {
            destroy() {
                if ('speechSynthesis' in window) window.speechSynthesis.cancel();
                setIdle();
            }
        };
    }

    function createAnswerTools(options) {
        const config = {
            toolbarMount: null,
            contentElement: null,
            sections: [],
            ...options
        };

        const toolbar = createOutputToolbar({
            mount: config.toolbarMount,
            contentElement: config.contentElement,
            ...config
        });

        const sectionTools = config.sections.map(section => attachSectionReadAloud(section));

        return {
            toolbar,
            sectionTools,
            destroy() {
                toolbar.destroy();
                sectionTools.forEach(tool => tool.destroy());
            }
        };
    }

    window.LearnerGenieAnswerTools = {
        createOutputToolbar,
        attachSectionReadAloud,
        createAnswerTools,
        speakText,
        translateContent
    };
})();