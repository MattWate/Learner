/* Keeps learner-profile creation UI aligned with the account profile_limit. Backend limits remain authoritative. */
(function(){
  const root=document.getElementById('app-root');
  const client=window.LearnerAuth?.supabase;
  let canAdd=false;

  function apply(){
    const addButton=document.getElementById('add-profile');
    if(addButton&&!canAdd)addButton.remove();
  }

  async function init(){
    if(!root||!client)return;
    const {data:{session}}=await client.auth.getSession();
    if(!session)return;
    const [{data:account},{count}]=await Promise.all([
      client.from('accounts').select('profile_limit').eq('id',session.user.id).maybeSingle(),
      client.from('profiles').select('id',{count:'exact',head:true}).eq('account_id',session.user.id).eq('status','active')
    ]);
    const limit=Math.max(1,Number(account?.profile_limit ?? 1));
    canAdd=Number(count ?? 0)<limit;
    const observer=new MutationObserver(apply);
    observer.observe(root,{childList:true,subtree:true});
    apply();
  }

  init().catch(error=>console.warn('Could not apply learner profile slot UI.',error));
})();