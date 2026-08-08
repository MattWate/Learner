const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const PLAN_MAP = {
  'P-5740462038639090PNJ3O4PY': { plan_code:'US_SINGLE_MONTHLY', tier:'paid_single', profile_limit:1 },
  'P-14687555TR922772BNJ3PASQ': { plan_code:'US_FAMILY_MONTHLY', tier:'paid_family', profile_limit:2 },
  'P-7W719676VC417121XNJ3PHII': { plan_code:'US_FAMILY_PLUS_MONTHLY', tier:'paid_ultra', profile_limit:4 }
};

async function accessToken(clientId, clientSecret){
  const auth=Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res=await fetch('https://api-m.paypal.com/v1/oauth2/token',{
    method:'POST',
    headers:{authorization:`Basic ${auth}`,'content-type':'application/x-www-form-urlencoded'},
    body:'grant_type=client_credentials'
  });
  if(!res.ok) throw new Error('PayPal authentication failed');
  return (await res.json()).access_token;
}

async function verifySignature(event, webhookEvent, token, webhookId){
  const h=event.headers||{};
  const body={
    auth_algo:h['paypal-auth-algo'],
    cert_url:h['paypal-cert-url'],
    transmission_id:h['paypal-transmission-id'],
    transmission_sig:h['paypal-transmission-sig'],
    transmission_time:h['paypal-transmission-time'],
    webhook_id:webhookId,
    webhook_event:webhookEvent
  };
  const res=await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature',{
    method:'POST',
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  if(!res.ok) return false;
  return (await res.json()).verification_status==='SUCCESS';
}

async function fetchSubscription(subscriptionId,token){
  const res=await fetch(`https://api-m.paypal.com/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`,{
    headers:{authorization:`Bearer ${token}`,'content-type':'application/json'}
  });
  if(!res.ok) throw new Error(`Could not retrieve PayPal subscription ${subscriptionId}`);
  return res.json();
}

async function upsertSubscription(supabase,userId,subscription,plan,status='active'){
  const {data:existing,error:existingError}=await supabase.from('subscriptions')
    .select('id')
    .eq('provider','paypal')
    .eq('provider_subscription_id',subscription.id)
    .maybeSingle();
  if(existingError) throw existingError;

  const row={
    account_id:userId,
    provider:'paypal',
    region_code:'US',
    plan_code:plan.plan_code,
    currency:'USD',
    provider_customer_id:subscription.subscriber?.payer_id||null,
    provider_subscription_id:subscription.id,
    status,
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

async function activateAccount(supabase,subscription){
  const plan=PLAN_MAP[subscription.plan_id];
  const userId=String(subscription.custom_id||'');
  if(!plan || !userId) throw new Error('PayPal activation is missing a recognised plan or LearnerGenie account reference.');

  await upsertSubscription(supabase,userId,subscription,plan,'active');
  const {error}=await supabase.from('accounts').update({
    active_tier:plan.tier,
    subscription_id:subscription.id,
    subscription_status:'active',
    profile_limit:plan.profile_limit,
    billing_region:'US'
  }).eq('id',userId);
  if(error) throw error;
}

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST') return {statusCode:405,body:'Method Not Allowed'};
  const {PAYPAL_CLIENT_ID,PAYPAL_CLIENT_SECRET,PAYPAL_WEBHOOK_ID,SUPABASE_URL,SUPABASE_SERVICE_KEY}=process.env;
  if(!PAYPAL_CLIENT_ID||!PAYPAL_CLIENT_SECRET||!PAYPAL_WEBHOOK_ID||!SUPABASE_URL||!SUPABASE_SERVICE_KEY){
    return {statusCode:500,body:'Webhook not configured'};
  }

  try{
    const webhookEvent=JSON.parse(event.body||'{}');
    const token=await accessToken(PAYPAL_CLIENT_ID,PAYPAL_CLIENT_SECRET);
    if(!(await verifySignature(event,webhookEvent,token,PAYPAL_WEBHOOK_ID))) return {statusCode:400,body:'Invalid webhook signature'};

    const type=webhookEvent.event_type;
    const resource=webhookEvent.resource||{};
    const subscriptionId=resource.id||resource.billing_agreement_id||resource.subscription_id;
    if(!subscriptionId) return {statusCode:200,body:'Ignored'};

    const supabase=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});

    if(['BILLING.SUBSCRIPTION.ACTIVATED','BILLING.SUBSCRIPTION.UPDATED'].includes(type)){
      const subscription=await fetchSubscription(subscriptionId,token);
      if(subscription.status==='ACTIVE') await activateAccount(supabase,subscription);
      return {statusCode:200,body:'OK'};
    }

    const inactiveEvents={
      'BILLING.SUBSCRIPTION.CANCELLED':'cancelled',
      'BILLING.SUBSCRIPTION.SUSPENDED':'past_due',
      'BILLING.SUBSCRIPTION.EXPIRED':'expired',
      'BILLING.SUBSCRIPTION.PAYMENT.FAILED':'past_due'
    };

    if(inactiveEvents[type]){
      const status=inactiveEvents[type];
      const {data:sub,error:subError}=await supabase.from('subscriptions')
        .select('id,account_id')
        .eq('provider','paypal')
        .eq('provider_subscription_id',subscriptionId)
        .maybeSingle();
      if(subError) throw subError;
      if(!sub) return {statusCode:200,body:'Unknown subscription'};

      const {error:updateError}=await supabase.from('subscriptions').update({
        status,
        updated_at:new Date().toISOString(),
        metadata:{last_paypal_event:type}
      }).eq('id',sub.id);
      if(updateError) throw updateError;

      const {data:account,error:accountReadError}=await supabase.from('accounts')
        .select('subscription_id')
        .eq('id',sub.account_id)
        .maybeSingle();
      if(accountReadError) throw accountReadError;

      // Only downgrade if this is still the account's current subscription.
      if(String(account?.subscription_id||'')===String(subscriptionId)){
        const {error:accountError}=await supabase.from('accounts').update({
          active_tier:'free',
          subscription_status:status,
          profile_limit:1,
          subscription_id:null
        }).eq('id',sub.account_id);
        if(accountError) throw accountError;
      }
    }

    return {statusCode:200,body:'OK'};
  }catch(error){
    console.error('PayPal webhook error',error);
    return {statusCode:500,body:'Webhook processing failed'};
  }
};