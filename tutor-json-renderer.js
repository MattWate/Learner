function safeJson(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text || !['{', '['].includes(text[0])) return value;
  try { return JSON.parse(text); } catch { return value; }
}

function titleCaseKey(key) {
  return String(key || '')
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function cleanDisplayText(value) {
  const text = ws(value);
  const spacedLetters = (text.match(/\b[a-zA-Z]\b/g) || []).length;
  const words = text.split(/\s+/).length;
  if (words > 8 && spacedLetters / words > 0.45) {
    return text.replace(/\b([A-Za-z])\s+(?=[A-Za-z]\b)/g, '$1');
  }
  return text;
}

function renderTextBlock(value) {
  const text = cleanDisplayText(value);
  if (!text) return '<p class="text-gray-400">No content</p>';
  return `<p class="text-gray-700 whitespace-pre-wrap leading-relaxed">${esc(text)}</p>`;
}

function renderOptions(options, correctAnswer) {
  if (!Array.isArray(options)) return '';
  return `<ul class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">${options.map(option => {
    const isCorrect = String(option).trim() === String(correctAnswer || '').trim();
    return `<li class="rounded-lg border ${isCorrect ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-100 bg-gray-50 text-gray-700'} px-3 py-2 text-sm">${esc(option)}${isCorrect ? ' ✓' : ''}</li>`;
  }).join('')}</ul>`;
}

function renderQuestionCard(item, index) {
  const question = item.question || item.prompt || item.text || item.statement || `Question ${index + 1}`;
  const answer = item.correct_answer || item.answer || item.correctAnswer || item.solution;
  const type = item.type || item.question_type || item.questionType;
  const explanation = item.explanation || item.reason || item.feedback;
  return `<div class="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
    <div class="flex items-start justify-between gap-3">
      <h4 class="font-bold text-gray-800">Question ${index + 1}</h4>
      ${type ? `<span class="text-xs font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">${esc(type)}</span>` : ''}
    </div>
    <div class="mt-2">${renderTextBlock(question)}</div>
    ${renderOptions(item.options || item.choices, answer)}
    ${answer ? `<div class="mt-3 rounded-lg bg-green-50 border border-green-100 p-3"><p class="text-sm font-bold text-green-800">Answer</p><p class="text-green-900">${esc(answer)}</p></div>` : ''}
    ${explanation ? `<div class="mt-3 rounded-lg bg-amber-50 border border-amber-100 p-3"><p class="text-sm font-bold text-amber-800">Explanation</p>${renderTextBlock(explanation)}</div>` : ''}
  </div>`;
}

function renderArray(labelText, array) {
  if (!array.length) return '';
  const looksLikeQuestions = array.some(item => item && typeof item === 'object' && (item.question || item.prompt || item.options || item.correct_answer || item.answer));
  if (looksLikeQuestions) {
    return `<section class="space-y-3"><h3 class="text-lg font-bold text-gray-800">${esc(titleCaseKey(labelText))}</h3>${array.map(renderQuestionCard).join('')}</section>`;
  }
  return `<section><h3 class="text-lg font-bold text-gray-800">${esc(titleCaseKey(labelText))}</h3><ul class="mt-2 space-y-2 list-disc pl-5 text-gray-700">${array.map(item => `<li>${typeof item === 'object' ? renderHumanValue(item) : esc(cleanDisplayText(item))}</li>`).join('')}</ul></section>`;
}

function renderHumanValue(value, key = 'Content') {
  const parsed = safeJson(value);
  if (parsed === null || parsed === undefined) return '<p class="text-gray-400">No content</p>';
  if (typeof parsed === 'string' || typeof parsed === 'number' || typeof parsed === 'boolean') return renderTextBlock(parsed);
  if (Array.isArray(parsed)) return renderArray(key, parsed);
  if (typeof parsed !== 'object') return renderTextBlock(String(parsed));

  const preferredTextKeys = ['summary', 'explanation', 'answer', 'content', 'notes', 'revision_notes', 'study_notes', 'feedback'];
  const sections = [];
  for (const textKey of preferredTextKeys) {
    if (parsed[textKey]) {
      sections.push(`<section><h3 class="text-lg font-bold text-gray-800">${esc(titleCaseKey(textKey))}</h3><div class="mt-2 rounded-lg bg-gray-50 p-4">${renderHumanValue(parsed[textKey], textKey)}</div></section>`);
    }
  }

  Object.entries(parsed).forEach(([k, v]) => {
    if (preferredTextKeys.includes(k)) return;
    if (Array.isArray(v)) sections.push(renderArray(k, v));
  });

  Object.entries(parsed).forEach(([k, v]) => {
    if (preferredTextKeys.includes(k) || Array.isArray(v)) return;
    sections.push(`<section><h3 class="text-lg font-bold text-gray-800">${esc(titleCaseKey(k))}</h3><div class="mt-2 rounded-lg bg-gray-50 p-4">${renderHumanValue(v, k)}</div></section>`);
  });

  return sections.length ? `<div class="space-y-5">${sections.join('')}</div>` : `<pre class="text-xs whitespace-pre-wrap bg-gray-50 p-3 rounded-lg overflow-auto max-h-72">${esc(JSON.stringify(parsed, null, 2))}</pre>`;
}

function valuePreview(v) {
  return renderHumanValue(v);
}

function openActivity(activityId) {
  const a = state.activity.find(x => Number(x.id) === Number(activityId));
  if (!a) return;
  const l = learnerById(a.profile_id);
  modalRoot.innerHTML = `<div class="fixed inset-0 z-50 modal-backdrop flex items-center justify-center p-4"><div class="bg-white w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"><div class="p-6 border-b flex justify-between gap-4"><div><p class="text-sm text-indigo-600 font-bold uppercase">Activity detail</p><h2 class="text-2xl font-bold text-gray-800">${esc(label(a.subject || a.work_type, 80))}</h2><p class="text-gray-500">${esc(l?.name || 'Learner')} · ${fmtDate(a.created_at)}</p></div><button id="close-modal" class="h-10 w-10 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><i data-lucide="x"></i></button></div><div class="p-6 space-y-6"><div><h3 class="font-bold text-gray-800">Topic</h3><p class="text-gray-700 whitespace-pre-wrap">${esc(cleanDisplayText(a.topic) || 'No topic tagged')}</p></div><div><h3 class="font-bold text-gray-800">Input</h3><div class="mt-2">${renderHumanValue(a.input_prompt, 'Input')}</div></div><div><h3 class="font-bold text-gray-800">Output</h3><div class="mt-2">${renderHumanValue(a.output_content, 'Output')}</div></div></div></div></div>`;
  document.getElementById('close-modal')?.addEventListener('click', closeModal);
  lucide.createIcons();
}
