/*
 * LearnerGenie App Answer Tools Bridge
 *
 * Purpose:
 * - Adds the standalone Answer Tools translation toolbar to selected existing app.html outputs.
 * - Keeps app.html generation logic mostly unchanged.
 * - Leaves section-level Read Aloud buttons exactly where they already are.
 *
 * Initial integration scope:
 * - Explain It Simply
 * - Homework Helper
 * - Mathematics Hub
 *
 * Learning Hub and Test Builder are intentionally skipped for now because they include
 * interactive quiz forms. We should integrate those deliberately later.
 */
(function () {
    const OUTPUT_CONFIGS = [
        {
            id: 'es-output',
            sourceTool: 'explainSimply',
            label: 'Explain It Simply',
            minTextLength: 40
        },
        {
            id: 'hh-output',
            sourceTool: 'homeworkHelper',
            label: 'Homework Helper',
            minTextLength: 40
        },
        {
            id: 'math-output',
            sourceTool: 'mathHub',
            label: 'Mathematics Hub',
            minTextLength: 40
        }
    ];

    const PLACEHOLDER_PHRASES = [
        'thinking',
        'analyzing',
        'analysing',
        'calculating',
        'generating',
        'building',
        'your test will appear here',
        'fill out the form above'
    ];

    function hasAnswerTools() {
        return Boolean(window.LearnerGenieAnswerTools?.createOutputToolbar);
    }

    function getText(element) {
        return (element?.innerText || element?.textContent || '').trim();
    }

    function looksLikePlaceholder(text) {
        const normalised = String(text || '').trim().toLowerCase();
        if (!normalised) return true;
        return PLACEHOLDER_PHRASES.some(phrase => normalised.includes(phrase));
    }

    function shouldAttach(container, config) {
        if (!container || container.dataset.answerToolsAttached === 'true') return false;
        if (container.querySelector('[data-answer-tools-app-toolbar]')) return false;

        const text = getText(container);
        if (text.length < config.minTextLength) return false;
        if (looksLikePlaceholder(text)) return false;

        // Skip interactive quizzes/forms for now.
        if (container.querySelector('form, input, select, textarea')) return false;

        return true;
    }

    function buildShell(existingHtml) {
        return `
            <div class="space-y-4" data-answer-tools-app-shell>
                <div data-answer-tools-app-toolbar></div>
                <div data-answer-tools-app-content>${existingHtml}</div>
            </div>
        `;
    }

    function attachToolbar(container, config) {
        if (!hasAnswerTools() || !shouldAttach(container, config)) return;

        const originalHtml = container.innerHTML;
        const originalText = getText(container);

        container.dataset.answerToolsAttached = 'true';
        container.innerHTML = buildShell(originalHtml);

        const toolbarMount = container.querySelector('[data-answer-tools-app-toolbar]');
        const contentElement = container.querySelector('[data-answer-tools-app-content]');

        try {
            window.LearnerGenieAnswerTools.createOutputToolbar({
                mount: toolbarMount,
                contentElement,
                originalHtml,
                originalText,
                sourceTool: config.sourceTool,
                defaultLanguage: 'af',
                showCopy: true,
                showTranslate: true,
                onViewChanged: () => {
                    if (window.lucide?.createIcons) window.lucide.createIcons();
                }
            });

            if (window.lucide?.createIcons) window.lucide.createIcons();
        } catch (error) {
            console.error('Could not attach Answer Tools toolbar:', error);
            container.dataset.answerToolsAttached = 'false';
            container.innerHTML = originalHtml;
        }
    }

    function watchOutput(config) {
        const container = document.getElementById(config.id);
        if (!container) return;

        let debounceTimer = null;

        const tryAttach = () => {
            window.clearTimeout(debounceTimer);
            debounceTimer = window.setTimeout(() => attachToolbar(container, config), 120);
        };

        const observer = new MutationObserver(() => {
            // When app.html replaces the output with new answer HTML, allow a fresh toolbar.
            if (!container.querySelector('[data-answer-tools-app-shell]')) {
                container.dataset.answerToolsAttached = 'false';
            }
            tryAttach();
        });

        observer.observe(container, { childList: true, subtree: false });
        tryAttach();
    }

    function initBridge() {
        if (!hasAnswerTools()) {
            console.warn('LearnerGenieAnswerTools was not found. Translation toolbar bridge skipped.');
            return;
        }

        OUTPUT_CONFIGS.forEach(watchOutput);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initBridge);
    } else {
        initBridge();
    }
})();
