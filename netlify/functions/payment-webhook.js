/*
 * NETLIFY FUNCTION: payment-webhook.js
 * Handles Paystack webhooks to update user accounts.
 */

const { createClient } = require('@supabase/supabase-js');

// Maps Paystack Plan Codes to Learner Genie Tiers
function mapPaystackPlanToTier(planCode, env) {
    // Remove whitespace just in case
    const cleanCode = planCode ? planCode.trim() : '';
    
    // Check against environment variables (handling potential undefined values)
    if (env.PAYSTACK_PLAN_SINGLE_CODE && cleanCode === env.PAYSTACK_PLAN_SINGLE_CODE.trim()) return { tier: 'paid_single', profile_limit: 1 };
    if (env.PAYSTACK_PLAN_FAMILY_CODE && cleanCode === env.PAYSTACK_PLAN_FAMILY_CODE.trim()) return { tier: 'paid_family', profile_limit: 2 };
    if (env.PAYSTACK_PLAN_ULTRA_CODE && cleanCode === env.PAYSTACK_PLAN_ULTRA_CODE.trim()) return { tier: 'paid_ultra', profile_limit: 4 };
    
    return null;
}

exports.handler = async (event) => {
    // 1. Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        PAYSTACK_PLAN_SINGLE_CODE,
        PAYSTACK_PLAN_FAMILY_CODE,
        PAYSTACK_PLAN_ULTRA_CODE
    } = process.env;

    try {
        // 2. Parse Payload
        const payload = JSON.parse(event.body);
        const eventType = payload.event;
        const eventData = payload.data;

        console.log(`Webhook received: ${eventType}`);

        // 3. Initialize Supabase Admin Client
        // IMPORTANT: Must use SERVICE_KEY to bypass RLS and update user accounts
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            console.error('CRITICAL: Missing Supabase credentials in webhook.');
            throw new Error('Server configuration error: Missing Database Credentials.');
        }
        
        // FIXED: Add options to prevent local storage errors in serverless functions
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 4. Handle "Charge Success" or "Subscription Create"
        if (eventType === 'charge.success' || eventType === 'subscription.create') {
            
            // Extract Metadata - Paystack can nest this in different places
            // We check eventData.metadata directly, and also custom_fields if needed
            let metadata = eventData.metadata || {};
            
            // Sometimes metadata comes as a custom_fields array in older integrations
            if (!metadata.supabase_user_id && eventData.custom_fields) {
                 const field = eventData.custom_fields.find(f => f.variable_name === 'supabase_user_id');
                 if (field) metadata.supabase_user_id = field.value;
            }

            const userId = metadata.supabase_user_id;
            let profileLimit = metadata.profile_limit;
            
            // Extract Plan Code
            const planCode = eventData.plan?.plan_code || eventData.plan || eventData.plan_code;
            const subscriptionId = eventData.subscription_code || eventData.subscription || eventData.id; // Subscription ID

            console.log(`Processing ${eventType} for User: ${userId}, Plan: ${planCode}`);

            if (!userId) {
                console.error(`Missing User ID in webhook metadata for event ${eventType}. Payload snippet:`, JSON.stringify(metadata));
                // We return 200 to stop Paystack from retrying this "bad" event forever
                return { statusCode: 200, body: 'Ignored: No User ID' };
            }

            // Determine Tier
            let tierInfo = mapPaystackPlanToTier(planCode, process.env);
            
            // Fallback: If plan mapping fails, try to use the profile_limit from metadata
            if (!tierInfo && profileLimit) {
                 console.warn(`Plan code ${planCode} not found in map. Using metadata fallback.`);
                 if (profileLimit == 1) tierInfo = { tier: 'paid_single', profile_limit: 1 };
                 else if (profileLimit == 2) tierInfo = { tier: 'paid_family', profile_limit: 2 };
                 else if (profileLimit == 4) tierInfo = { tier: 'paid_ultra', profile_limit: 4 };
            }

            if (!tierInfo) {
                console.error(`Unknown Plan Code: ${planCode} and no valid metadata fallback.`);
                return { statusCode: 200, body: 'Ignored: Unknown Plan' };
            }

            // 5. Update Database
            const { error } = await supabase
                .from('accounts')
                .update({ 
                    active_tier: tierInfo.tier,
                    subscription_id: subscriptionId,
                    subscription_status: 'active',
                    profile_limit: tierInfo.profile_limit
                })
                .eq('id', userId);

            if (error) {
                console.error(`Supabase Update Error: ${error.message}`);
                throw error; // Rethrow to trigger 500 and retry
            }

            console.log(`SUCCESS: User ${userId} upgraded to ${tierInfo.tier}`);
        }

        // 5. Handle Cancellation
        else if (eventType === 'subscription.disable' || eventType === 'subscription.not_renew') {
             const metadata = eventData.metadata || {};
             const userId = metadata.supabase_user_id;

             if (userId) {
                 console.log(`Downgrading user ${userId} due to cancellation.`);
                 const { error } = await supabase.from('accounts').update({ 
                    active_tier: 'free',
                    subscription_status: 'cancelled',
                    profile_limit: 1
                }).eq('id', userId);
                
                if (error) console.error("Supabase Downgrade Error:", error.message);
             } else {
                 console.warn("Cancellation event received without User ID.");
             }
        }

        return { statusCode: 200, body: 'OK' };

    } catch (error) {
        console.error("Webhook Error:", error.message);
        return { statusCode: 500, body: 'Webhook processing failed.' };
    }
};
