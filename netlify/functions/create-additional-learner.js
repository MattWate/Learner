const { createClient } = require('@supabase/supabase-js');

exports.handler=async(event)=>{
  if(event.httpMethod!=='POST')return{statusCode:405,body:JSON.stringify({error:'Method not allowed'})};
  const {SUPABASE_URL,SUPABASE_SERVICE_KEY}=process.env;
  if(!SUPABASE_URL||!SUPABASE_SERVICE_KEY)return{statusCode:500,body:JSON.stringify({error:'Learner creation is not configured.'})};
  try{
    const bearer=(event.headers.authorization||event.headers.Authorization||'').replace(/^Bearer\s+/i,'');
    if(!bearer)return{statusCode:401,body:JSON.stringify({error:'Please log in again.'})};
    const supabase=createClient(SUPABASE_URL,SUPABASE_SERVICE_KEY,{auth:{autoRefreshToken:false,persistSession:false}});
    const {data:userData,error:userError}=await supabase.auth.getUser(bearer);
    if(userError||!userData?.user)return{statusCode:401,body:JSON.stringify({error:'Your session could not be verified.'})};
    const userId=userData.user.id;
    const {name}=JSON.parse(event.body||'{}');
    const cleanName=String(name||'').trim();
    if(!cleanName)return{statusCode:400,body:JSON.stringify({error:'Learner name is required.'})};

    const {data:account,error:accountError}=await supabase.from('accounts').select('profile_limit,country_code').eq('id',userId).single();
    if(accountError)throw accountError;
    const {count,error:countError}=await supabase.from('profiles').select('id',{count:'exact',head:true}).eq('account_id',userId).eq('status','active');
    if(countError)throw countError;
    const limit=Number(account?.profile_limit||1);
    if((count||0)>=limit)return{statusCode:409,body:JSON.stringify({error:`Your current plan allows ${limit} learner profile${limit===1?'':'s'}.`})};

    const {data:activeSub}=await supabase.from('subscriptions').select('id').eq('account_id',userId).eq('status','active').order('created_at',{ascending:false}).limit(1).maybeSingle();
    const {data:profile,error:profileError}=await supabase.from('profiles').insert({account_id:userId,name:cleanName,country_code:account?.country_code||null,status:'active'}).select('*').single();
    if(profileError)throw profileError;

    const entitlement=activeSub?.id
      ? {profile_id:profile.id,entitlement_type:'premium',source_type:'family_subscription',subscription_id:activeSub.id,weekly_activity_limit:null,status:'active',updated_at:new Date().toISOString()}
      : {profile_id:profile.id,entitlement_type:'free',source_type:'free',subscription_id:null,weekly_activity_limit:5,status:'active',updated_at:new Date().toISOString()};
    const {error:entitlementError}=await supabase.from('learner_entitlements').upsert(entitlement,{onConflict:'profile_id'});
    if(entitlementError)throw entitlementError;

    return{statusCode:200,headers:{'content-type':'application/json'},body:JSON.stringify({profile})};
  }catch(error){
    console.error('Additional learner creation failed',error);
    return{statusCode:500,headers:{'content-type':'application/json'},body:JSON.stringify({error:error.message||'Could not create learner profile.'})};
  }
};