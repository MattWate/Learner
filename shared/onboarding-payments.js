/* Adds US paid-plan handoff while keeping account subscription state authoritative. */
(function(){
  const root=document.getElementById('ob-root');
  if(!root)return;
  const PENDING_KEY='learnergenie_pending_paid_plan';

  function cleanCopy(){
    root.querySelectorAll('.ob-info').forEach(el=>{
      if(el.textContent.includes('Each learner remains Free or Premium according to their own entitlement.')){
        el.innerHTML='<strong>Important:</strong> free tutor access does not grant learner product access. Learner access is governed by the owning family account plan.';
      }
    });
  }

  function maybeContinueToCheckout(){
    const pending=sessionStorage.getItem(PENDING_KEY);
    if(!pending)return false;
    const startLink=root.querySelector('a[href^="/app.html?profile_id="]');
    if(!startLink)return false;
    sessionStorage.removeItem(PENDING_KEY);
    location.replace(`/us-subscribe.html?plan=${encodeURIComponent(pending)}`);
    return true;
  }

  function wirePlans(){
    cleanCopy();
    if(maybeContinueToCheckout())return;

    const plans=[...root.querySelectorAll('.ob-plan')];
    if(plans.length!==3)return;
    const text=root.textContent||'';
    if(!text.includes('$5.99') || !text.includes('$7.99') || !text.includes('$10.99'))return;

    const keys=['single','two','four'];
    plans.forEach((plan,index)=>{
      if(plan.dataset.paypalWired)return;
      plan.dataset.paypalWired='1';
      plan.dataset.planKey=keys[index];
      plan.setAttribute('role','button');
      plan.setAttribute('tabindex','0');
      plan.style.cursor='pointer';
      plan.title='Choose this paid plan';

      const choose=()=>{
        const complete=document.getElementById('complete-family');
        if(!complete)return;
        sessionStorage.setItem(PENDING_KEY,keys[index]);
        complete.click();
      };
      plan.addEventListener('click',choose);
      plan.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' '){event.preventDefault();choose();}
      });
      if(!plan.querySelector('.ob-plan-action')){
        plan.insertAdjacentHTML('beforeend','<div class="ob-plan-action" style="margin-top:14px;font-size:13px;font-weight:800;color:#2f7f78">Choose paid plan →</div>');
      }
    });
  }

  const observer=new MutationObserver(wirePlans);
  observer.observe(root,{childList:true,subtree:true});
  wirePlans();
})();