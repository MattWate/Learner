const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function mapPaystackPlanToTier(planCode, env) {
  const cleanCode = planCode ? String(planCode).trim() : '';
  if (env.PAYSTACK_PLAN_SINGLE_CODE && cleanCode === env.PAYSTACK_PLAN_SINGLE_CODE.trim()) return { tier: 'paid_single', profile_limit: 1, plan_code:'ZA_SINGLE_MONTHLY' };
  if (env.PAYSTACK_PLAN_FAMILY_CODE && cleanCode === env.PAYSTACK_PLAN_FAMILY_CODE.trim()) return { tier: 'paid_family', profile_limit: 2, plan_code:'ZA_FAMILY_MONTHLY' };
  if (env.PAYSTACK_PLAN_ULTRA_CODE && cleanCode === env.PAYSTACK_PLAN_ULTRA_CODE.trim()) return { tier: 'paid_ultra', profile_limit: 4, plan_code:'ZA_FAMILY_PLUS_MONTHLY' };
  return null;
}

function verifyPaystackSignature(rawBody,signature,secret){
  if(!rawBody||!signature||!secret)return false;
  const expected=crypto.createHmac('sha512',secret).update(rawBody).digest('hex');
  const a=Buffer.from(expected,'utf8');
  const b=Buffer.from(String(signature),'utf8');
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}

async function resolveUserId(supabase,eventData){
  const metadata=eventData.metadata||{};
  if(metadata.supabase_user_id)return metadata.supabase_user_id;
  if(eventData.custom_fields){
    const field=eventData.custom_fields.find(f=>f.variable_name==='supabase_user_id');
    if(field?.value)return field.value;
  }
  const email=eventData.customer?.email;
  if(email){
    const {data,error}=await supabase.from('accounts').select('id').eq('parent_email',email).maybeSingle();
    if(error)throw error;
    if(data?.id)return data.id;
  }
  return null;
}

async function upsertSubscription(supabase,userId,subscriptionId,tierInfo,eventData,status='active'){
  if(!subscriptionId)return;
  const {data:existing,error:existingError}=await supabase.from('subscriptions')
    .select('id')
    .eq('provider','paystack')
    .eq('provider_subscription_id',subscriptionId)
    .maybeSingle();
  if(existingError)throw existingError;

  const row={
    account_id:userId,
    provider:'paystack',
    region_code:'ZA',
    plan_code:tierInfo.plan_code,
    currency:'ZAR',
    provider_customer_id:eventData.customer?.customer_code||eventData.customer?.id||null,
    provider_subscription_id:subscriptionId,
    status,
    current_period_start:eventData.created_at||null,
    current_period_end:eventData.next_payment_date||null,
    updated_at:new Date().toISOString(),
    metadata:{paystack_plan_code:eventData.plan?.plan_code||eventData.plan_code||eventData.plan||null}
  };
  if(existing?.id){
    const {error}=await supabase.from('subscriptions').update(row).eq('id',existing.id);
    if(error)throw error;
  }else{
    const {error}=await supabase.from('subscriptions').insert(row);
    if(error)throw error;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  const { SUPABASE_URL, SUPABASE_SERVICE_KEY, PAYSTACK_SECRET_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !PAYSTACK_SECRET_KEY) return {statusCode:500,body:'Webhook not configured'};

  const signature=event.headers['x-paystack-signature']||event.headers['X-Paystack-Signature'];
  if(!verifyPaystackSignature(event.body,signature,PAYSTACK_SECRET_KEY)){
    console.warn('Rejected Paystack webhook with invalid signature.');
    return {statusCode:401,body:'Invalid signature'};
  }

  try {
    const payload = JSON.parse(event.body);
    const eventType = payload.event;
    const eventData = payload.data || {};
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {auth:{autoRefreshToken:false,persistSession:false}});

    if (eventType === 'charge.success' || eventType === 'subscription.create') {
      const userId = await resolveUserId(supabase,eventData);
      if (!userId) return { statusCode: 200, body: 'Ignored: No User ID' };

      const metadata=eventData.metadata||{};
      const planCode = eventData.plan?.plan_code || eventData.plan || eventData.plan_code;
      let tierInfo = mapPaystackPlanToTier(planCode, process.env);
      if (!tierInfo && metadata.profile_limit) {
        if (Number(metadata.profile_limit)===1) tierInfo={tier:'paid_single',profile_limit:1,plan_code:'ZA_SINGLE_MONTHLY'};
        if (Number(metadata.profile_limit)===2) tierInfo={tier:'paid_family',profile_limit:2,plan_code:'ZA_FAMILY_MONTHLY'};
        if (Number(metadata.profile_limit)===4) tierInfo={tier:'paid_ultra',profile_limit:4,plan_code:'ZA_FAMILY_PLUS_MONTHLY'};
      }
      if (!tierInfo) return { statusCode: 200, body: 'Ignored: Unknown Plan' };

      const subscriptionId = eventData.subscription_code || eventData.subscription?.subscription_code || (eventType==='subscription.create'?eventData.id:null);
      if(subscriptionId) await upsertSubscription(supabase,userId,String(subscriptionId),tierInfo,eventData,'active');

      const accountUpdate={active_tier:tierInfo.tier,subscription_status:'active',profile_limit:tierInfo.profile_limit,billing_region:'ZA'};
      if(subscriptionId) accountUpdate.subscription_id=String(subscriptionId);
      const { error } = await supabase.from('accounts').update(accountUpdate).eq('id', userId);
      if (error) throw error;
    }

    else if (eventType === 'subscription.not_renew') {
      const subscriptionId=eventData.subscription_code || eventData.subscription?.subscription_code || eventData.id;
      if(subscriptionId){
        const {data:subRow,error:subError}=await supabase.from('subscriptions').select('id').eq('provider','paystack').eq('provider_subscription_id',String(subscriptionId)).maybeSingle();
        if(subError)throw subError;
        if(subRow?.id){
          const {error}=await supabase.from('subscriptions').update({
            cancel_at_period_end:true,
            updated_at:new Date().toISOString(),
            metadata:{last_paystack_event:eventType}
          }).eq('id',subRow.id);
          if(error)throw error;
        }
      }
      // Keep account access active until Paystack sends subscription.disable.
    }

    else if (eventType === 'subscription.disable') {
      const subscriptionId=eventData.subscription_code || eventData.subscription?.subscription_code || eventData.id;
      let userId=await resolveUserId(supabase,eventData);
      let subRow=null;
      if(subscriptionId){
        const {data,error}=await supabase.from('subscriptions').select('id,account_id').eq('provider','paystack').eq('provider_subscription_id',String(subscriptionId)).maybeSingle();
        if(error)throw error;
        subRow=data||null;
        if(subRow?.account_id)userId=subRow.account_id;
        if(subRow?.id){
          const {error:updateError}=await supabase.from('subscriptions').update({status:'cancelled',cancel_at_period_end:false,updated_at:new Date().toISOString(),metadata:{last_paystack_event:eventType}}).eq('id',subRow.id);
          if(updateError)throw updateError;
        }
      }
      if (userId) {
        const {data:account,error:accountReadError}=await supabase.from('accounts').select('subscription_id').eq('id',userId).maybeSingle();
        if(accountReadError)throw accountReadError;
        if(!subscriptionId || String(account?.subscription_id||'')===String(subscriptionId)){
          const { error } = await supabase.from('accounts').update({active_tier:'free',subscription_status:'cancelled',profile_limit:1,subscription_id:null}).eq('id', userId);
          if (error) throw error;
        }
      }
    }

    return { statusCode: 200, body: 'OK' };
  } catch (error) {
    console.error('Paystack webhook error:', error);
    return { statusCode: 500, body: 'Webhook processing failed.' };
  }
};