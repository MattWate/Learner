const Paystack = require('paystack-api');
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const {
      PAYSTACK_SECRET_KEY,
      PAYSTACK_PLAN_SINGLE_CODE,
      PAYSTACK_PLAN_FAMILY_CODE,
      PAYSTACK_PLAN_ULTRA_CODE,
      SUPABASE_URL,
      SUPABASE_SERVICE_KEY,
      URL
    } = process.env;

    if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Server configuration error: payment or authentication settings are missing.');
    }

    const bearer=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
    if(!bearer) return {statusCode:401,body:JSON.stringify({error:'Please log in again before subscribing.'})};

    const supabase=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:userData,error:userError}=await supabase.auth.getUser(bearer);
    if(userError||!userData?.user) return {statusCode:401,body:JSON.stringify({error:'Your LearnerGenie session could not be verified.'})};
    const userId=userData.user.id;
    const email=userData.user.email;

    const { plan } = JSON.parse(event.body||'{}');
    if (!plan) return {statusCode:400,body:JSON.stringify({error:'Missing plan.'})};

    const {data:current}=await supabase.from('subscriptions')
      .select('id,provider,plan_code,status')
      .eq('account_id',userId)
      .in('status',['active','trialing','past_due'])
      .order('created_at',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(current){
      return {statusCode:409,body:JSON.stringify({error:'This account already has a subscription. Manage the current subscription before starting another one.'})};
    }

    let rawPlanCode;
    let profileLimit;
    switch(plan) {
      case 'paid_single': rawPlanCode = PAYSTACK_PLAN_SINGLE_CODE; profileLimit = 1; break;
      case 'paid_family': rawPlanCode = PAYSTACK_PLAN_FAMILY_CODE; profileLimit = 2; break;
      case 'paid_ultra': rawPlanCode = PAYSTACK_PLAN_ULTRA_CODE; profileLimit = 4; break;
      default: return {statusCode:400,body:JSON.stringify({error:`Invalid plan selected: ${plan}`})};
    }
    if (!rawPlanCode) throw new Error(`Plan code missing for '${plan}'`);

    const paystack = Paystack(PAYSTACK_SECRET_KEY);
    const callbackUrl = URL ? `${URL}/app.html` : 'https://learnergenie.com/app.html';
    const result = await paystack.transaction.initialize({
      email,
      plan: rawPlanCode.trim(),
      amount: 100,
      callback_url: callbackUrl,
      metadata: { supabase_user_id: userId, profile_limit: profileLimit }
    });

    if (!result || !result.status) throw new Error(result?.message || 'Paystack initialization failed.');

    return {statusCode:200,headers:{'Content-Type':'application/json'},body:JSON.stringify({checkoutUrl:result.data.authorization_url})};
  } catch (error) {
    console.error('Paystack subscription creation error:', error.message || error);
    return {statusCode:500,headers:{'Content-Type':'application/json'},body:JSON.stringify({error:error.message||'Subscription creation failed.'})};
  }
};