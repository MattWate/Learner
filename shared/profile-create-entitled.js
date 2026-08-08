/* Replaces the legacy direct profile insert for accounts with open learner slots. */
(function(){
  const root=document.getElementById('app-root');
  const client=window.LearnerAuth?.supabase;
  if(!root||!client)return;

  async function createLearner(){
    const name=prompt('Learner name');
    if(!name?.trim())return;
    const {data:{session}}=await client.auth.getSession();
    if(!session?.access_token)return alert('Please log in again before adding a learner.');
    const res=await fetch('/.netlify/functions/create-additional-learner',{
      method:'POST',
      headers:{'content-type':'application/json','authorization':`Bearer ${session.access_token}`},
      body:JSON.stringify({name:name.trim()})
    });
    const body=await res.json().catch(()=>({}));
    if(!res.ok)return alert(body.error||'Could not create learner profile.');
    location.href=`/app.html?profile_id=${encodeURIComponent(body.profile.id)}`;
  }

  function wire(){
    const add=document.getElementById('add-profile');
    if(add&&!add.dataset.entitlementAware){
      add.dataset.entitlementAware='1';
      add.onclick=createLearner;
    }
  }
  const observer=new MutationObserver(wire);
  observer.observe(root,{childList:true,subtree:true});
  wire();
})();