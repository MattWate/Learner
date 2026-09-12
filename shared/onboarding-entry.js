/* LearnerGenie onboarding entry. Creates or signs into the account before asking which product path to set up. */
(function(){
  const root=document.getElementById('ob-root');
  const client=window.LearnerAuth?.supabase;
  let slotState={limit:1,count:0,canAdd:true};

  function setStep(step=1){
    const widths={1:12,2:38,3:70,4:100};
    const fill=document.getElementById('ob-fill'); if(fill) fill.style.width=`${widths[step]||12}%`;
    const text=document.getElementById('ob-progress-text'); if(text) text.textContent=`${step} of 4`;
    const stage=document.getElementById('ob-stage');
    if(stage) stage.textContent=step===1?'Create your account':step===2?'Choose how you will use it':step===3?'Quick setup':'Ready to go';
    document.querySelectorAll('.ob-step').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.step)===step));
  }

  function safeReturnPath(){
    const value=`${location.pathname}${location.search}`;
    return value.startsWith('/')&&!value.startsWith('//')?value:'/onboarding.html';
  }

  function enforceProfileSlots(){
    if(slotState.canAdd)return;
    root.querySelectorAll('a[href*="mode=family"][href*="add=1"]').forEach(link=>link.remove());
  }

  const loadAuthenticatedFlow=()=>{
    const observer=new MutationObserver(enforceProfileSlots);
    observer.observe(root,{childList:true,subtree:true});
    const s=document.createElement('script');
    s.src='/shared/onboarding.js';
    document.body.appendChild(s);
  };

  async function loadSlotState(userId){
    const [{data:account},{count}]=await Promise.all([
      client.from('accounts').select('profile_limit').eq('id',userId).maybeSingle(),
      client.from('profiles').select('id',{count:'exact',head:true}).eq('account_id',userId).eq('status','active')
    ]);
    const limit=Math.max(1,Number(account?.profile_limit ?? 1));
    const current=Number(count ?? 0);
    slotState={limit,count:current,canAdd:current<limit};
    window.LearnerProfileSlots=slotState;
  }

  async function continueWithSession(session){
    try{await loadSlotState(session.user.id);}catch(error){console.warn('Could not resolve learner profile slots.',error);}
    const params=new URLSearchParams(location.search);
    if(params.get('mode')==='family'&&params.get('add')==='1'&&!slotState.canAdd){
      location.replace('/app.html');
      return;
    }
    loadAuthenticatedFlow();
  }

  function showMessage(message){
    const existing=root.querySelector('.ob-error');
    if(existing)existing.remove();
    root.querySelector('.ob-card')?.insertAdjacentHTML('beforeend',`<div class="ob-error">${String(message||'Something went wrong.').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>`);
  }

  function showVerify(email){
    setStep(1);
    root.innerHTML=`<section class="ob-card">
      <div class="ob-success"><i data-lucide="mail-check"></i></div>
      <div class="ob-eyebrow" style="margin-top:18px">One quick check</div>
      <h2>Check your email.</h2>
      <p class="ob-sub">We sent a confirmation link to <strong>${email.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</strong>. Open it and we'll bring you straight back here to finish setup.</p>
      <div class="ob-info"><strong>Why verify?</strong> It keeps your LearnerGenie account secure and makes sure you can recover access later.</div>
      <div class="ob-actions"><button class="ob-btn ob-btn-ghost" id="use-other-email">Use a different email</button></div>
    </section>`;
    document.getElementById('use-other-email').onclick=()=>showAuth('register',email);
    window.lucide?.createIcons();
  }

  function showAuth(mode='register',prefill=''){
    const isLogin=mode==='login';
    setStep(1);
    root.innerHTML=`<section class="ob-card">
      <div class="ob-eyebrow">${isLogin?'Welcome back':'Start with the basics'}</div>
      <h2>${isLogin?'Log in to continue.':'Create your LearnerGenie account.'}</h2>
      <p class="ob-sub">${isLogin?'Use the email and password you already use for LearnerGenie.':'Just your email and a password for now. We will ask how you want to use LearnerGenie next.'}</p>
      <form id="ob-auth-form" style="max-width:520px">
        <div class="ob-field"><label for="ob-email">Email address</label><input id="ob-email" type="email" autocomplete="email" required value="${prefill.replace(/"/g,'&quot;')}" placeholder="you@example.com"></div>
        <div class="ob-field" style="margin-top:16px"><label for="ob-password">Password</label><input id="ob-password" type="password" autocomplete="${isLogin?'current-password':'new-password'}" required placeholder="At least 6 characters"></div>
        <div class="ob-actions">
          <button class="ob-btn ob-btn-primary" id="ob-auth-submit" type="submit">${isLogin?'Log in and continue':'Create account and continue'} <i data-lucide="arrow-right"></i></button>
        </div>
      </form>
      <p class="ob-info" style="margin-top:22px">${isLogin?'Need an account? <button type="button" id="switch-auth" style="border:0;background:transparent;color:#2f7f78;font:inherit;font-weight:800;cursor:pointer;padding:0">Create one here</button>.':'Already have a LearnerGenie account? <button type="button" id="switch-auth" style="border:0;background:transparent;color:#2f7f78;font:inherit;font-weight:800;cursor:pointer;padding:0">Log in instead</button>.'}</p>
    </section>`;

    document.getElementById('switch-auth').onclick=()=>{
      const email=document.getElementById('ob-email')?.value.trim()||'';
      showAuth(isLogin?'register':'login',email);
    };

    document.getElementById('ob-auth-form').onsubmit=async event=>{
      event.preventDefault();
      const email=document.getElementById('ob-email').value.trim();
      const password=document.getElementById('ob-password').value;
      const button=document.getElementById('ob-auth-submit');
      if(!email)return showMessage('Please enter your email address.');
      if(password.length<6)return showMessage('Use a password with at least 6 characters.');

      button.disabled=true;
      button.textContent=isLogin?'Logging in…':'Creating account…';

      try{
        if(isLogin){
          const {data,error}=await client.auth.signInWithPassword({email,password});
          if(error)throw error;
          if(data?.session)return continueWithSession(data.session);
          throw new Error('We could not start your session. Please try again.');
        }

        const {data,error}=await client.auth.signUp({
          email,
          password,
          options:{emailRedirectTo:location.origin+safeReturnPath()}
        });
        if(error)throw error;
        if(data?.session)return continueWithSession(data.session);
        if(data?.user&&Array.isArray(data.user.identities)&&data.user.identities.length===0){
          button.disabled=false;
          button.textContent='Create account and continue';
          return showMessage('That email may already have a LearnerGenie account. Try “Log in instead”.');
        }
        if(data?.user)return showVerify(email);
        throw new Error('We could not create the account. Please try again.');
      }catch(error){
        button.disabled=false;
        button.innerHTML=`${isLogin?'Log in and continue':'Create account and continue'} <i data-lucide="arrow-right"></i>`;
        if(String(error?.message||'').includes('Invalid login credentials'))showMessage('That email and password do not match. Check them and try again.');
        else if(String(error?.message||'').includes('Email rate limit exceeded'))showMessage('Too many attempts just now. Please wait a moment and try again.');
        else showMessage(error?.message||'We could not continue. Please try again.');
        window.lucide?.createIcons();
      }
    };
    window.lucide?.createIcons();
  }

  async function init(){
    if(!client){
      root.innerHTML='<div class="ob-error">LearnerGenie could not connect to authentication.</div>';
      return;
    }
    const {data:{session}}=await client.auth.getSession();
    if(session)return continueWithSession(session);
    showAuth('register');
  }

  init().catch(error=>{
    console.warn('Onboarding entry failed.',error);
    showAuth('register');
  });
})();
