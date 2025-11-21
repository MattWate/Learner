/*
 * NETLIFY FUNCTION: payment-webhook.js
 * Handles Paystack webhooks to update user accounts.
 */

const { createClient } = require('@supabase/supabase-js');

// Maps Paystack Plan Codes to Learner Genie Tiers
function mapPaystackPlanToTier(planCode, env) {
    // Remove whitespace just in case
    const cleanCode = planCode ? planCode.trim() : '';
    
    if (cleanCode === env.PAYSTACK_PLAN_SINGLE_CODE.trim()) return { tier: 'paid_single', profile_limit: 1 };
    if (cleanCode === env.PAYSTACK_PLAN_FAMILY_CODE.trim()) return { tier: 'paid_family', profile_limit: 2 };
    if (cleanCode === env.PAYSTACK_PLAN_ULTRA_CODE.trim()) return { tier: 'paid_ultra', profile_limit: 4 };
    
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
            throw new Error('Server configuration error.');
        }
        
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });

        // 4. Handle "Charge Success" or "Subscription Create"
        if (eventType === 'charge.success' || eventType === 'subscription.create') {
            
            // Extract Metadata - Paystack can nest this in different places
            const metadata = eventData.metadata || {};
            const userId = metadata.supabase_user_id;
            let profileLimit = metadata.profile_limit;
            
            // Extract Plan Code
            const planCode = eventData.plan?.plan_code || eventData.plan || eventData.plan_code;
            const subscriptionId = eventData.subscription_code || eventData.subscription || eventData.id; // Subscription ID

            console.log(`Processing ${eventType} for User: ${userId}, Plan: ${planCode}`);

            if (!userId) {
                console.error('Missing User ID in webhook metadata.');
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
                // Return 200 to stop retries, but log error
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
                throw error;
            }

            console.log(`SUCCESS: User ${userId} upgraded to ${tierInfo.tier}`);
        }

        // 5. Handle Cancellation
        else if (eventType === 'subscription.disable' || eventType === 'subscription.not_renew') {
             const metadata = eventData.metadata || {};
             const userId = metadata.supabase_user_id;

             if (userId) {
                 console.log(`Downgrading user ${userId} due to cancellation.`);
                 await supabase.from('accounts').update({ 
                    active_tier: 'free',
                    subscription_status: 'cancelled',
                    profile_limit: 1
                }).eq('id', userId);
             }
        }

        return { statusCode: 200, body: 'OK' };

    } catch (error) {
        console.error("Webhook Error:", error.message);
        return { statusCode: 500, body: 'Webhook processing failed.' };
    }
};
