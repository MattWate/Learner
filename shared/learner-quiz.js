/*
 * LearnerGenie - shared quiz module
 *
 * Extracted from app.html: shuffleArray, renderPracticeTest, and
 * handleQuizSubmit. Behavior is unchanged - same markup, same AI semantic
 * marking for short answers, same scoring.
 *
 * Difference from app.html: instead of reading/writing the global
 * `state.currentTest`, the current test data is passed in explicitly by the
 * activity page. This makes the module reusable by both Learning Hub and
 * Test Builder without them sharing global state.
 *
 * Requires shared/learner-api.js (for AI marking of short answers).
 */
(function () {
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function renderPracticeTest(testData) {
        if (!testData || testData.length === 0) {
            return "<p class='text-sm text-gray-500'>No practice test could be generated for this topic.</p>";
        }

        let html = '<form id="quiz-form" class="space-y-6">';

        testData.forEach((question, index) => {
            html += `<div id="question-block-${index}" class="quiz-question-wrapper border-l-4 border-gray-200 p-4 rounded-r-lg">`;
            html += `<p class="font-semibold text-gray-800 mb-3">${index + 1}. ${question.question}</p>`;
            html += `<div class="space-y-2">`;

            if (question.type === 'MCQ' || question.type === 'TrueFalse') {
                shuffleArray(question.options);

                question.options.forEach((option) => {
                    html += `
                        <label class="flex items-center p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input type="radio" name="question_${index}" value="${option}" class="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500">
                            <span class="ml-3 text-sm text-gray-700">${option}</span>
                        </label>
                    `;
                });
            } else if (question.type === 'ShortAnswer') {
                html += `
                    <label>
                        <span class="text-sm font-medium text-gray-700 sr-only">Your Answer:</span>
                        <input type="text" name="question_${index}" class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="Type your answer here...">
                    </label>
                `;
            }
            html += `</div>`;
            html += `
                <div class="quiz-feedback correct">
                    <i data-lucide="check-circle" class="inline-block h-4 w-4 mr-1"></i>Correct!
                </div>
                <div class="quiz-feedback incorrect">
                    <i data-lucide="x-circle" class="inline-block h-4 w-4 mr-1"></i>Incorrect. The correct answer is: <strong>${question.correct_answer}</strong>
                </div>
                <div class="quiz-feedback-explanation text-xs italic mt-2 text-indigo-600 hidden"></div>
            `;
            html += `</div>`;
        });

        html += `<button id="submit-quiz-btn" type="submit" class="w-full bg-green-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-green-700 flex items-center justify-center disabled:bg-green-300"><i data-lucide="check" class="w-5 h-5 mr-2"></i>Check My Answers</button>`;
        html += '</form>';
        return html;
    }

    /**
     * Grades and marks up the on-screen quiz form against `currentTest`.
     * Same logic as app.html's handleQuizSubmit, parameterized instead of
     * reading global state.
     */
    async function submitQuiz(currentTest) {
        if (!currentTest || currentTest.length === 0) return;

        const btn = document.getElementById('submit-quiz-btn');
        const originalBtnText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div> Marking with AI...`;

        let correctCount = 0;

        for (let index = 0; index < currentTest.length; index++) {
            const question = currentTest[index];
            const questionBlock = document.getElementById(`question-block-${index}`);
            const feedbackExpEl = questionBlock.querySelector('.quiz-feedback-explanation');
            let userAnswer;
            let isCorrect = false;

            if (question.type === 'MCQ' || question.type === 'TrueFalse') {
                const selectedOption = document.querySelector(`input[name="question_${index}"]:checked`);
                userAnswer = selectedOption ? selectedOption.value : null;
                isCorrect = userAnswer && userAnswer.toLowerCase() === question.correct_answer.toLowerCase();
            } else if (question.type === 'ShortAnswer') {
                userAnswer = document.querySelector(`input[name="question_${index}"]`).value.trim();

                if (userAnswer) {
                    const gradingPrompt = `You are an expert pedagogical assistant. Evaluate the following student answer.
                        Question: "${question.question}"
                        Correct Concept: "${question.correct_answer}"
                        Student Answer: "${userAnswer}"
                        Is the answer conceptually correct? Allow for minor spelling mistakes and different phrasing.
                        Reply ONLY with a JSON object: {"isCorrect": true/false, "explanation": "A very brief 1-sentence explanation why."}`;

                    try {
                        const resJson = await window.LearnerAPI.fetchWithRetry(gradingPrompt, true);
                        const evaluation = JSON.parse(resJson);
                        isCorrect = evaluation.isCorrect;

                        if (feedbackExpEl) {
                            feedbackExpEl.innerText = evaluation.explanation || evaluation.feedback || '';
                            if (evaluation.explanation || evaluation.feedback) {
                                feedbackExpEl.classList.remove('hidden');
                            } else {
                                feedbackExpEl.classList.add('hidden');
                            }
                        }
                    } catch (e) {
                        console.error('Semantic marking failed, falling back to basic match', e);
                        isCorrect = userAnswer.toLowerCase() === question.correct_answer.toLowerCase();
                    }
                }
            }

            if (isCorrect) {
                correctCount++;
                questionBlock.classList.add('correct');
                questionBlock.classList.remove('incorrect');
            } else {
                questionBlock.classList.add('incorrect');
                questionBlock.classList.remove('correct');
            }
        }

        const resultsDiv = document.getElementById('quiz-results');
        if (resultsDiv) {
            const percentage = Math.round((correctCount / currentTest.length) * 100);
            resultsDiv.innerHTML = `
                <div class="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg">
                    <p class="font-semibold text-indigo-900">Your Score: ${correctCount}/${currentTest.length} (${percentage}%)</p>
                </div>
            `;
        }

        btn.disabled = false;
        btn.innerHTML = originalBtnText;
        if (window.lucide?.createIcons) window.lucide.createIcons();
        document.getElementById('quiz-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /**
     * Attaches the submit handler to #quiz-form, if present on the page.
     * `getCurrentTest` is a function returning the current test-data array
     * at submit time (so it always grades against what's actually rendered).
     */
    function wireQuizForm(getCurrentTest) {
        const quizForm = document.getElementById('quiz-form');
        if (!quizForm) return;
        quizForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitQuiz(getCurrentTest());
        });
    }

    window.LearnerQuiz = {
        shuffleArray,
        renderPracticeTest,
        submitQuiz,
        wireQuizForm
    };
})();
