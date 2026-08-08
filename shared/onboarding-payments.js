/* Adds US paid-plan handoff without changing the core onboarding flow. */
(function(){
  const root=document.getElementById('ob-root');
  if(!root)return;

  function wirePlans(){
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
      const choose=()=>{ location.href=`/us-subscribe.html?plan=${encodeURIComponent(keys[index])}`; };
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