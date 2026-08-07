(function(){
  const app=document.getElementById('app');
  if(!app)return;

  function withProfile(path,profileId){
    if(!profileId)return path;
    const hashIndex=path.indexOf('#');
    const base=hashIndex===-1?path:path.slice(0,hashIndex);
    const hash=hashIndex===-1?'':path.slice(hashIndex);
    const sep=base.includes('?')?'&':'?';
    return `${base}${sep}profile_id=${encodeURIComponent(profileId)}${hash}`;
  }

  function updateSidebar(){
    const select=document.getElementById('profile-select');
    const option=select?.selectedOptions?.[0];
    const profileId=select?.value||new URLSearchParams(location.search).get('profile_id');
    let label=option?.textContent?.trim()||'Learner';
    const parts=label.split('·').map(x=>x.trim());
    const name=parts[0]||'Learner';
    const grade=parts[1]||'Learner profile';
    const avatar=document.getElementById('squad-profile-avatar');
    const nameEl=document.getElementById('squad-profile-name');
    const gradeEl=document.getElementById('squad-profile-grade');
    if(avatar)avatar.textContent=(name.charAt(0)||'L').toUpperCase();
    if(nameEl)nameEl.textContent=name;
    if(gradeEl)gradeEl.textContent=grade;
    document.querySelectorAll('[data-profile-link]').forEach(link=>{
      const raw=link.getAttribute('href')?.split('?profile_id=')[0]||link.getAttribute('href');
      if(raw)link.href=withProfile(raw,profileId);
    });
  }

  function ensureIntro(){
    const main=app.querySelector(':scope > main');
    if(!main||main.querySelector('.lg-squads-intro'))return;
    const intro=document.createElement('section');
    intro.className='lg-squads-intro';
    intro.innerHTML=`<div class="lg-squads-intro-copy"><div class="lg-squads-eyebrow">Study together</div><h1>Study Squads</h1><p>A little friendly accountability. See who’s been learning, keep your own momentum moving, and use the leaderboard when you want the competitive view.</p></div><div class="lg-squads-intro-actions"><button type="button" class="lg-squads-pill" data-ui-join><i data-lucide="log-in" width="16"></i>Join squad</button><button type="button" class="lg-squads-pill lg-squads-pill--primary" data-ui-create><i data-lucide="plus" width="16"></i>Create squad</button></div>`;
    main.prepend(intro);
    intro.querySelector('[data-ui-create]')?.addEventListener('click',()=>document.getElementById('toggle-create-squad')?.click());
    intro.querySelector('[data-ui-join]')?.addEventListener('click',()=>document.getElementById('toggle-join-squad')?.click());
  }

  function improveTabs(){
    document.querySelectorAll('[data-squad-tab]').forEach(button=>{
      if(button.dataset.squadTab==='details'){
        const textNodes=[...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE);
        textNodes.forEach(n=>{if(n.textContent.includes('Squad Details'))n.textContent=' Overview';});
      }
      if(button.dataset.squadTab==='activity'){
        const textNodes=[...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE);
        textNodes.forEach(n=>{if(n.textContent.includes('Squad Activity'))n.textContent=' Activity';});
      }
    });
  }

  function improveSquadSwitcher(){
    const buttons=[...document.querySelectorAll('.squad-select-btn')];
    if(!buttons.length)return;
    const row=buttons[0].parentElement;
    if(!row||row.dataset.enhancedSwitcher==='1')return;
    row.dataset.enhancedSwitcher='1';
    const label=document.createElement('span');
    label.className='lg-squad-switch-label';
    label.textContent='Switch squad';
    row.parentElement?.insertBefore(label,row);

    if(buttons.length>1){
      const select=document.createElement('select');
      select.className='lg-squad-select';
      buttons.forEach(btn=>{
        const option=document.createElement('option');
        option.value=btn.dataset.squadId||'';
        option.textContent=btn.querySelector('.font-bold')?.textContent?.trim()||'Study Squad';
        if(btn.classList.contains('bg-indigo-600'))option.selected=true;
        select.appendChild(option);
      });
      select.addEventListener('change',()=>document.querySelector(`.squad-select-btn[data-squad-id="${CSS.escape(select.value)}"]`)?.click());
      const wrap=document.createElement('div');
      wrap.id='squad-switch-wrap';
      wrap.appendChild(select);
      row.style.display='none';
      row.parentElement?.insertBefore(wrap,row.nextSibling);
    }
  }

  function improveActiveSquadHeader(){
    const activeSection=document.querySelector('section.card.border-t-4.border-indigo-500');
    if(!activeSection)return;
    const label=[...activeSection.querySelectorAll('p')].find(p=>p.textContent.trim()==='Active Squad');
    if(label)label.textContent='Your active squad';
    const meta=[...activeSection.querySelectorAll('p')].find(p=>p.textContent.includes('Weekly XP resets'));
    if(meta)meta.textContent=meta.textContent.replace(/ · Weekly XP resets every Monday UTC/i,'');
  }

  function improveLeaderboard(){
    const leaderboardButton=document.querySelector('[data-squad-tab="leaderboard"]');
    if(!leaderboardButton)return;
    const active=leaderboardButton.classList.contains('bg-indigo-600');
    if(!active)return;
    const heading=[...document.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Leaderboard');
    if(heading)heading.textContent='Full squad leaderboard';
    const sub=heading?.parentElement?.querySelector('p');
    if(sub)sub.textContent='See every member’s activity and switch between this week and all-time performance.';
  }

  function improveActivity(){
    const activityButton=document.querySelector('[data-squad-tab="activity"]');
    if(!activityButton?.classList.contains('bg-indigo-600'))return;
    const heading=[...document.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Squad Activity');
    if(heading)heading.textContent='Squad activity';
    const sub=heading?.parentElement?.querySelector('p');
    if(sub)sub.textContent='Recent learning activity only — answers and learner work are not shared.';
  }

  function enhance(){
    updateSidebar();
    ensureIntro();
    improveTabs();
    improveSquadSwitcher();
    improveActiveSquadHeader();
    improveLeaderboard();
    improveActivity();
    if(window.lucide?.createIcons)window.lucide.createIcons();
  }

  let queued=false;
  const observer=new MutationObserver(()=>{
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;enhance();});
  });
  observer.observe(app,{childList:true,subtree:true});

  document.getElementById('squad-menu-open')?.addEventListener('click',()=>document.body.classList.add('lg-menu-open'));
  document.getElementById('squad-menu-overlay')?.addEventListener('click',()=>document.body.classList.remove('lg-menu-open'));
  document.querySelectorAll('#squad-sidebar .lg-nav-link').forEach(link=>link.addEventListener('click',()=>document.body.classList.remove('lg-menu-open')));

  enhance();
})();
