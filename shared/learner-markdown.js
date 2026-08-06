/*
 * LearnerGenie - safe Markdown-like formatter patch
 *
 * Loaded after shared/learner-output.js. It replaces only createSectionHTML
 * while preserving the existing translation and text-to-speech interfaces.
 */
(function () {
    if (!window.LearnerOutput || typeof window.LearnerOutput.createSectionHTML !== 'function') {
        console.error('LearnerMarkdown: learner-output.js must be loaded first.');
        return;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function renderInline(value) {
        const codeTokens = [];
        let text = String(value ?? '').replace(/`([^`]+)`/g, (_, code) => {
            const token = `@@LG_CODE_${codeTokens.length}@@`;
            codeTokens.push(`<code class="px-1.5 py-0.5 rounded bg-gray-100 text-gray-800 text-[0.92em]">${escapeHtml(code)}</code>`);
            return token;
        });

        text = escapeHtml(text)
            .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-gray-800">$1</strong>')
            .replace(/__([^_]+)__/g, '<strong class="font-semibold text-gray-800">$1</strong>')
            .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
            .replace(/(^|[^_])_([^_\n]+)_(?!_)/g, '$1<em>$2</em>');

        codeTokens.forEach((html, index) => {
            text = text.replace(`@@LG_CODE_${index}@@`, html);
        });

        return text;
    }

    function renderMarkdown(value) {
        const lines = String(value ?? '')
            .replace(/\r\n?/g, '\n')
            .replace(/^```[^\n]*\n?/gm, '')
            .replace(/^```\s*$/gm, '')
            .split('\n');

        const output = [];
        let paragraph = [];
        let listType = null;
        let listItems = [];

        const flushParagraph = () => {
            const text = paragraph.join(' ').trim();
            if (text) output.push(`<p class="my-3 leading-7">${renderInline(text)}</p>`);
            paragraph = [];
        };

        const flushList = () => {
            if (!listType || !listItems.length) {
                listType = null;
                listItems = [];
                return;
            }

            const tag = listType === 'ol' ? 'ol' : 'ul';
            const classes = listType === 'ol'
                ? 'list-decimal pl-6 my-4 space-y-2'
                : 'list-disc pl-6 my-4 space-y-2';

            output.push(`<${tag} class="${classes}">${listItems.map(item => `<li class="pl-1 leading-7">${renderInline(item)}</li>`).join('')}</${tag}>`);
            listType = null;
            listItems = [];
        };

        for (const rawLine of lines) {
            const line = rawLine.trim();

            if (!line) {
                flushParagraph();
                flushList();
                continue;
            }

            if (/^#{1,6}$/.test(line)) {
                flushParagraph();
                flushList();
                continue;
            }

            const heading = line.match(/^(#{1,6})\s+(.+)$/);
            if (heading) {
                flushParagraph();
                flushList();
                const level = Math.min(heading[1].length + 2, 6);
                const classes = heading[1].length === 1
                    ? 'text-xl font-bold text-gray-900 mt-6 mb-2'
                    : 'text-lg font-semibold text-gray-800 mt-5 mb-2';
                output.push(`<h${level} class="${classes}">${renderInline(heading[2])}</h${level}>`);
                continue;
            }

            const ordered = line.match(/^\d+[.)]\s+(.+)$/);
            if (ordered) {
                flushParagraph();
                if (listType && listType !== 'ol') flushList();
                listType = 'ol';
                listItems.push(ordered[1]);
                continue;
            }

            const unordered = line.match(/^[-+*]\s+(.+)$/);
            if (unordered) {
                flushParagraph();
                if (listType && listType !== 'ul') flushList();
                listType = 'ul';
                listItems.push(unordered[1]);
                continue;
            }

            if (listType && listItems.length) {
                listItems[listItems.length - 1] += ` ${line}`;
                continue;
            }

            paragraph.push(line);
        }

        flushParagraph();
        flushList();

        return output.join('') || '<p class="my-3 leading-7">No content provided.</p>';
    }

    function formatContent(item) {
        if (typeof item === 'string') return renderMarkdown(item);

        if (Array.isArray(item)) {
            return `<ol class="list-decimal pl-6 my-4 space-y-2">${item.map(value => `<li class="pl-1 leading-7">${typeof value === 'string' ? renderInline(value) : formatContent(value)}</li>`).join('')}</ol>`;
        }

        if (typeof item === 'object' && item !== null) {
            return `<ul class="space-y-3 my-3">${Object.entries(item).map(([key, value]) => `<li><strong class="font-semibold text-gray-800">${escapeHtml(key)}:</strong> ${formatContent(value)}</li>`).join('')}</ul>`;
        }

        if (item === null || item === undefined || item === '') {
            return '<p class="my-3 leading-7">No content provided.</p>';
        }

        return renderMarkdown(String(item));
    }

    function createSectionHTML(icon, color, title, content) {
        const sectionId = 'section-' + Math.random().toString(36).substr(2, 9);
        const textContent = formatContent(content);

        return `<div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 break-inside-avoid">
            <div class="flex items-center justify-between mb-3">
                <h3 class="text-lg font-semibold text-gray-800 flex items-center">
                    <i data-lucide="${escapeHtml(icon)}" class="text-${escapeHtml(color)}-500"></i>
                    <span class="ml-2">${escapeHtml(title)}</span>
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

    window.LearnerOutput.renderMarkdown = renderMarkdown;
    window.LearnerOutput.createSectionHTML = createSectionHTML;
})();
