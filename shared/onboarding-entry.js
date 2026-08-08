/* Public entry gate for LearnerGenie onboarding. Shows role choice before auth, then resumes the authenticated flow. */
(function(){
  const root=document.getElementById('ob-root');
  const client=window.LearnerAuth?.supabase;
  const setStep=()=>{
    const fill=document.getElementById('ob-fill'); if(fill) fill.style.width='12%';
    const text=document.getElementById('ob-progress-text'); if(text) text.textContent='1 of 4';
    const stage=document.getElementById('ob-stage'); if(stage) stage.textContent='Getting started';
    document.querySelectorAll('.ob-step').forEach(el=>el.classList.toggle('is-active',Number(el.dataset.step)===1));
  };
  const loadAuthenticatedFlow=()=>{const s=document.createElement('script');s.src='/shared/onboarding.js';document.body.appendChild(s);};
  const authFor=mode=>{
    const next=`/onboarding.html?mode=${encodeURIComponent(mode)}`;
    location.href=`/login.html?next=${encodeURIComponent(next)}`;
  };
  function showPublicRoleChoice(){
    setStep();
    root.innerHTML=`<section class="ob-card"><div class="ob-eyebrow">Welcome to LearnerGenie</div><h2>How would you like to use LearnerGenie first?</h2><p class="ob-sub">Choose the experience you want to set up. You can add another workspace later.</p><div class="ob-choices"><button class="ob-choice" id="public-family-choice"><div class="ob-choice-icon is-family"><i data-lucide="heart-handshake"></i></div><h3>Support my child</h3><p>Create learner profiles and give your child guided support for homework, revision, maths and practice.</p><small>Family & learner access →</small></button><button class="ob-choice" id="public-educator-choice"><div class="ob-choice-icon is-edu"><i data-lucide="graduation-cap"></i></div><h3>Tutor or teach learners</h3><p>Organise learners, create groups and follow their learning activity from a free educator dashboard.</p><small>Tutor & teacher access is free →</small></button></div><p class="ob-info" style="margin-top:20px">Already have an account? Choose the route you want to open and log in with your existing email.</p></section>`;
    document.getElementById('public-family-choice').onclick=()=>authFor('family');
    document.getElementById('public-educator-choice').onclick=()=>authFor('educator');
    window.lucide?.createIcons();
  }
  async function init(){
    if(!client){root.innerHTML='<div class="ob-error">LearnerGenie could not connect to authentication.</div>';return;}
    const {data:{session}}=await client.auth.getSession();
    if(session) loadAuthenticatedFlow(); else showPublicRoleChoice();
  }
  init().catch(()=>showPublicRoleChoice());
})();
