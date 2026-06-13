/*
 * LearnerGenie Explain Simply activity demo
 *
 * This is intentionally separate from app.html.
 * It proves the future pattern:
 * - activity module handles input + output sections
 * - Answer Tools handles global actions for the full output
 * - section read-aloud remains local to each section
 */
(function () {
    const form = document.getElementById('explain-form');
    const outputTitle = document.getElementById('output-title');
    const outputToolbar = document.getElementById('output-toolbar');
    const activityOutput = document.getElementById('activity-output');

    let toolbarController = null;
    let currentAnswer = null;

    function escapeHtml(value) {
        return window.LearnerGenieAnswerTools.escapeHtml(value);
    }

    function sectionCard(section, index) {
        const sectionId = `section-${index}`;
        const bodyHtml = section.body.map(paragraph => `<p class="text-slate-700 leading-relaxed">${escapeHtml(paragraph)}</p>`).join('');

        return `
            <section class="rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden" data-section-card="${sectionId}">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border-b border-slate-100 px-4 py-3">
                    <div class="flex items-center gap-3">
                        <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 font-black">${index + 1}</span>
                        <h3 class="text-lg font-black text-slate-950">${escapeHtml(section.heading)}</h3>
                    </div>
                    <button type="button" data-read-section="${sectionId}" class="w-fit rounded-xl bg-indigo-50 px-3 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100">
                        Read aloud
                    </button>
                </div>
                <div class="px-4 py-4 space-y-3">
                    ${bodyHtml}
                </div>
            </section>
        `;
    }

    function createDemoAnswer({ topic, grade, subject }) {
        const safeTopic = topic || 'this topic';

        return {
            title: `Explain Simply: ${safeTopic}`,
            topic: safeTopic,
            grade,
            subject,
            sections: [
                {
                    heading: `What is ${safeTopic}?`,
                    body: [
                        `${safeTopic} is a concept you can understand by breaking it into smaller parts instead of trying to memorise everything at once.`,
                        `In ${subject}, it helps to ask: what is happening, why does it happen, and what example can I use to remember it?`
                    ]
                },
                {
                    heading: 'A simple way to picture it',
                    body: [
                        `Imagine ${safeTopic} as a process with steps. Each step has a job, and the whole idea only makes sense when the steps work together.`,
                        `For example, when you revise, first look for the main idea, then the important words, then one real example.`
                    ]
                },
                {
                    heading: 'Why it matters',
                    body: [
                        `Understanding ${safeTopic} helps you answer questions in your own words instead of copying a definition.`,
                        `That is useful in tests because teachers often ask you to explain, compare, describe or give an example.`
                    ]
                },
                {
                    heading: 'Quick check',
                    body: [
                        `Can you explain ${safeTopic} to someone younger than you in two sentences?`,
                        `Can you give one example and one reason why it matters? If you can, you are starting to understand it properly.`
                    ]
                }
            ]
        };
    }

    function answerToHtml(answer) {
        return answer.sections.map((section, index) => sectionCard(section, index)).join('');
    }

    function answerToText(answer) {
        return answer.sections.map(section => {
            return `${section.heading}\n${section.body.join('\n')}`;
        }).join('\n\n');
    }

    function bindSectionReadButtons(answer) {
        answer.sections.forEach((section, index) => {
            const sectionId = `section-${index}`;
            const button = activityOutput.querySelector(`[data-read-section="${sectionId}"]`);
            const sectionText = `${section.heading}. ${section.body.join(' ')}`;

            if (!button) return;

            window.LearnerGenieAnswerTools.attachSectionReadAloud({
                button,
                text: sectionText,
                lang: 'en-ZA',
                idleText: 'Read aloud',
                readingText: 'Stop reading'
            });
        });
    }

    function renderActivity(answer) {
        currentAnswer = answer;

        if (toolbarController) {
            toolbarController.destroy();
            toolbarController = null;
        }

        const originalHtml = answerToHtml(answer);
        const originalText = answerToText(answer);

        outputTitle.textContent = answer.title;
        activityOutput.innerHTML = originalHtml;
        bindSectionReadButtons(answer);

        toolbarController = window.LearnerGenieAnswerTools.createOutputToolbar({
            mount: outputToolbar,
            contentElement: activityOutput,
            originalHtml,
            originalText,
            subject: answer.subject,
            topic: answer.topic,
            grade: answer.grade,
            sourceTool: 'Explain Simply Demo',
            defaultLanguage: 'af',
            onViewChanged: state => {
                if (state.currentView === 'original' && currentAnswer) {
                    bindSectionReadButtons(currentAnswer);
                }
            }
        });

        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    function handleSubmit(event) {
        event.preventDefault();

        const formData = new FormData(form);
        const topic = String(formData.get('topic') || '').trim();
        const grade = String(formData.get('grade') || 'Grade 7').trim();
        const subject = String(formData.get('subject') || 'General').trim();

        const answer = createDemoAnswer({ topic, grade, subject });
        renderActivity(answer);
    }

    form.addEventListener('submit', handleSubmit);

    renderActivity(createDemoAnswer({
        topic: 'Photosynthesis',
        grade: 'Grade 7',
        subject: 'Natural Sciences'
    }));
})();
