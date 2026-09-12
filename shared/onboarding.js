/* LearnerGenie role-aware onboarding. Account creation happens before this script is loaded. */
(function(){
  const root=document.getElementById('ob-root');
  const client=window.LearnerAuth?.supabase;
  const STORAGE_KEY='learnergenie_onboarding_draft';
  let session,account;
  const defaults={path:null,country:'US',name:'',grade:'5',curriculum:'US_COMMON_CORE',language:'English',educatorType:'private_tutor',workspaceType:'individual',organisationName:'',grades:['4','5','6'],subjects:['Math','English']};
  let state={...defaults};

  try{
    const saved=JSON.parse(sessionStorage.getItem(STORAGE_KEY)||'null');
    if(saved&&typeof saved==='object')state={...state,...saved};
  }catch{}

  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
  const icon=()=>window.lucide?.createIcons();
  const persist=()=>sessionStorage.setItem(STORAGE_KEY,JSON.stringify(state));
  const clearDraft=()=>sessionStorage.removeItem(STORAGE_KEY);

  function setStep(step){
    const widths={1:12,2:38,3:70,4:100};
    document.getElementById('ob-fill').style.width=`${widths[step]||12}%`;
    document.getElementById('ob-progress-text').textContent=`${step} of 4`;
    document.getElementById('ob-stage').textContent=step===1?'Create your account':step===2?'Choose how you will use it':step===3?'Quick setup':'Ready to go';
    document.querySelectorAll('.ob-step').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.step)===step));
  }

  function render(html,step){
    root.innerHTML=`<section class="ob-card">${html}</section>`;
    setStep(step);
    icon();
    window.scrollTo({top:0,behavior:'smooth'});
  }

  function error(message){
    const old=root.querySelector('.ob-error');
    if(old)old.remove();
    root.querySelector('.ob-card')?.insertAdjacentHTML('beforeend',`<div class="ob-error">${esc(message)}</div>`);
  }

  function loading(button,label='Saving…'){
    button.disabled=true;
    button.dataset.old=button.innerHTML;
    button.textContent=label;
  }

  function restore(button){
    button.disabled=false;
    if(button.dataset.old)button.innerHTML=button.dataset.old;
    icon();
  }

  function backButton(target){
    return `<button class="ob-btn ob-btn-ghost" data-go="${target}"><i data-lucide="arrow-left"></i> Back</button>`;
  }

  function bindGo(){
    root.querySelectorAll('[data-go]').forEach(button=>{
      button.onclick=()=>{
        const target=button.dataset.go;
        if(screens[target])screens[target]();
      };
    });
  }

  function countryOptions(){
    return [
      ['US','United States'],
      ['GB','United Kingdom'],
      ['ZA','South Africa']
    ].map(([value,label])=>`<option value="${value}" ${state.country===value?'selected':''}>${label}</option>`).join('');
  }

  function levelOptions(country){
    if(country==='GB'){
      const values=[['R','Reception'],...Array.from({length:13},(_,i)=>[String(i+1),`Year ${i+1}`])];
      return values.map(([value,label])=>`<option value="${value}" ${String(state.grade)===value?'selected':''}>${label}</option>`).join('');
    }
    return Array.from({length:12},(_,i)=>{
      const value=String(i+1);
      return `<option value="${value}" ${String(state.grade)===value?'selected':''}>Grade ${value}</option>`;
    }).join('');
  }

  function setRegionalDefaults(country){
    const region=window.LearnerRegions.byCode(country);
    state.country=country;
    if(!region.curricula.some(([value])=>value===state.curriculum))state.curriculum=region.curricula[0][0];
    if(country==='GB'&&state.grade==='R')return;
    const max=country==='GB'?13:12;
    const numeric=Number(state.grade);
    if(!Number.isInteger(numeric)||numeric<1||numeric>max)state.grade='5';
  }

  function educationSystemFor(country,curriculum){
    if(country!=='GB')return curriculum;
    const code=String(curriculum||'').toUpperCase();
    if(code==='UK_SCOTLAND_CFE')return 'Scotland';
    if(code==='UK_WALES_CFW')return 'Wales';
    if(code==='UK_NI')return 'Northern Ireland';
    if(code==='CAMBRIDGE')return 'UK / international education';
    return 'England';
  }

  const screens={};

  screens.role=function(){
    render(`<div class="ob-eyebrow">Your LearnerGenie account is ready</div>
      <h2>What do you want to use LearnerGenie for?</h2>
      <p class="ob-sub">Choose the experience you want to set up first. You can add the other type later.</p>
      <div class="ob-choices">
        <button class="ob-choice" id="learner-choice">
          <div class="ob-choice-icon is-family"><i data-lucide="book-open-check"></i></div>
          <h3>I want a learner account</h3>
          <p>Revise, study, practise and get support with homework in a learner-focused workspace.</p>
          <small>Set up learner access →</small>
        </button>
        <button class="ob-choice" id="tutor-choice">
          <div class="ob-choice-icon is-edu"><i data-lucide="graduation-cap"></i></div>
          <h3>I want a tutor account</h3>
          <p>Manage learners, track progress and support the learners you are working with.</p>
          <small>Set up a free tutor workspace →</small>
        </button>
      </div>
      <div class="ob-info"><strong>Not sure?</strong> Pick the one you want to use today. The same login can support both later.</div>`,2);

    document.getElementById('learner-choice').onclick=()=>{
      state.path='family';
      persist();
      screens.familySetup();
    };
    document.getElementById('tutor-choice').onclick=()=>{
      state.path='educator';
      persist();
      screens.educatorWork();
    };
  };

  screens.familySetup=function(){
    setRegionalDefaults(state.country);
    const region=window.LearnerRegions.byCode(state.country);
    render(`<div class="ob-eyebrow">Learner setup</div>
      <h2>Tell us a little about the learner.</h2>
      <p class="ob-sub">We only need the essentials to personalise the learning experience. You can change these details later in Profile Settings.</p>
      <div class="ob-grid">
        <div class="ob-field">
          <label for="learner-name">First name</label>
          <input id="learner-name" value="${esc(state.name)}" placeholder="First name" autocomplete="given-name">
        </div>
        <div class="ob-field">
          <label for="grade" id="level-label">${state.country==='GB'?'School year':'Grade'}</label>
          <select id="grade">${levelOptions(state.country)}</select>
        </div>
        <div class="ob-field ob-full">
          <label for="country">Learning in</label>
          <select id="country">${countryOptions()}</select>
        </div>
      </div>
      <div class="ob-info">We'll use your region to choose sensible defaults for curriculum, terminology and maths conventions. Those settings can be fine-tuned later.</div>
      <div class="ob-actions">${backButton('role')}<button class="ob-btn ob-btn-primary" id="learner-next">Continue <i data-lucide="arrow-right"></i></button></div>`,3);
    bindGo();

    document.getElementById('country').onchange=event=>{
      state.name=document.getElementById('learner-name').value.trim();
      state.grade=document.getElementById('grade').value;
      setRegionalDefaults(event.target.value);
      const grade=document.getElementById('grade');
      const label=document.getElementById('level-label');
      label.textContent=state.country==='GB'?'School year':'Grade';
      grade.innerHTML=levelOptions(state.country);
      state.grade=grade.value;
      persist();
    };

    document.getElementById('learner-next').onclick=()=>{
      const name=document.getElementById('learner-name').value.trim();
      if(!name)return error('Please enter the learner’s first name.');
      state.name=name;
      state.grade=document.getElementById('grade').value;
      setRegionalDefaults(document.getElementById('country').value);
      state.grade=document.getElementById('grade').value;
      const r=window.LearnerRegions.byCode(state.country);
      state.curriculum=r.curricula[0][0];
      state.language='English';
      persist();
      screens.familyAccess();
    };
  };

  screens.familyAccess=function(){
    const region=window.LearnerRegions.byCode(state.country);
    render(`<div class="ob-eyebrow">Ready to learn</div>
      <h2>Start with LearnerGenie for free.</h2>
      <p class="ob-sub">${esc(state.name)} can start with ${region.freeWeeklyActivities} learning activities every week. No payment or card is required.</p>
      <div class="ob-freebox">
        <div class="ob-choice-icon" style="background:#fff0bd;color:#9a6900;margin:0"><i data-lucide="sparkles"></i></div>
        <div><strong>Free learner access</strong><br><span style="color:var(--muted);font-size:14px">Homework support, revision, practice and learning tools with ${region.freeWeeklyActivities} activities each week.</span></div>
      </div>
      <div class="ob-info">If LearnerGenie becomes useful, you can upgrade later from inside the learner workspace. For now, just start learning.</div>
      <div class="ob-actions">${backButton('familySetup')}<button class="ob-btn ob-btn-primary" id="complete-family">Start learning free <i data-lucide="arrow-right"></i></button></div>`,4);
    bindGo();
    document.getElementById('complete-family').onclick=completeFamily;
  };

  screens.educatorWork=function(){
    if(!state.organisationName){
      const local=String(session?.user?.email||'').split('@')[0].replace(/[._-]+/g,' ').trim();
      state.organisationName=local?`${local.replace(/\b\w/g,char=>char.toUpperCase())} Tutor Workspace`:'My Tutor Workspace';
    }
    render(`<div class="ob-eyebrow">Tutor setup</div>
      <h2>Set up your tutor workspace.</h2>
      <p class="ob-sub">Tell us how you work and what you'd like to call the workspace. You can add grades, subjects, groups and learners after you open the dashboard.</p>
      <div class="ob-choices">
        <button class="ob-choice ${state.workspaceType==='individual'?'is-selected':''}" data-work="individual">
          <div class="ob-choice-icon is-edu"><i data-lucide="user"></i></div>
          <h3>Just me</h3>
          <p>For an individual tutor or teacher managing their own learners.</p>
          <small>Free tutor workspace</small>
        </button>
        <button class="ob-choice ${state.workspaceType==='organisation'?'is-selected':''}" data-work="organisation">
          <div class="ob-choice-icon is-edu"><i data-lucide="building-2"></i></div>
          <h3>Centre, school or organisation</h3>
          <p>For a shared learning organisation that may later include staff or administrators.</p>
          <small>Organisation workspace</small>
        </button>
      </div>
      <div class="ob-field" style="margin-top:20px">
        <label for="workspace-name">Workspace name</label>
        <input id="workspace-name" value="${esc(state.organisationName)}" placeholder="My Tutor Workspace">
      </div>
      <div class="ob-info">Your tutor dashboard is free. Learner access remains separate, so families keep control of their own learner accounts.</div>
      <div class="ob-actions">${backButton('role')}<button class="ob-btn ob-btn-primary" id="work-next">Continue <i data-lucide="arrow-right"></i></button></div>`,3);
    bindGo();

    root.querySelectorAll('[data-work]').forEach(button=>{
      button.onclick=()=>{
        state.workspaceType=button.dataset.work;
        state.educatorType=state.workspaceType==='organisation'?'tutor_centre':'private_tutor';
        root.querySelectorAll('[data-work]').forEach(item=>item.classList.toggle('is-selected',item===button));
        persist();
      };
    });

    document.getElementById('work-next').onclick=()=>{
      const name=document.getElementById('workspace-name').value.trim();
      if(!name)return error('Please give your tutor workspace a name.');
      state.organisationName=name;
      state.educatorType=state.workspaceType==='organisation'?'tutor_centre':'private_tutor';
      const region=window.LearnerRegions.byCode(state.country);
      state.curriculum=region.curricula[0][0];
      persist();
      screens.educatorAccess();
    };
  };

  screens.educatorAccess=function(){
    render(`<div class="ob-eyebrow">Ready to tutor</div>
      <h2>Your tutor workspace is free to use.</h2>
      <p class="ob-sub">Create <strong>${esc(state.organisationName)}</strong> now, then add learners, groups, grades and subjects from the dashboard when you're ready.</p>
      <div class="ob-freebox">
        <div class="ob-choice-icon is-edu" style="margin:0"><i data-lucide="layout-dashboard"></i></div>
        <div><strong>Free tutor dashboard</strong><br><span style="color:var(--muted);font-size:14px">Manage connected learners, follow activity and organise your tutoring workspace.</span></div>
      </div>
      <div class="ob-actions">${backButton('educatorWork')}<button class="ob-btn ob-btn-primary" id="complete-educator">Create my free tutor workspace <i data-lucide="arrow-right"></i></button></div>`,4);
    bindGo();
    document.getElementById('complete-educator').onclick=completeEducator;
  };

  async function completeFamily(event){
    const button=event.currentTarget;
    loading(button,'Creating learner…');
    try{
      const region=window.LearnerRegions.byCode(state.country);
      const gradeLabel=state.country==='GB'
        ? (/^(r|reception)$/i.test(String(state.grade))?'Reception':`Year ${state.grade}`)
        : `Grade ${state.grade}`;
      const {data,error:rpcError}=await client.rpc('complete_family_onboarding',{
        p_name:state.name,
        p_grade:gradeLabel,
        p_language:state.language,
        p_country_code:state.country,
        p_curriculum_code:state.curriculum,
        p_education_system:educationSystemFor(state.country,state.curriculum),
        p_maths_convention:region.mathsConvention
      });
      if(rpcError)throw rpcError;
      const profileId=(typeof data==='object'&&data?.profile_id)||data;
      if(!profileId)throw new Error('Learner profile was created but no profile ID was returned.');
      clearDraft();
      location.href=`/app.html?profile_id=${encodeURIComponent(profileId)}`;
    }catch(err){
      restore(button);
      error(`We couldn't finish learner setup: ${err.message}`);
    }
  }

  async function completeEducator(event){
    const button=event.currentTarget;
    loading(button,'Creating workspace…');
    try{
      const region=window.LearnerRegions.byCode(state.country);
      const {error:rpcError}=await client.rpc('complete_educator_onboarding',{
        p_workspace_name:state.organisationName,
        p_workspace_type:state.workspaceType,
        p_educator_type:state.educatorType,
        p_country_code:state.country,
        p_curriculum_code:state.curriculum||region.curricula[0][0],
        p_grades:state.grades,
        p_subjects:state.subjects
      });
      if(rpcError)throw rpcError;
      clearDraft();
      location.href='/tutor-dashboard-v2.html';
    }catch(err){
      restore(button);
      error(`We couldn't create the tutor workspace: ${err.message}`);
    }
  }

  async function routeExisting(profiles,memberships){
    const last=account?.last_workspace_type;
    if(last==='educator'&&memberships.length)return location.replace('/tutor-dashboard-v2.html');
    if(profiles.length)return location.replace('/app.html');
    if(memberships.length)return location.replace('/tutor-dashboard-v2.html');
  }

  async function init(){
    if(!client){
      root.innerHTML='<div class="ob-error">LearnerGenie could not connect to authentication.</div>';
      return;
    }

    session=await window.LearnerAuth.requireSession();
    if(!session)return;
    account=await window.LearnerAuth.getAccount(session.user.id);

    const [{data:profiles,error:pError},{data:memberships,error:mError}]=await Promise.all([
      client.from('profiles').select('id').eq('account_id',session.user.id).limit(1),
      client.from('tutor_centre_users').select('tutor_centre_id,status').eq('account_id',session.user.id).eq('status','active').limit(1)
    ]);
    if(pError)console.warn(pError);
    if(mError)console.warn(mError);

    const params=new URLSearchParams(location.search);
    const forced=params.get('mode');
    const add=params.get('add')==='1';

    if(!forced&&!add&&((profiles||[]).length||(memberships||[]).length)){
      try{
        await client.from('accounts').update({onboarding_completed:true,onboarding_completed_at:new Date().toISOString()}).eq('id',session.user.id);
      }catch{}
      return routeExisting(profiles||[],memberships||[]);
    }

    const inferred=window.LearnerRegions.inferred().countryCode;
    if(!state.country||!window.LearnerRegions.regions[state.country])state.country=inferred;
    if(!sessionStorage.getItem(STORAGE_KEY))state.country=inferred;
    setRegionalDefaults(state.country);

    if(forced==='family'){
      state.path='family';
      persist();
      return screens.familySetup();
    }
    if(forced==='educator'){
      state.path='educator';
      persist();
      return screens.educatorWork();
    }

    screens.role();
  }

  init().catch(err=>{
    console.error('Onboarding failed.',err);
    root.innerHTML=`<div class="ob-error">LearnerGenie could not start onboarding: ${esc(err.message||err)}</div>`;
  });
})();
