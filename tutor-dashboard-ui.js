(function(){
  const app=document.getElementById('app');
  if(!app)return;

  let activeView='overview';
  let queued=false;

  function icon(){ if(window.lucide?.createIcons) window.lucide.createIcons(); }

  function centreName(){
    const hiddenHeader=app.querySelector('header');
    return hiddenHeader?.querySelector('h1')?.textContent?.trim() || (typeof activeCentre==='function' ? activeCentre()?.name : '') || 'Tutor Centre';
  }

  function setCentreLabel(){
    const el=document.getElementById('tutor-centre-name');
    if(el)el.textContent=centreName();
  }

  function ensureIntro(root){
    if(root.querySelector('.lg-tutor-intro'))return;
    const intro=document.createElement('section');
    intro.className='lg-tutor-intro';
    intro.innerHTML=`
      <div class="lg-tutor-intro-copy">
        <div class="lg-tutor-eyebrow">Tutor dashboard</div>
        <h1>${esc(centreName())}</h1>
        <p>See who is engaging, where learners are spending time, and who may need a little extra attention.</p>
      </div>
      <div class="lg-tutor-intro-actions">
        <a class="lg-tutor-pill" href="/tutor-centre-invites.html"><i data-lucide="mail-plus" width="16"></i>Invite learner</a>
        <button class="lg-tutor-pill lg-tutor-pill--primary" type="button" data-ui-insight><i data-lucide="sparkles" width="16"></i>Generate insight</button>
      </div>`;
    root.prepend(intro);
    intro.querySelector('[data-ui-insight]')?.addEventListener('click',()=>document.getElementById('generate-ai-insight-btn')?.click());
  }

  function metricHtml(label,value,note,iconName){
    return `<div><div class="flex items-center justify-between"><p class="text-xs font-bold uppercase tracking-wide text-gray-500">${esc(label)}</p><i data-lucide="${iconName}" class="h-5 w-5 text-indigo-500"></i></div><div class="mt-3 text-2xl font-bold text-gray-800 leading-tight">${esc(value)}</div><p class="mt-2 text-sm text-gray-500">${esc(note)}</p></div>`;
  }

  function ensureMetrics(root){
    const metrics=[...root.children].find(el=>el.tagName==='SECTION' && el.classList.contains('grid') && el.querySelectorAll(':scope > div').length===5);
    if(!metrics)return;
    metrics.classList.add('lg-tutor-metrics');
    const learners=typeof state!=='undefined' ? (state.learners||[]) : [];
    const activity=typeof state!=='undefined' ? (state.activity||[]) : [];
    const weekCutoff=Date.now()-7*86400000;
    const weekActs=activity.filter(a=>new Date(a.created_at).getTime()>=weekCutoff);
    const activeIds=new Set(weekActs.map(a=>Number(a.profile_id)));
    const attention=learners.filter(l=>{
      const s=typeof summaryForLearner==='function'?summaryForLearner(l):{latest:null};
      const d=typeof daysAgo==='function'?daysAgo(s.latest):null;
      return d===null || d>=7;
    }).length;
    const groups=typeof state!=='undefined' ? (state.groups||[]).length : 0;
    metrics.innerHTML=
      metricHtml('Assigned learners',learners.length,`Across ${groups} tutor group${groups===1?'':'s'}`,'users')+
      metricHtml('Active this week',activeIds.size,learners.length?`${Math.round((activeIds.size/learners.length)*100)}% of assigned learners`:'No assigned learners','activity')+
      metricHtml('Need attention',attention,'Inactive for 7+ days or no activity','triangle-alert')+
      metricHtml('Activities this week',weekActs.length,'Learning actions in the last 7 days','archive');
  }

  function ensureTabs(root){
    if(root.querySelector('.lg-tutor-tabs'))return;
    const metrics=root.querySelector('.lg-tutor-metrics');
    const tabs=document.createElement('div');
    tabs.className='lg-tutor-tabs';
    tabs.innerHTML=`<button class="lg-tutor-tab is-active" data-local-view="overview">Overview</button><button class="lg-tutor-tab" data-local-view="learners">Learners</button><button class="lg-tutor-tab" data-local-view="activity">Activity</button><button class="lg-tutor-tab" data-local-view="groups">Groups</button>`;
    (metrics||root.querySelector('.lg-tutor-intro'))?.insertAdjacentElement('afterend',tabs);
    tabs.querySelectorAll('[data-local-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.localView)));
  }

  function headingCard(section, text){
    return [...section.querySelectorAll('h2')].find(h=>h.textContent.trim()===text)?.closest('.bg-white.rounded-xl.shadow-lg') || null;
  }

  function buildViews(root){
    if(root.querySelector('.lg-tutor-view'))return;
    const sections=[...root.children].filter(el=>el.tagName==='SECTION' && !el.classList.contains('lg-tutor-metrics'));
    const insightSection=sections.find(s=>s.textContent.includes('Tutor Insight'));
    const learnerSection=sections.find(s=>s.textContent.includes('Learners') && s.textContent.includes('Recent activity'));
    const groupsSection=sections.find(s=>s.textContent.includes('Create group') && s.textContent.includes('Manage groups'));
    if(!insightSection || !learnerSection || !groupsSection)return;

    const learnersCard=headingCard(learnerSection,'Learners');
    const recentCard=headingCard(learnerSection,'Recent activity');
    const insightCard=headingCard(insightSection,'Tutor Insight');
    const subjectsCard=headingCard(insightSection,'Top subjects/tools');

    const overview=document.createElement('section'); overview.className='lg-tutor-view is-active'; overview.dataset.tutorPanel='overview';
    const overviewGrid=document.createElement('div'); overviewGrid.className='lg-tutor-overview-grid';
    const overviewMain=document.createElement('div'); overviewMain.className='lg-tutor-overview-main';
    const overviewSide=document.createElement('div'); overviewSide.className='lg-tutor-overview-side';
    if(insightCard){ insightCard.classList.add('lg-tutor-card--insight'); overviewMain.appendChild(insightCard); }
    const compactLearners=learnersCard?.cloneNode(true);
    if(compactLearners){
      compactLearners.querySelectorAll('tbody tr').forEach((row,i)=>{ if(i>3)row.remove(); });
      compactLearners.querySelectorAll('input,select').forEach(el=>el.remove());
      compactLearners.querySelectorAll('[data-open-learner]').forEach(row=>row.addEventListener('click',()=>{ const id=row.dataset.openLearner; if(typeof openLearner==='function')openLearner(id); }));
      overviewMain.appendChild(compactLearners);
    }
    overviewSide.appendChild(attentionCard());
    if(recentCard){ const clone=recentCard.cloneNode(true); overviewSide.appendChild(clone); }
    if(subjectsCard)overviewSide.appendChild(subjectsCard);
    overviewGrid.append(overviewMain,overviewSide); overview.appendChild(overviewGrid);

    const learners=document.createElement('section'); learners.className='lg-tutor-view'; learners.dataset.tutorPanel='learners'; if(learnersCard)learners.appendChild(learnersCard);
    const activity=document.createElement('section'); activity.className='lg-tutor-view'; activity.dataset.tutorPanel='activity'; if(recentCard)activity.appendChild(recentCard);
    const groups=document.createElement('section'); groups.className='lg-tutor-view'; groups.dataset.tutorPanel='groups'; groups.appendChild(groupsSection);

    insightSection.remove(); learnerSection.remove();
    const tabs=root.querySelector('.lg-tutor-tabs'); tabs.insertAdjacentElement('afterend',overview); overview.insertAdjacentElement('afterend',learners); learners.insertAdjacentElement('afterend',activity); activity.insertAdjacentElement('afterend',groups);
  }

  function attentionCard(){
    const card=document.createElement('div'); card.className='lg-tutor-card';
    const learners=typeof filteredLearners==='function' ? filteredLearners() : [];
    const ranked=learners.map(l=>{
      const s=typeof summaryForLearner==='function'?summaryForLearner(l):{latest:null,count:0};
      const d=typeof daysAgo==='function'?daysAgo(s.latest):null;
      return {learner:l,days:d,count:s.count||0};
    }).filter(x=>x.days===null || x.days>=7 || x.count<=2).sort((a,b)=>(b.days??999)-(a.days??999)).slice(0,4);
    const rows=ranked.length?ranked.map(x=>{
      const name=x.learner.name||'Learner'; const initial=esc(name.charAt(0).toUpperCase());
      const detail=x.days===null?'No saved work yet':`Last active ${x.days} day${x.days===1?'':'s'} ago`;
      const tag=x.days===null?'New':x.days>=10?`${x.days} days`:x.count<=2?`${x.count} acts`:`${x.days} days`;
      const danger=x.days!==null&&x.days>=10?' is-danger':'';
      return `<button type="button" class="lg-tutor-attention-row" data-attention-id="${esc(x.learner.id)}"><span class="lg-tutor-attention-avatar">${initial}</span><span><strong>${esc(name)}</strong><small>${esc(detail)}</small></span><span class="lg-tutor-attention-tag${danger}">${esc(tag)}</span></button>`;
    }).join(''):`<div style="color:var(--lg-muted);font-size:12px">No major inactivity flags in this view.</div>`;
    card.innerHTML=`<div class="lg-tutor-section-head"><div><h2>Needs attention</h2><p>Learners who may warrant a follow-up.</p></div><span style="font-size:11px;color:var(--lg-muted)">${ranked.length} learner${ranked.length===1?'':'s'}</span></div><div class="lg-tutor-attention-list">${rows}</div>`;
    card.querySelectorAll('[data-attention-id]').forEach(btn=>btn.addEventListener('click',()=>{if(typeof openLearner==='function')openLearner(btn.dataset.attentionId);}));
    return card;
  }

  function showView(view){
    activeView=view||'overview';
    document.querySelectorAll('[data-tutor-panel]').forEach(p=>p.classList.toggle('is-active',p.dataset.tutorPanel===activeView));
    document.querySelectorAll('[data-local-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.localView===activeView));
    document.querySelectorAll('[data-tutor-view]').forEach(b=>b.classList.toggle('is-active',b.dataset.tutorView===activeView || (activeView==='overview'&&b.dataset.tutorView==='overview')));
    document.body.classList.remove('lg-menu-open'); icon();
  }

  function bindShell(){
    document.querySelectorAll('[data-tutor-view]').forEach(btn=>{btn.onclick=()=>showView(btn.dataset.tutorView)});
    document.getElementById('tutor-menu-open')?.addEventListener('click',()=>document.body.classList.add('lg-menu-open'));
    document.getElementById('tutor-menu-overlay')?.addEventListener('click',()=>document.body.classList.remove('lg-menu-open'));
  }

  function enhance(){
    const root=app.firstElementChild;
    if(!root)return;
    if(!root.querySelector('header') || !root.textContent.includes('Tutor Insight')){ setCentreLabel(); icon(); return; }
    setCentreLabel(); ensureIntro(root); ensureMetrics(root); ensureTabs(root); buildViews(root); bindShell(); showView(activeView); icon();
  }

  const observer=new MutationObserver(()=>{
    if(queued)return; queued=true;
    requestAnimationFrame(()=>{queued=false;enhance();});
  });
  observer.observe(app,{childList:true,subtree:false});
  bindShell(); enhance();
})();
