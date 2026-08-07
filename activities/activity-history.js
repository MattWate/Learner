/* LearnerGenie Activity History */
(function () {
  const root = document.getElementById('page-root');
  const modalRoot = document.getElementById('history-modal-root');
  let rows = [];
  let activeType = 'all';
  let searchTerm = '';
  let sortOrder = 'newest';

  const escapeHtml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const typeMap = {
    homeworkHelp:['Homework Helper','life-buoy','coral','/activities/homework-help.html'],
    homeworkHelper:['Homework Helper','life-buoy','coral','/activities/homework-help.html'],
    explainSimply:['Explain It Simply','lightbulb','teal','/activities/explain-simply.html'],
    learningHub:['Revision Notes','book-open-check','navy','/activities/learning-hub.html'],
    revisionNotes:['Revision Notes','book-open-check','navy','/activities/learning-hub.html'],
    testBuilder:['Practice Test','clipboard-check','teal','/activities/test-builder.html'],
    mathHub:['Mathematics','calculator','gold','/activities/math-hub.html']
  };

  function meta(type) { return typeMap[type] || ['Learning activity','sparkles','teal','/app.html']; }
  function promptFor(row) {
    const input = row.input_prompt || {};
    return input.prompt || input.topic || input.question || input.title || inputPromptFallback(input) || 'Saved learning activity';
  }
  function inputPromptFallback(input) {
    if (typeof input === 'string') return input;
    if (!input || typeof input !== 'object') return '';
    const first = Object.values(input).find(value => typeof value === 'string' && value.trim());
    return first || '';
  }
  function formatDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  }
  function relativeDate(value) {
    if (!value) return '';
    const days = Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
    if (days <= 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return formatDate(value);
  }
  function isThisWeek(value) {
    const d = new Date(value); const now = new Date();
    const day = (now.getDay() + 6) % 7;
    const monday = new Date(now); monday.setHours(0,0,0,0); monday.setDate(now.getDate() - day);
    return d >= monday;
  }
  function labelKey(key) {
    return String(key || '').replace(/_/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./, c => c.toUpperCase());
  }
  function summaryText(row) {
    const out = row.output_content;
    if (!out) return 'Saved learning activity';
    const candidates = ['final_answer','answer','explanation','summary','overview','revision_notes','hints','breakdown'];
    for (const key of candidates) {
      const value = out?.[key];
      if (typeof value === 'string' && value.trim()) return value.replace(/\s+/g,' ').slice(0,120);
      if (Array.isArray(value) && typeof value[0] === 'string') return value[0].replace(/\s+/g,' ').slice(0,120);
    }
    return 'Open this saved activity to review the result.';
  }

  function statsHtml() {
    const total = rows.length;
    const weekly = rows.filter(row => isThisWeek(row.created_at)).length;
    const counts = rows.reduce((acc,row) => { const label = meta(row.work_type)[0]; acc[label]=(acc[label]||0)+1; return acc; },{});
    const favourite = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
    return `<section class="lg-history-summary">
      <div class="lg-history-stat is-teal"><span>Total saved activities</span><strong>${total}</strong></div>
      <div class="lg-history-stat"><span>This week</span><strong>${weekly}</strong></div>
      <div class="lg-history-stat is-gold"><span>Most used</span><strong style="font-size:18px;line-height:1.3">${escapeHtml(favourite)}</strong></div>
    </section>`;
  }

  function filteredRows() {
    const term = searchTerm.trim().toLowerCase();
    const visible = rows.filter(row => {
      if (activeType !== 'all' && row.work_type !== activeType) return false;
      if (!term) return true;
      const haystack = `${meta(row.work_type)[0]} ${promptFor(row)} ${summaryText(row)}`.toLowerCase();
      return haystack.includes(term);
    });
    return visible.sort((a,b) => sortOrder === 'oldest' ? new Date(a.created_at)-new Date(b.created_at) : new Date(b.created_at)-new Date(a.created_at));
  }

  function filterHtml() {
    const seen = new Set();
    const filters = rows.map(row => row.work_type).filter(type => {
      const label = meta(type)[0]; if (seen.has(label)) return false; seen.add(label); return true;
    }).map(type => `<button class="lg-filter-button" data-filter="${escapeHtml(type)}">${escapeHtml(meta(type)[0])}</button>`).join('');
    return `<div class="lg-history-toolbar"><button class="lg-filter-button is-active" data-filter="all">All activities</button>${filters}</div>`;
  }

  function itemHtml(row) {
    const [label,icon,tone] = meta(row.work_type);
    return `<article class="lg-history-item" tabindex="0" role="button" data-history-id="${escapeHtml(row.id)}">
      <div class="lg-activity-icon is-${tone}"><i data-lucide="${icon}" width="20"></i></div>
      <div class="lg-history-copy"><div class="lg-history-meta"><span>${escapeHtml(label)}</span><time>${escapeHtml(relativeDate(row.created_at))}</time></div><h2>${escapeHtml(promptFor(row))}</h2><p>${escapeHtml(summaryText(row))}</p></div>
      <div class="lg-history-open" aria-hidden="true"><i data-lucide="chevron-right" width="18"></i></div>
    </article>`;
  }

  function content() {
    if (!rows.length) return `<div class="lg-page"><header class="lg-page-header"><div><div class="lg-eyebrow">Progress</div><h1 class="lg-page-title">Activity History</h1><p class="lg-page-copy">Everything you save while learning will be kept here for easy review.</p></div></header><div class="lg-history-empty"><div class="lg-panel-icon"><i data-lucide="history"></i></div><h2>No activity history yet</h2><p>Completed explanations, revision notes, practice tests, maths help and homework support will appear here.</p><a class="lg-primary-button" href="${window.LearnerAuth.withProfileId('/app.html')}">Choose an activity</a></div></div>`;
    return `<div class="lg-page"><header class="lg-page-header"><div><div class="lg-eyebrow">Progress</div><h1 class="lg-page-title">Activity History</h1><p class="lg-page-copy">Revisit previous learning without generating it again. Search, filter, and open any saved activity.</p></div></header>
      ${statsHtml()}
      <div class="lg-history-controls"><label class="lg-history-search"><i data-lucide="search" width="17"></i><input id="history-search" type="search" placeholder="Search topics or activities" aria-label="Search activity history"></label><select id="history-sort" class="lg-history-sort" aria-label="Sort activity history"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
      ${filterHtml()}<section id="history-list" class="lg-history-list"></section></div>`;
  }

  function renderList() {
    const list = document.getElementById('history-list'); if (!list) return;
    const visible = filteredRows();
    list.innerHTML = visible.length ? visible.map(itemHtml).join('') : `<div class="lg-history-no-results"><strong>No matching activities</strong><div style="margin-top:5px">Try another search term or activity filter.</div></div>`;
    list.querySelectorAll('[data-history-id]').forEach(item => {
      const open = () => openHistory(item.dataset.historyId);
      item.addEventListener('click',open);
      item.addEventListener('keydown',event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
    });
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }

  function renderValue(value, key='') {
    if (value === null || value === undefined || value === '') return '';
    if (Array.isArray(value)) {
      if (!value.length) return '';
      if (value.every(item => ['string','number','boolean'].includes(typeof item))) return `<ul>${value.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`;
      return value.map((item,index)=>`<div class="lg-history-section"><h3>${escapeHtml(labelKey(key).replace(/s$/,'') || 'Item')} ${index+1}</h3>${renderValue(item)}</div>`).join('');
    }
    if (typeof value === 'object') {
      return Object.entries(value).filter(([,v])=>v!==null&&v!==undefined&&v!==''&&(!Array.isArray(v)||v.length)).map(([childKey,childValue])=>`<section class="lg-history-section"><h3>${escapeHtml(labelKey(childKey))}</h3>${renderValue(childValue,childKey)}</section>`).join('');
    }
    const text = String(value);
    if (typeof window.LearnerMarkdown?.render === 'function') return window.LearnerMarkdown.render(text);
    return `<div class="lg-history-value">${escapeHtml(text)}</div>`;
  }

  function openHistory(id) {
    const row = rows.find(item => String(item.id) === String(id)); if (!row) return;
    const [label,icon,tone,path] = meta(row.work_type);
    const output = renderValue(row.output_content) || `<div class="lg-history-section"><p>No saved result content is available for this older activity.</p></div>`;
    modalRoot.innerHTML = `<div class="lg-history-modal" role="dialog" aria-modal="true" aria-label="Saved ${escapeHtml(label)}"><div class="lg-history-modal-backdrop" data-close-history></div><div class="lg-history-dialog"><header class="lg-history-dialog-head"><div class="lg-history-dialog-title"><div class="lg-activity-icon is-${tone}"><i data-lucide="${icon}" width="20"></i></div><div><div class="lg-eyebrow">${escapeHtml(label)}</div><h2>${escapeHtml(promptFor(row))}</h2><p>Saved ${escapeHtml(formatDate(row.created_at))}</p></div></div><button class="lg-history-close" data-close-history aria-label="Close"><i data-lucide="x" width="19"></i></button></header><div class="lg-history-dialog-body"><div class="lg-history-prompt"><span>Original request</span><p>${escapeHtml(promptFor(row))}</p></div><div class="lg-history-output">${output}</div></div><footer class="lg-history-dialog-actions"><button class="lg-history-action" data-copy-prompt><i data-lucide="copy" width="15"></i>Copy request</button><div><button class="lg-history-action" data-close-history>Close</button><a class="lg-history-action is-primary" href="${window.LearnerAuth.withProfileId(path)}"><i data-lucide="arrow-up-right" width="15"></i>Open ${escapeHtml(label)}</a></div></footer></div></div>`;
    document.body.classList.add('lg-modal-open');
    modalRoot.querySelectorAll('[data-close-history]').forEach(el=>el.addEventListener('click',closeHistory));
    modalRoot.querySelector('[data-copy-prompt]')?.addEventListener('click',async event => {
      try { await navigator.clipboard.writeText(promptFor(row)); event.currentTarget.innerHTML='<i data-lucide="check" width="15"></i>Copied'; if(window.lucide?.createIcons)window.lucide.createIcons(); }
      catch { window.prompt('Copy this request:',promptFor(row)); }
    });
    if (window.lucide?.createIcons) window.lucide.createIcons();
  }
  function closeHistory() { modalRoot.innerHTML=''; document.body.classList.remove('lg-modal-open'); }

  function bindControls() {
    root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click',()=>{
      activeType=button.dataset.filter; root.querySelectorAll('.lg-filter-button').forEach(item=>item.classList.toggle('is-active',item===button)); renderList();
    }));
    document.getElementById('history-search')?.addEventListener('input',event=>{searchTerm=event.target.value;renderList();});
    document.getElementById('history-sort')?.addEventListener('change',event=>{sortOrder=event.target.value;renderList();});
    document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modalRoot.innerHTML)closeHistory();});
  }

  async function init() {
    const result = await window.LearnerAuth.requireSessionAndProfile(); if (!result) return;
    const {profile,account} = result;
    const {data,error} = await window.LearnerAuth.supabase.from('saved_work').select('id,work_type,input_prompt,output_content,created_at').eq('profile_id',profile.id).order('created_at',{ascending:false}).limit(200);
    if (error) { root.innerHTML=`<div class="lg-loading-page"><div class="lg-panel"><h2>We couldn't load activity history</h2><p>${escapeHtml(error.message)}</p></div></div>`; return; }
    rows=data||[];
    window.LearnerShell.render({root,profile,account,activeKey:'history',title:'Activity History',content:content()});
    bindControls(); renderList();
  }
  init();
})();