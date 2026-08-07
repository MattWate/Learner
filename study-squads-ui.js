(function(){
  const app=document.getElementById('app');
  if(!app)return;

  const style=document.createElement('style');
  style.textContent=`
    .lg-overview-grid{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(300px,.55fr);gap:18px}.lg-overview-main{display:grid;gap:18px}.lg-overview-panel,.lg-overview-insight,.lg-overview-invite{padding:21px;border:1px solid var(--lg-line);border-radius:21px;background:#fff}.lg-overview-insight{background:linear-gradient(135deg,#eef8f5,#fff);border-color:#d9ebe7}.lg-overview-insight h3,.lg-overview-invite h3{margin:5px 0 0;font-size:18px}.lg-overview-insight p,.lg-overview-invite p{margin:7px 0 0;color:var(--lg-muted);font-size:13px;line-height:1.6}.lg-overview-insight p strong{color:var(--lg-teal)}.lg-overview-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}.lg-overview-title h3{margin:0;font-size:18px}.lg-overview-title span{color:var(--lg-muted);font-size:11px}.lg-overview-feed{display:flex;gap:11px;padding:12px 0}.lg-overview-feed+.lg-overview-feed{border-top:1px solid #edf0f2}.lg-overview-feed-icon{width:36px;height:36px;display:grid;place-items:center;flex:0 0 auto;border-radius:12px;background:var(--lg-blue-soft);color:var(--lg-navy)}.lg-overview-feed strong{display:block;font-size:13px}.lg-overview-feed p{margin:2px 0;color:#657180;font-size:12px}.lg-overview-feed small{color:#98a2b3;font-size:10px}.lg-overview-note{margin:0 0 8px;color:var(--lg-muted);font-size:11px}.lg-overview-rank-row{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 7px}.lg-overview-rank-row+.lg-overview-rank-row{border-top:1px solid #edf0f2}.lg-overview-rank-num{width:27px;height:27px;display:grid;place-items:center;border-radius:9px;background:#f2f4f5;color:#5f6b78;font-size:12px;font-weight:800}.lg-overview-rank-num.is-first{background:var(--lg-gold-soft);color:#8e6a12}.lg-overview-rank-row strong{display:block;font-size:12px}.lg-overview-rank-row small{display:block;color:var(--lg-muted);font-size:10px}.lg-overview-xp{text-align:right}.lg-overview-xp strong{color:var(--lg-teal)}.lg-overview-link{width:100%;margin-top:12px;padding:10px;border:1px solid var(--lg-line);border-radius:999px;background:#fff;color:#536173;font-weight:800;font-size:12px;cursor:pointer}.lg-overview-invite{margin-top:18px;background:linear-gradient(135deg,var(--lg-gold-soft),#fff);border-color:#f0e3b9}.lg-overview-code{display:flex;align-items:center;justify-content:space-between;margin:14px 0 9px;padding:11px 13px;border-radius:14px;background:#fff}.lg-overview-code strong{font-family:Manrope,sans-serif;font-size:18px;letter-spacing:.11em}.lg-overview-code button{border:0;background:#f4f5f6;border-radius:9px;padding:7px;cursor:pointer}.lg-overview-invite-actions{display:flex;gap:7px}.lg-overview-invite-actions button{flex:1;display:flex;justify-content:center;align-items:center;gap:6px;padding:9px;border:1px solid var(--lg-line);border-radius:999px;background:#fff;color:#536173;font-weight:800;font-size:11px;cursor:pointer}.lg-overview-qr{margin-top:12px;padding:12px;border-radius:15px;background:#fff;display:grid;place-items:center}.lg-overview-empty{padding:16px;color:var(--lg-muted);font-size:12px;text-align:center}.lg-hidden{display:none!important}@media(max-width:1050px){.lg-overview-grid{grid-template-columns:1fr}}@media(max-width:560px){.lg-overview-panel,.lg-overview-insight,.lg-overview-invite{padding:17px}.lg-overview-invite-actions{flex-direction:column}}
  `;
  document.head.appendChild(style);

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
    const label=option?.textContent?.trim()||'Learner';
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
      if(!link.dataset.baseHref)link.dataset.baseHref=link.getAttribute('href')||'/app.html';
      link.href=withProfile(link.dataset.baseHref,profileId);
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
        [...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>{if(n.textContent.includes('Squad Details'))n.textContent=' Overview';});
      }
      if(button.dataset.squadTab==='activity'){
        [...button.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).forEach(n=>{if(n.textContent.includes('Squad Activity'))n.textContent=' Activity';});
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
      const select=document.createElement('select');select.className='lg-squad-select';
      buttons.forEach(btn=>{const option=document.createElement('option');option.value=btn.dataset.squadId||'';option.textContent=btn.querySelector('.font-bold')?.textContent?.trim()||'Study Squad';if(btn.classList.contains('bg-indigo-600'))option.selected=true;select.appendChild(option);});
      select.addEventListener('change',()=>{const target=[...document.querySelectorAll('.squad-select-btn')].find(btn=>btn.dataset.squadId===select.value);target?.click();});
      const wrap=document.createElement('div');wrap.id='squad-switch-wrap';wrap.appendChild(select);row.style.display='none';row.parentElement?.insertBefore(wrap,row.nextSibling);
    }
  }

  function improveActiveSquadHeader(){
    const activeSection=document.querySelector('section.card.border-t-4.border-indigo-500');if(!activeSection)return;
    const label=[...activeSection.querySelectorAll('p')].find(p=>p.textContent.trim()==='Active Squad');if(label)label.textContent='Your active squad';
    const meta=[...activeSection.querySelectorAll('p')].find(p=>p.textContent.includes('Weekly XP resets'));if(meta)meta.textContent=meta.textContent.replace(/ · Weekly XP resets every Monday UTC/i,'');
  }

  function topRows(){if(typeof state==='undefined')return[];return [...(state.leaderboard||[])].sort((a,b)=>(b.weekly_xp||0)-(a.weekly_xp||0)||(b.current_streak||0)-(a.current_streak||0)).slice(0,3)}
  function currentRank(){if(typeof state==='undefined')return null;const rows=[...(state.leaderboard||[])].sort((a,b)=>(b.weekly_xp||0)-(a.weekly_xp||0)||(b.current_streak||0)-(a.current_streak||0));const profile=typeof selectedProfile==='function'?selectedProfile():null;const id=profile?.id;const index=rows.findIndex(row=>Number(row.profile_id)===Number(id));return index>=0?index+1:null}
  function ordinal(rank){if(rank===1)return'1st';if(rank===2)return'2nd';if(rank===3)return'3rd';return `${rank}th`}

  function overviewHtml(){
    if(typeof state==='undefined')return'';const squad=typeof activeSquad==='function'?activeSquad():null;if(!squad)return'';const stats=state.stats||{};const rank=currentRank();const rows=topRows();const weeklyTotal=(state.leaderboard||[]).reduce((sum,row)=>sum+Number(row.weekly_xp||0),0);const recent=(state.feed||[]).slice(0,4);
    const rowHtml=rows.length?rows.map((row,index)=>`<div class="lg-overview-rank-row"><span class="lg-overview-rank-num${index===0?' is-first':''}">${index+1}</span><div><strong>${escapeHtml(row.display_name||'Learner')}</strong><small>${row.current_streak||0} day streak</small></div><div class="lg-overview-xp"><strong>${row.weekly_xp||0} XP</strong><small>this week</small></div></div>`).join(''):`<div class="lg-overview-empty">No leaderboard activity yet.</div>`;
    const feedHtml=recent.length?recent.map(item=>`<div class="lg-overview-feed"><span class="lg-overview-feed-icon"><i data-lucide="${typeof feedIcon==='function'?feedIcon(item.event_type):'sparkles'}" width="16"></i></span><div><strong>${escapeHtml(item.event_title||'Learning activity')}</strong><p>${escapeHtml(item.event_summary||'Learner activity')}</p><small>${escapeHtml(typeof formatDate==='function'?formatDate(item.created_at):'')}</small></div></div>`).join(''):`<div class="lg-overview-empty">No squad activity yet. Learning activity will appear here as members study.</div>`;
    return `<div class="lg-overview-grid"><div class="lg-overview-main"><section class="lg-overview-insight"><div class="lg-squads-eyebrow">This week</div><h3>${rank?`You’re currently ${ordinal(rank)} in the squad`:'Keep the squad moving'}</h3><p>You have <strong>${stats.weekly_xp||0} XP</strong> this week. Squad members have earned <strong>${weeklyTotal} XP</strong> together.</p></section><section class="lg-overview-panel"><div class="lg-overview-title"><h3>Recent squad activity</h3><span>Latest learning</span></div>${feedHtml}</section></div><aside><section class="lg-overview-panel lg-overview-top"><div class="lg-overview-title"><h3>Top this week</h3><span>Snapshot</span></div><p class="lg-overview-note">A quick view only. Open Leaderboard for the full ranking.</p>${rowHtml}<button type="button" class="lg-overview-link" data-open-leaderboard>View full leaderboard</button></section><section class="lg-overview-invite"><div class="lg-squads-eyebrow">Invite a friend</div><h3>Grow the squad</h3><p>Share the squad code or invite link. Each learner joins with their own profile.</p><div class="lg-overview-code"><strong>${escapeHtml(squad.invite_code||'')}</strong><button type="button" data-copy-code title="Copy code"><i data-lucide="copy" width="16"></i></button></div><div class="lg-overview-invite-actions"><button type="button" data-copy-link><i data-lucide="link" width="15"></i>Copy link</button><button type="button" data-show-qr><i data-lucide="qr-code" width="15"></i>Show QR</button></div><div class="lg-overview-qr lg-hidden" data-qr-wrap><div data-qr-code></div></div></section></aside></div>`;
  }

  function renderOverview(){
    const detailsButton=document.querySelector('[data-squad-tab="details"]');if(!detailsButton?.classList.contains('bg-indigo-600'))return;
    const activeSection=document.querySelector('section.card.border-t-4.border-indigo-500');const content=activeSection?.lastElementChild;if(!content||content.dataset.overviewEnhanced==='1')return;
    content.dataset.overviewEnhanced='1';content.innerHTML=overviewHtml();content.querySelector('[data-open-leaderboard]')?.addEventListener('click',()=>document.querySelector('[data-squad-tab="leaderboard"]')?.click());const squad=typeof activeSquad==='function'?activeSquad():null;
    content.querySelector('[data-copy-code]')?.addEventListener('click',()=>typeof copyText==='function'&&copyText(squad?.invite_code,'Squad code copied'));content.querySelector('[data-copy-link]')?.addEventListener('click',()=>typeof copyText==='function'&&copyText(typeof inviteLinkFor==='function'?inviteLinkFor(squad):location.href,'Invite link copied'));
    content.querySelector('[data-show-qr]')?.addEventListener('click',()=>{const wrap=content.querySelector('[data-qr-wrap]');const target=content.querySelector('[data-qr-code]');if(!wrap||!target)return;wrap.classList.toggle('lg-hidden');if(!wrap.classList.contains('lg-hidden')&&!target.dataset.ready&&window.QRCode){target.dataset.ready='1';window.QRCode.toCanvas(typeof inviteLinkFor==='function'?inviteLinkFor(squad):location.href,{width:150,margin:1},(error,canvas)=>{if(!error){target.innerHTML='';target.appendChild(canvas)}})}});
  }

  function improveLeaderboard(){const button=document.querySelector('[data-squad-tab="leaderboard"]');if(!button?.classList.contains('bg-indigo-600'))return;const heading=[...document.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Leaderboard');if(heading)heading.textContent='Full squad leaderboard';const sub=heading?.parentElement?.querySelector('p');if(sub)sub.textContent='See every member’s XP and switch between this week and all-time performance.'}
  function improveActivity(){const button=document.querySelector('[data-squad-tab="activity"]');if(!button?.classList.contains('bg-indigo-600'))return;const heading=[...document.querySelectorAll('h3')].find(h=>h.textContent.trim()==='Squad Activity');if(heading)heading.textContent='Squad activity';const sub=heading?.parentElement?.querySelector('p');if(sub)sub.textContent='Recent learning activity only — answers and learner work are not shared.'}
  function enhance(){updateSidebar();ensureIntro();improveTabs();improveSquadSwitcher();improveActiveSquadHeader();renderOverview();improveLeaderboard();improveActivity();if(window.lucide?.createIcons)window.lucide.createIcons()}
  let queued=false;const observer=new MutationObserver(()=>{if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;enhance()})});observer.observe(app,{childList:true,subtree:true});
  document.getElementById('squad-menu-open')?.addEventListener('click',()=>document.body.classList.add('lg-menu-open'));document.getElementById('squad-menu-overlay')?.addEventListener('click',()=>document.body.classList.remove('lg-menu-open'));document.querySelectorAll('#squad-sidebar .lg-nav-link').forEach(link=>link.addEventListener('click',()=>document.body.classList.remove('lg-menu-open')));enhance();
})();
