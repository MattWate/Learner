/* Routes authenticated accounts before loading the learner dashboard. */
(function(){
  const root=document.getElementById('app-root');
  const client=window.LearnerAuth?.supabase;
  function loadDashboard(){const s=document.createElement('script');s.src='/shared/learner-dashboard.js';document.body.appendChild(s);}
  async function init(){
    if(!client)return loadDashboard();
    const session=await window.LearnerAuth.requireSession();if(!session)return;
    let account;
    try{const {data}=await client.from('accounts').select('onboarding_completed,last_workspace_type').eq('id',session.user.id).maybeSingle();account=data;}catch{}
    const [{data:profiles},{data:memberships}]=await Promise.all([
      client.from('profiles').select('id').eq('account_id',session.user.id).limit(1),
      client.from('tutor_centre_users').select('tutor_centre_id').eq('account_id',session.user.id).eq('status','active').limit(1)
    ]);
    const hasProfiles=!!profiles?.length,hasEducator=!!memberships?.length;
    if(!hasProfiles&&!hasEducator&&!account?.onboarding_completed){location.replace('/onboarding.html');return;}
    if(!hasProfiles&&hasEducator){location.replace('/tutor-dashboard-v2.html');return;}
    if(hasProfiles&&hasEducator&&account?.last_workspace_type==='educator'&&!new URLSearchParams(location.search).has('profile_id')){location.replace('/tutor-dashboard-v2.html');return;}
    loadDashboard();
  }
  init().catch(error=>{console.warn('App routing gate failed; loading learner dashboard.',error);loadDashboard();});
})();
