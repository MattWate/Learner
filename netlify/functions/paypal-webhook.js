const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

async function accessToken(clientId, clientSecret){
  const auth=Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res=await fetch('https://api-m.paypal.com/v1/oauth2/token',{method:'POST',headers:{authorization:`Basic ${auth}`,'content-type':'application/x-www-form-urlencoded'},body:'grant_type=client_credentials'});
  if(!res.ok)throw new Error('PayPal authentication failed');
  return (await res.json()).access_token;
}

async function verifySignature(event, webhookEvent, token, webhookId){
  const h=event.headers||{};
  const body={auth_algo:h['paypal-auth-algo'],cert_url:h['paypal-cert-url'],transmission_id:h['paypal-transmission-id'],transmission_sig:h['paypal-transmission-sig'],transmission_time:h['paypal-transmission-time'],webhook_id:webhookId,webhook_event:webhookEvent};
  const res=await fetch('https://api-m.paypal.com/v1/notifications/verify-webhook-signature',{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(body)});
  if(!res.ok)return false;
  return (await res.json()).verification_status==='SUCCESS';
}

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return{statusCode:405,body:'Method Not Allowed'};
  const {PAYPAL_CLIENT_ID,PAYPAL_CLIENT_SECRET,PAYPAL_WEBHOOK_ID,SUPABASE_URL,SUPABASE_SERVICE_KEY}=process.env;
  if(!PAYPAL_CLIENT_ID||!PAYPAL_CLIENT_SECRET||!PAYPAL_WEBHOOK_ID||!SUPABASE_URL||!SUPABASE_SERVICE_KEY)return{statusCode:500,body:'Webhook not configured'};
  try{
    const webhookEvent=JSON.parse(event.body||'{}');
    const token=await accessToken(PAYPAL_CLIENT_ID,PAYPAL_CLIENT_SECRET);
    if(!(await verifySignature(event,webhookEvent,token,PAYPAL_WEBHOOK_ID)))return{statusCode:400,body:'Invalid webhook signature'};
    const type=webhookEvent.event_type;
    const resource=webhookEvent.resource||{};
    const subscriptionId=resource.id||resource.billing_agreement_id||resource.subscription_id;
    if(!subscriptionId)return{statusCode:200,body:'Ignored'};
    const supabase=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:sub}=await supabase.from('subscriptions').select('id,account_id').eq('provider','paypal').eq('provider_subscription_id',subscriptionId).maybeSingle();
    if(!sub)return{statusCode:200,body:'Unknown subscription'};

    const inactiveEvents=['BILLING.SUBSCRIPTION.CANCELLED','BILLING.SUBSCRIPTION.SUSPENDED','BILLING.SUBSCRIPTION.EXPIRED','BILLING.SUBSCRIPTION.PAYMENT.FAILED'];
    if(inactiveEvents.includes(type)){
      const status=type.includes('CANCELLED')?'cancelled':type.includes('EXPIRED')?'expired':type.includes('SUSPENDED')?'past_due':'past_due';
      await supabase.from('subscriptions').update({status,updated_at:new Date().toISOString(),metadata:{last_paypal_event:type}}).eq('id',sub.id);
      await supabase.from('accounts').update({active_tier:'free',subscription_status:status,profile_limit:1}).eq('id',sub.account_id);
      const {data:profiles}=await supabase.from('profiles').select('id').eq('account_id',sub.account_id);
      for(const profile of (profiles||[]))await supabase.from('learner_entitlements').upsert({profile_id:profile.id,entitlement_type:'free',source_type:'free',subscription_id:null,weekly_activity_limit:5,status:'active',updated_at:new Date().toISOString()},{onConflict:'profile_id'});
    }else if(type==='BILLING.SUBSCRIPTION.ACTIVATED'){
      await supabase.from('subscriptions').update({status:'active',updated_at:new Date().toISOString(),metadata:{last_paypal_event:type}}).eq('id',sub.id);
    }
    return{statusCode:200,body:'OK'};
  }catch(error){console.error('PayPal webhook error',error);return{statusCode:500,body:'Webhook processing failed'}};
};