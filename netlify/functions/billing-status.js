const { createClient } = require('@supabase/supabase-js');

exports.handler=async(event)=>{
  if(event.httpMethod!=='GET') return {statusCode:405,body:JSON.stringify({error:'Method not allowed'})};
  const {SUPABASE_URL,SUPABASE_SERVICE_KEY}=process.env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_KEY) return {statusCode:500,body:JSON.stringify({error:'Billing status is not configured.'})};

  try{
    const bearer=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
    if(!bearer) return {statusCode:401,body:JSON.stringify({error:'Please log in again.'})};

    const supabase=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:userData,error:userError}=await supabase.auth.getUser(bearer);
    if(userError||!userData?.user) return {statusCode:401,body:JSON.stringify({error:'Your session could not be verified.'})};
    const userId=userData.user.id;

    const [{data:account,error:accountError},{data:subscription,error:subscriptionError}]=await Promise.all([
      supabase.from('accounts').select('active_tier,subscription_status,profile_limit,subscription_id,billing_region').eq('id',userId).maybeSingle(),
      supabase.from('subscriptions').select('provider,plan_code,status,provider_subscription_id,current_period_end').eq('account_id',userId).in('status',['active','trialing','past_due']).order('created_at',{ascending:false}).limit(1).maybeSingle()
    ]);
    if(accountError) throw accountError;
    if(subscriptionError) throw subscriptionError;

    return {statusCode:200,headers:{'content-type':'application/json'},body:JSON.stringify({
      active_tier:account?.active_tier||'free',
      subscription_status:account?.subscription_status||'free',
      profile_limit:Number(account?.profile_limit||1),
      subscription_id:account?.subscription_id||null,
      billing_region:account?.billing_region||null,
      subscription:subscription||null
    })};
  }catch(error){
    console.error('Billing status error',error);
    return {statusCode:500,headers:{'content-type':'application/json'},body:JSON.stringify({error:error.message||'Could not load billing status.'})};
  }
};