const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const PLAN_MAP = {
  'P-5740462038639090PNJ3O4PY': { plan_code:'US_SINGLE_MONTHLY', tier:'paid_single', profile_limit:1 },
  'P-14687555TR922772BNJ3PASQ': { plan_code:'US_FAMILY_MONTHLY', tier:'paid_family', profile_limit:2 },
  'P-7W719676VC417121XNJ3PHII': { plan_code:'US_FAMILY_PLUS_MONTHLY', tier:'paid_ultra', profile_limit:4 }
};

async function paypalAccessToken(clientId, clientSecret){
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
    method:'POST',
    headers:{authorization:`Basic ${auth}`,'content-type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials'
  });
  if(!res.ok) throw new Error('PayPal authentication failed.');
  return (await res.json()).access_token;
}

async function upsertSubscription(supabase, userId, subscription, plan){
  const subscriptionId=subscription.id;
  const {data:existing,error:existingError}=await supabase
    .from('subscriptions')
    .select('id')
    .eq('provider','paypal')
    .eq('provider_subscription_id',subscriptionId)
    .maybeSingle();
  if(existingError) throw existingError;

  const row={
    account_id:userId,
    provider:'paypal',
    region_code:'US',
    plan_code:plan.plan_code,
    currency:'USD',
    provider_customer_id:subscription.subscriber?.payer_id||null,
    provider_subscription_id:subscriptionId,
    status:'active',
    current_period_start:subscription.billing_info?.last_payment?.time||subscription.start_time||null,
    current_period_end:subscription.billing_info?.next_billing_time||null,
    updated_at:new Date().toISOString(),
    metadata:{paypal_status:subscription.status,paypal_plan_id:subscription.plan_id}
  };

  if(existing?.id){
    const {error}=await supabase.from('subscriptions').update(row).eq('id',existing.id);
    if(error) throw error;
    return existing.id;
  }

  const {data,error}=await supabase.from('subscriptions').insert(row).select('id').single();
  if(error) throw error;
  return data.id;
}

exports.handler = async (event) => {
  if(event.httpMethod !== 'POST') return {statusCode:405,body:JSON.stringify({error:'Method not allowed'})};
  const { PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if(!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_KEY){
    return {statusCode:500,body:JSON.stringify({error:'Payment verification is not configured yet.'})};
  }

  try{
    const bearer=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
    if(!bearer) return {statusCode:401,body:JSON.stringify({error:'Please log in again before subscribing.'})};

    const supabase=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:userData,error:userError}=await supabase.auth.getUser(bearer);
    if(userError || !userData?.user) return {statusCode:401,body:JSON.stringify({error:'Your LearnerGenie session could not be verified.'})};
    const userId=userData.user.id;

    const payload=JSON.parse(event.body||'{}');
    const subscriptionId=String(payload.subscription_id||'').trim();
    if(!subscriptionId) return {statusCode:400,body:JSON.stringify({error:'Missing PayPal subscription ID.'})};

    const token=await paypalAccessToken(PAYPAL_CLIENT_ID,PAYPAL_CLIENT_SECRET);
    const ppRes=await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,{
      headers:{authorization:`Bearer ${token}`,'content-type':'application/json'}
    });
    if(!ppRes.ok) return {statusCode:400,body:JSON.stringify({error:'PayPal could not confirm this subscription.'})};

    const subscription=await ppRes.json();
    const plan=PLAN_MAP[subscription.plan_id];
    if(!plan) return {statusCode:400,body:JSON.stringify({error:'This PayPal plan is not recognised by LearnerGenie.'})};
    if(String(subscription.custom_id||'') !== userId) return {statusCode:403,body:JSON.stringify({error:'This PayPal subscription does not belong to the signed-in LearnerGenie account.'})};

    const {data:otherActive,error:activeError}=await supabase
      .from('subscriptions')
      .select('id,provider_subscription_id,plan_code')
      .eq('account_id',userId)
      .eq('provider','paypal')
      .eq('status','active')
      .neq('provider_subscription_id',subscriptionId)
      .limit(1)
      .maybeSingle();
    if(activeError) throw activeError;
    if(otherActive){
      return {statusCode:409,body:JSON.stringify({error:'This account already has an active PayPal subscription. Please manage the existing subscription before starting another one.'})};
    }

    if(subscription.status !== 'ACTIVE'){
      return {statusCode:202,headers:{'content-type':'application/json'},body:JSON.stringify({
        ok:false,
        pending:true,
        status:subscription.status,
        message:`PayPal reports the subscription as ${subscription.status}. LearnerGenie will activate the account automatically when PayPal confirms activation.`
      })};
    }

    await upsertSubscription(supabase,userId,subscription,plan);

    const {error:accountError}=await supabase.from('accounts').update({
      active_tier:plan.tier,
      subscription_id:subscriptionId,
      subscription_status:'active',
      profile_limit:plan.profile_limit,
      billing_region:'US'
    }).eq('id',userId);
    if(accountError) throw accountError;

    return {statusCode:200,headers:{'content-type':'application/json'},body:JSON.stringify({ok:true,plan_code:plan.plan_code,profile_limit:plan.profile_limit})};
  }catch(error){
    console.error('PayPal verification error',error);
    return {statusCode:500,headers:{'content-type':'application/json'},body:JSON.stringify({error:error.message||'Subscription verification failed.'})};
  }
};