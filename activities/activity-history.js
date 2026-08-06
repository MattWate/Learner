/* LearnerGenie standalone activity history. */
(function () {
  const root = document.getElementById('page-root');
  const escapeHtml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');

  const typeMap = {
    homeworkHelp:['Homework Helper','life-buoy','coral'],
    explainSimply:['Explain It Simply','lightbulb','teal'],
    learningHub:['Revision Notes','book-open-check','navy'],
    revisionNotes:['Revision Notes','book-open-check','navy'],
    testBuilder:['Practice Test','clipboard-check','teal'],
    mathHub:['Mathematics','calculator','gold']
  };

  function meta(type) { return typeMap[type] || ['Learning activity','sparkles','teal']; }
  function promptFor(row) {
    const input = row.input_prompt || {};
    return input.prompt || input.topic || input.question || input.title || 'Saved learning activity';
  }
  function formatDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  }

  function content(rows) {
    const filters = [...new Set(rows.map(row => row.work_type))].map(type => {
      const [label] = meta(type);
      return `<button class="lg-filter-button" data-filter="${escapeHtml(type)}">${escapeHtml(label)}</button>`;
    }).join('');

    const list = rows.length ? rows.map(row => {
      const [label,icon,tone] = meta(row.work_type);
      return `<article class="lg-history-item" data-type="${escapeHtml(row.work_type)}">
        <div class="lg-activity-icon is-${tone}"><i data-lucide="${icon}" width="20"></i></div>
        <div class="lg-history-copy"><div class="lg-history-meta"><span>${escapeHtml(label)}</span><time>${escapeHtml(formatDate(row.created_at))}</time></div><h2>${escapeHtml(promptFor(row))}</h2><p>Saved to this learner's activity history.</p></div>
      </article>`;
    }).join('') : `<div class="lg-history-empty"><div class="lg-panel-icon"><i data-lucide="history"></i></div><h2>No activity history yet</h2><p>Completed explanations, revision notes, quizzes and other learning activities will appear here.</p><a class="lg-primary-button" href="${window.LearnerAuth.withProfileId('/app.html')}">Choose an activity</a></div>`;

    return `<div class="lg-page"><header class="lg-page-header"><div><div class="lg-eyebrow">Progress</div><h1 class="lg-page-title">Activity History</h1><p class="lg-page-copy">Review the learning activities completed by this learner.</p></div></header>
      ${rows.length ? `<div class="lg-history-toolbar"><button class="lg-filter-button is-active" data-filter="all">All activities</button>${filters}</div>` : ''}
      <section class="lg-history-list">${list}</section>
    </div>`;
  }

  async function init() {
    const result = await window.LearnerAuth.requireSessionAndProfile();
    if (!result) return;
    const {profile,account} = result;
    const {data,error} = await window.LearnerAuth.supabase.from('saved_work').select('id,work_type,input_prompt,output_content,created_at').eq('profile_id',profile.id).order('created_at',{ascending:false}).limit(100);
    if (error) {
      root.innerHTML = `<div class="lg-loading-page"><div class="lg-panel"><h2>We couldn't load activity history</h2><p>${escapeHtml(error.message)}</p></div></div>`;
      return;
    }
    window.LearnerShell.render({root,profile,account,activeKey:'history',title:'Activity History',content:content(data||[])});
    root.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click',()=>{
      root.querySelectorAll('.lg-filter-button').forEach(item=>item.classList.remove('is-active'));
      button.classList.add('is-active');
      const filter=button.dataset.filter;
      root.querySelectorAll('.lg-history-item').forEach(item=>item.classList.toggle('lg-hidden',filter!=='all'&&item.dataset.type!==filter));
    }));
  }
  init();
})();