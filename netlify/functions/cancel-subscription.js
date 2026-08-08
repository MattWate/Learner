const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

async function paystackRequest(path,secret,options={}){
  const res=await fetch(`https://api.paystack.co${path}`,{
    ...options,
    headers:{
      authorization:`Bearer ${secret}`,
      'content-type':'application/json',
      ...(options.headers||{})
    }
  });
  const body=await res.json().catch(()=>({}));
  if(!res.ok||body.status===false)throw new Error(body.message||'Paystack request failed.');
  return body;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return {statusCode:405,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:'Method Not Allowed'})};
  }

  const {SUPABASE_URL,SUPABASE_SERVICE_KEY,PAYSTACK_SECRET_KEY}=process.env;
  if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return {statusCode:500,body:JSON.stringify({error:'Server configuration error.'})};
  }

  try {
    const bearer=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
    if(!bearer)return{statusCode:401,body:JSON.stringify({error:'Please log in again before managing your subscription.'})};

    const supabase=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:userData,error:userError}=await supabase.auth.getUser(bearer);
    if(userError||!userData?.user)return{statusCode:401,body:JSON.stringify({error:'Your LearnerGenie session could not be verified.'})};
    const userId=userData.user.id;

    const [{data:account,error:accountError},{data:subRow,error:subError}]=await Promise.all([
      supabase.from('accounts').select('subscription_id').eq('id',userId).maybeSingle(),
      supabase.from('subscriptions').select('id,provider_subscription_id,status').eq('account_id',userId).eq('provider','paystack').in('status',['active','trialing','past_due']).order('created_at',{ascending:false}).limit(1).maybeSingle()
    ]);
    if(accountError)throw accountError;
    if(subError)throw subError;

    const subscriptionId=String(subRow?.provider_subscription_id||account?.subscription_id||'').trim();
    if(!subscriptionId)return{statusCode:400,body:JSON.stringify({error:'No active Paystack subscription was found for this account.'})};

    // Paystack requires the subscription's email_token in the disable request.
    const details=await paystackRequest(`/subscription/${encodeURIComponent(subscriptionId)}`,PAYSTACK_SECRET_KEY,{method:'GET'});
    const emailToken=details.data?.email_token;
    if(!emailToken)throw new Error('Paystack did not return the token required to cancel this subscription.');

    await paystackRequest('/subscription/disable',PAYSTACK_SECRET_KEY,{
      method:'POST',
      body:JSON.stringify({code:subscriptionId,token:emailToken})
    });

    if(subRow?.id){
      const {error}=await supabase.from('subscriptions').update({
        status:'cancelled',
        cancel_at_period_end:false,
        updated_at:new Date().toISOString(),
        metadata:{cancelled_from:'learnergenie'}
      }).eq('id',subRow.id);
      if(error)throw error;
    }

    const {error:updateError}=await supabase.from('accounts').update({
      active_tier:'free',
      subscription_id:null,
      subscription_status:'cancelled',
      profile_limit:1
    }).eq('id',userId);
    if(updateError)throw updateError;

    return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Subscription cancelled successfully.'})};
  } catch (error) {
    console.error('Cancel subscription error:',error);
    return {statusCode:500,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:error.message||'Could not cancel subscription.'})};
  }
};