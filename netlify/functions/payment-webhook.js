/*
 * NETLIFY FUNCTION: payment-webhook.js
 *
 * This is the critical security function for Paystack.
 * 1. It securely validates the payload using Paystack's signature header.
 * 2. If valid, it updates the user's account in Supabase using an admin key.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const getRawBody = require('raw-body'); // Used to get the raw request body for hashing

// Maps Paystack Plan Codes to Learner Genie Tiers
function mapPaystackPlanToTier(planCode, env) {
    switch (planCode) {
        case env.PAYSTACK_PLAN_SINGLE_CODE: return { tier: 'paid_single', profile_limit: 1 };
        case env.PAYSTACK_PLAN_FAMILY_CODE: return { tier: 'paid_family', profile_limit: 2 };
        case env.PAYSTACK_PLAN_ULTRA_CODE: return { tier: 'paid_ultra', profile_limit: 4 };
        default: return null;
    }
}

exports.handler = async (event, context) => {
    // 1. Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        PAYSTACK_SECRET_KEY,
        PAYSTACK_PLAN_SINGLE_CODE,
        PAYSTACK_PLAN_FAMILY_CODE,
        PAYSTACK_PLAN_ULTRA_CODE
    } = process.env;

    const signature = event.headers['x-paystack-signature'];
    
    // 2. CRITICAL: VALIDATE THE HASH
    // We need the raw body for signature verification, not the parsed JSON.
    const rawBody = event.body; // Netlify handles raw body on its own.

    // Calculate our own hash
    const hash = crypto
        .createHmac('sha512', PAYSTACK_SECRET_KEY)
        .update(rawBody)
        .digest('hex');

    if (hash !== signature) {
        console.warn('Paystack Signature Mismatch! Possible fraud attempt.');
        // Return 200 OK to stop Paystack from retrying, but don't process.
        return { statusCode: 200, body: 'OK' };
    }

    // --- HASH VALIDATED ---
    console.log('Paystack Webhook validated.');
    let payload;
    try {
        payload = JSON.parse(rawBody);
    } catch (e) {
        console.error('Failed to parse Paystack payload:', rawBody);
        return { statusCode: 400, body: 'Invalid JSON payload' };
    }

    const eventType = payload.event;
    const eventData = payload.data;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 3. Handle Paystack Events
    
    // A. Successful Subscription Payment (or first charge)
    if (eventType === 'charge.success' || eventType === 'subscription.create') {
        const userId = eventData.metadata?.supabase_user_id;
        const profileLimit = eventData.metadata?.profile_limit; // From create-subscription.js metadata
        const planCode = eventData.plan?.plan_code || eventData.plan;
        const subscriptionId = eventData.subscription_code || eventData.subscription;
        
        if (!userId || !profileLimit || !planCode) {
            console.error('Missing critical data in payload:', { userId, profileLimit, planCode });
            return { statusCode: 400, body: 'Missing required metadata.' };
        }
        
        const tierInfo = mapPaystackPlanToTier(planCode, process.env);
        if (!tierInfo) {
            console.error('Unknown plan code:', planCode);
            return { statusCode: 400, body: 'Unknown plan code.' };
        }

        const { error } = await supabase
            .from('accounts')
            .update({ 
                active_tier: tierInfo.tier,
                subscription_id: subscriptionId, // Store the Paystack subscription code
                subscription_status: 'active',
                profile_limit: profileLimit // Update the profile limit
            })
            .eq('id', userId);

        if (error) {
            console.error(`Supabase update error for user ${userId}: ${error.message}`);
            return { statusCode: 500, body: 'Database update failed.' };
        }
        console.log(`User ${userId} successfully upgraded to ${tierInfo.tier} with limit ${profileLimit}`);
    }

    // B. Subscription Cancellation (User or System)
    else if (eventType === 'subscription.disable' || eventType === 'subscription.expire') {
        const userId = eventData.metadata?.supabase_user_id || eventData.customer.customer_code;
        
        if (!userId) {
            console.error('Missing user ID for cancellation event:', eventData);
            return { statusCode: 400, body: 'Missing user ID.' };
        }

        // Downgrade user to free tier
        const { error } = await supabase
            .from('accounts')
            .update({ 
                active_tier: 'free',
                subscription_id: null,
                subscription_status: 'cancelled',
                profile_limit: 1 // Downgrade profile limit to 1
            })
            .eq('id', userId);
            
        if (error) {
            console.error(`Supabase cancellation error for user ${userId}: ${error.message}`);
            return { statusCode: 500, body: 'Database cancellation update failed.' };
        }
        console.log(`User ${userId} successfully downgraded to free tier.`);
    }

    // 4. Return 200 OK to Paystack
    // This tells Paystack "We got it, stop sending."
    return { statusCode: 200, body: 'OK' };
};
