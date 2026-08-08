/* LearnerGenie dashboard and account-level profile picker. */
(function () {
  const root = document.getElementById('app-root');
  let session;
  let account;
  let profiles = [];
  let activeProfile;

  const escapeHtml = value => String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const link = path => window.LearnerAuth.withProfileId(path);
  const limit = () => Math.max(1,Number(account?.profile_limit ?? 1));
  const allowedProfiles = () => profiles.slice(0,limit());
  const isAllowed = id => allowedProfiles().some(p=>String(p.id)===String(id));

  function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  function typeMeta(type) {
    return ({
      homeworkHelp:['Homework Helper','life-buoy','coral'],
      explainSimply:['Explain It Simply','lightbulb','teal'],
      learningHub:['Revision Notes','book-open-check','navy'],
      revisionNotes:['Revision Notes','book-open-check','navy'],
      testBuilder:['Practice Test','clipboard-check','teal'],
      mathHub:['Mathematics','calculator','gold']
    })[type] || ['Learning activity','sparkles','teal'];
  }

  function promptFor(row) {
    const input = row.input_prompt || {};
    return input.prompt || input.topic || input.question || input.title || 'Saved learning activity';
  }

  function formatDate(value) {
    if (!value) return '';
    return new Intl.DateTimeFormat('en-ZA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
  }

  async function loadActivity() {
    const start = new Date();
    const day = (start.getDay() + 6) % 7;
    start.setDate(start.getDate() - day);
    start.setHours(0,0,0,0);
    const [weekResult,recentResult] = await Promise.all([
      window.LearnerAuth.supabase.from('saved_work').select('id',{count:'exact',head:true}).eq('profile_id',activeProfile.id).gte('created_at',start.toISOString()),
      window.LearnerAuth.supabase.from('saved_work').select('id,work_type,input_prompt,created_at').eq('profile_id',activeProfile.id).order('created_at',{ascending:false}).limit(3)
    ]);
    return { weekCount: weekResult.error ? 0 : (weekResult.count || 0), recent: recentResult.error ? [] : (recentResult.data || []) };
  }

  async function loadSquads() {
    try {
      const {data,error} = await window.LearnerAuth.supabase.rpc('get_my_study_squads',{p_profile_id:Number(activeProfile.id)});
      if (error) return [];
      return data || [];
    } catch { return []; }
  }

  function recentHtml(rows) {
    if (!rows.length) return `<div class="lg-empty-inline"><div class="lg-panel-icon"><i data-lucide="history"></i></div><div><strong>No saved activities yet</strong><p>Your completed learning activities will appear here.</p></div></div>`;
    return rows.map(row => {
      const [label,icon,tone] = typeMeta(row.work_type);
      return `<div class="lg-activity-row"><div class="lg-activity-icon is-${tone}"><i data-lucide="${icon}" width="19"></i></div><div><strong>${escapeHtml(promptFor(row))}</strong><span>${label}</span></div><time>${escapeHtml(formatDate(row.created_at))}</time></div>`;
    }).join('');
  }

  function dashboardContent(data,squads) {
    const count = data.weekCount;
    const countCopy = count === 0 ? `You haven't completed an activity this week yet. Choose a small place to start and begin building the habit.` : count === 1 ? 'A good first step for the week.' : 'A strong week of focused learning so far.';
    const squad = squads[0];
    const squadCard = squad
      ? `<div class="lg-eyebrow is-light">Study Squads</div><h3>${escapeHtml(squad.name || 'Your Study Squad')}</h3><p>Keep building consistent study habits with your squad.</p><a class="lg-secondary-light" href="${link('/study-squads.html')}">Open Study Squads <i data-lucide="arrow-right" width="16"></i></a>`
      : `<div class="lg-eyebrow is-light">Study Squads</div><h3>Build better habits together.</h3><p>You are not in a Study Squad yet. Start a private squad or join one with an invite code.</p><div class="lg-squad-actions"><a class="lg-secondary-light" href="${link('/study-squads.html')}">Start a squad <i data-lucide="plus" width="16"></i></a><a class="lg-secondary-light" href="${link('/study-squads.html')}">Join a squad <i data-lucide="key-round" width="16"></i></a></div>`;

    return `<div class="lg-page lg-dashboard-page">
      <header class="lg-page-header"><div><div class="lg-eyebrow">Learner dashboard</div><h1 class="lg-page-title">${greeting()}, ${escapeHtml(activeProfile.name)}</h1></div></header>
      <section class="lg-dashboard-hero"><div><div class="lg-eyebrow">Ready when you are</div><h2>What would you like to work on today?</h2><p>Pick a focused activity, revisit something you have already done, or check how your learning habits are building over time.</p></div><div class="lg-week-card"><div class="lg-eyebrow">This week</div><strong>${count} ${count === 1 ? 'activity' : 'activities'}</strong><p>${countCopy}</p></div></section>
      <section class="lg-dashboard-section"><div class="lg-section-heading"><div><div class="lg-eyebrow">Choose your next step</div><h2>Learn with purpose</h2></div></div><div class="lg-tool-grid">
        <article class="lg-tool-group is-understand"><div class="lg-tool-icon"><i data-lucide="sparkles"></i></div><h3>Understand</h3><p>Get unstuck and make difficult schoolwork feel manageable.</p><div class="lg-tool-links"><a href="${link('/activities/homework-help.html')}"><i data-lucide="life-buoy" width="17"></i>Homework Helper<i data-lucide="arrow-right" width="16"></i></a><a href="${link('/activities/explain-simply.html')}"><i data-lucide="lightbulb" width="17"></i>Explain It Simply<i data-lucide="arrow-right" width="16"></i></a></div></article>
        <article class="lg-tool-group is-revise"><div class="lg-tool-icon"><i data-lucide="book-open-check"></i></div><h3>Revise</h3><p>Turn topics into useful notes and practice that builds recall.</p><div class="lg-tool-links"><a href="${link('/activities/learning-hub.html')}"><i data-lucide="file-text" width="17"></i>Revision Notes<i data-lucide="arrow-right" width="16"></i></a><a href="${link('/activities/test-builder.html')}"><i data-lucide="clipboard-check" width="17"></i>Practice Test<i data-lucide="arrow-right" width="16"></i></a></div></article>
        <article class="lg-tool-group is-solve"><div class="lg-tool-icon"><i data-lucide="calculator"></i></div><h3>Solve</h3><p>Work through a maths problem and understand each step.</p><div class="lg-tool-links"><a href="${link('/activities/math-hub.html')}"><i data-lucide="sigma" width="17"></i>Mathematics<i data-lucide="arrow-right" width="16"></i></a></div></article>
      </div></section>
      <section class="lg-dashboard-section lg-lower-grid"><article class="lg-panel"><div class="lg-section-heading"><div><div class="lg-eyebrow">Continue learning</div><h2>Recent activity</h2></div><a href="${link('/activities/activity-history.html')}">Open history</a></div><div class="lg-activity-list">${recentHtml(data.recent)}</div></article><article class="lg-panel lg-squad-card">${squadCard}</article></section>
    </div>`;
  }

  function picker() {
    const allowed=new Set(allowedProfiles().map(p=>String(p.id)));
    const cards = profiles.map(p => {
      const locked=!allowed.has(String(p.id));
      if(locked){
        return `<button class="lg-profile-choice" type="button" disabled title="Upgrade your plan to reactivate this learner"><span><i data-lucide="lock"></i></span><strong>${escapeHtml(p.name)}</strong><small style="display:block;color:#6b7280;margin-top:5px">Locked by current plan</small></button>`;
      }
      return `<button class="lg-profile-choice" data-profile="${p.id}"><span>${escapeHtml((p.name||'L').charAt(0).toUpperCase())}</span><strong>${escapeHtml(p.name)}</strong></button>`;
    }).join('');
    const canAdd=profiles.length<limit();
    const addCard=canAdd?`<button class="lg-profile-choice is-add" id="add-profile"><span><i data-lucide="plus"></i></span><strong>Add learner</strong></button>`:'';
    const lockedNotice=profiles.length>limit()?`<p style="margin-top:16px;font-size:13px;color:#6b7280">Your current plan includes ${limit()} learner profile${limit()===1?'':'s'}. Locked profiles and their saved work are preserved and will become available again if your plan allows more profiles.</p>`:'';
    root.innerHTML = `<div class="lg-picker-page"><div class="lg-picker-card"><img src="/logo.svg" alt="LearnerGenie"><div class="lg-eyebrow">LearnerGenie</div><h1>Who's learning today?</h1><p>Choose a learner profile to open their dashboard.</p><div class="lg-picker-grid">${cards}${addCard}</div>${lockedNotice}<button class="lg-picker-signout" id="picker-signout">Sign out</button></div></div>`;
    document.querySelectorAll('[data-profile]').forEach(b=>b.onclick=()=>selectProfile(b.dataset.profile));
    document.getElementById('add-profile')?.addEventListener('click',addProfile);
    document.getElementById('picker-signout').onclick=window.LearnerAuth.signOut;
    window.lucide?.createIcons();
  }

  async function renderDashboard() {
    const [activity,squads] = await Promise.all([loadActivity(),loadSquads()]);
    window.LearnerShell.render({root,profile:activeProfile,account,activeKey:'home',title:'Home',content:dashboardContent(activity,squads)});
  }

  async function selectProfile(id) {
    if(!isAllowed(id))return picker();
    activeProfile = profiles.find(p=>String(p.id)===String(id));
    if (!activeProfile) return picker();
    const url = new URL(location.href); url.searchParams.set('profile_id',activeProfile.id); history.replaceState({},'',url.pathname+url.search);
    await renderDashboard();
  }

  async function addProfile() {
    if (profiles.length >= limit()) return alert(`Your current plan allows ${limit()} learner profile${limit()===1?'':'s'}.`);
    const name = prompt('Learner name'); if (!name?.trim()) return;
    const res=await fetch('/.netlify/functions/create-additional-learner',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({name:name.trim()})
    });
    const body=await res.json().catch(()=>({}));
    if(!res.ok)return alert(body.error||'Could not create learner profile.');
    profiles.push(body.profile);
    profiles.sort((a,b)=>Number(a.id)-Number(b.id));
    await selectProfile(body.profile.id);
  }

  async function init() {
    try {
      session = await window.LearnerAuth.requireSession(); if (!session) return;
      account = await window.LearnerAuth.getAccount(session.user.id);
      const {data,error}=await window.LearnerAuth.supabase.from('profiles').select('*').eq('account_id',session.user.id).eq('status','active').order('id',{ascending:true});
      if (error) throw error; profiles=data||[];
      const requested=window.LearnerAuth.getProfileIdFromUrl();
      if(new URLSearchParams(location.search).get('profile_locked')==='1'){
        history.replaceState({},'',location.pathname);
      }
      requested ? await selectProfile(requested) : picker();
    } catch(error) {
      root.innerHTML=`<div class="lg-loading-page"><div class="lg-panel"><h2>We couldn't open the dashboard</h2><p>${escapeHtml(error.message)}</p><button class="lg-primary-button" onclick="location.reload()">Try again</button></div></div>`;
    }
  }
  init();
})();