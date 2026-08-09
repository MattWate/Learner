/* LearnerGenie US PayPal subscriptions */
(function(){
  const plans={
    single:{label:'Single Learner',price:'5.99',planId:'P-5740462038639090PNJ3O4PY'},
    two:{label:'Family',price:'7.99',planId:'P-14687555TR922772BNJ3PASQ'},
    four:{label:'Family Plus',price:'10.99',planId:'P-7W719676VC417121XNJ3PHII'}
  };
  const client=window.LearnerAuth?.supabase;
  let session=null;
  let selected='single';
  let buttons=null;
  let billing=null;
  const msg=document.getElementById('payment-message');
  const title=document.getElementById('checkout-title');
  const container='#paypal-button-container';
  const esc=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function showMessage(text,type='error'){
    msg.innerHTML=`<div class="message ${type}">${esc(text)}</div>`;
  }

  async function loadPayPalSdk(){
    if(window.paypal)return;
    const res=await fetch('/.netlify/functions/paypal-client-config',{cache:'no-store'});
    const body=await res.json().catch(()=>({}));
    if(!res.ok||!body.clientId)throw new Error(body.error||'PayPal checkout is not configured.');
    await new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=`https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(body.clientId)}&components=buttons&vault=true&intent=subscription`;
      script.onload=resolve;
      script.onerror=()=>reject(new Error('PayPal checkout could not be loaded.'));
      document.head.appendChild(script);
    });
    if(!window.paypal)throw new Error('PayPal checkout did not initialise correctly.');
  }

  async function loadBilling(){
    const res=await fetch('/.netlify/functions/billing-status',{headers:{authorization:`Bearer ${session.access_token}`}});
    const body=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(body.error||'Could not load your current subscription.');
    billing=body;
    return body;
  }

  function hasExistingSubscription(){
    const status=billing?.subscription?.status||billing?.subscription_status;
    const paidTier=String(billing?.active_tier||'free').toLowerCase()!=='free';
    return paidTier||['active','paid','trialing','past_due'].includes(String(status||'').toLowerCase());
  }

  function showExistingSubscription(){
    const current=billing?.subscription;
    const provider=current?.provider||'your payment provider';
    const plan=current?.plan_code||billing?.active_tier||'current plan';
    document.querySelector(container).innerHTML='';
    title.textContent='Subscription already active';
    showMessage(`This LearnerGenie account already has an active subscription (${plan}) through ${provider}. To avoid duplicate billing, a second subscription cannot be started here.`,'success');
  }

  function setSelected(key){
    selected=key;
    document.querySelectorAll('[data-plan]').forEach(b=>b.classList.toggle('active',b.dataset.plan===key));
    const p=plans[key];title.textContent=`${p.label} · $${p.price}/month`;
    if(hasExistingSubscription())showExistingSubscription();else renderButton();
  }

  function renderButton(){
    const el=document.querySelector(container);el.innerHTML='';msg.innerHTML='';
    const p=plans[selected];
    buttons=paypal.Buttons({
      style:{shape:'rect',color:'gold',layout:'vertical',label:'subscribe'},
      createSubscription(data,actions){
        return actions.subscription.create({plan_id:p.planId,custom_id:session.user.id});
      },
      async onApprove(data){
        try{
          showMessage('PayPal approved the subscription. Verifying your LearnerGenie access…','success');
          const token=session?.access_token;if(!token)throw new Error('Your LearnerGenie session has expired. Please log in again.');
          const res=await fetch('/.netlify/functions/paypal-verify-subscription',{
            method:'POST',
            headers:{'content-type':'application/json','authorization':`Bearer ${token}`},
            body:JSON.stringify({subscription_id:data.subscriptionID})
          });
          const body=await res.json().catch(()=>({}));
          if(res.status===202&&body.pending){
            showMessage(body.message||'Your subscription is awaiting PayPal activation. LearnerGenie will activate it automatically.','success');
            setTimeout(()=>{location.href='/app.html';},1800);
            return;
          }
          if(!res.ok)throw new Error(body.error||'We could not verify the PayPal subscription.');
          showMessage('Subscription active. Your LearnerGenie account has been upgraded.','success');
          setTimeout(()=>{location.href='/app.html';},1100);
        }catch(err){showMessage(err.message||'Payment verification failed.');}
      },
      onCancel(){showMessage('Checkout was cancelled. No changes were made to your LearnerGenie account.');},
      onError(err){console.error(err);showMessage('PayPal could not start checkout. Please try again.');}
    });
    buttons.render(container);
  }

  async function init(){
    if(!client){showMessage('LearnerGenie could not connect to authentication.');return;}
    session=await window.LearnerAuth.requireSession();if(!session)return;
    const params=new URLSearchParams(location.search);if(plans[params.get('plan')])selected=params.get('plan');
    document.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>setSelected(b.dataset.plan));
    try{
      await loadBilling();
      if(!hasExistingSubscription())await loadPayPalSdk();
    }catch(err){showMessage(err.message);return;}
    setSelected(selected);window.lucide?.createIcons();
  }
  init();
})();