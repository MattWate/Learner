/*
 * NETLIFY FUNCTION: cancel-subscription.js
 * Uses 'paystack-api' SDK for consistency.
 */

const { createClient } = require('@supabase/supabase-js');
const Paystack = require('paystack-api');

exports.handler = async (event) => {
    
    // 1. Check for POST request
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        PAYSTACK_SECRET_KEY
    } = process.env;

    if (!PAYSTACK_SECRET_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: 'Server configuration error.' }) 
        };
    }

    try {
        // 2. Initialize SDKs
        const paystack = Paystack(PAYSTACK_SECRET_KEY);
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // 3. Get User ID from request body
        const { userId } = JSON.parse(event.body);

        if (!userId) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'User ID is required.' }) 
            };
        }

        // 4. Fetch the user's subscription ID from Supabase
        const { data: account, error: fetchError } = await supabaseAdmin
            .from('accounts')
            .select('subscription_id')
            .eq('id', userId)
            .single();

        if (fetchError || !account || !account.subscription_id) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: 'No active subscription found to cancel.' }) 
            };
        }
        
        const subscriptionId = account.subscription_id;
        console.log(`Cancelling subscription: ${subscriptionId} for user: ${userId}`);

        // 5. Disable Subscription via Paystack SDK
        // Note: Paystack requires a 'token' for disable. In server-side calls, 
        // passing the Secret Key or the subscription code often acts as the authority.
        const result = await paystack.subscription.disable({
            code: subscriptionId, 
            token: PAYSTACK_SECRET_KEY // Using secret key as authority token
        });

        if (!result || !result.status) {
             console.error('[SDK Cancel Error]:', result);
             throw new Error(result.message || 'Failed to cancel subscription.');
        }

        // 6. Downgrade User in Supabase
        const { error: updateError } = await supabaseAdmin
            .from('accounts')
            .update({ 
                active_tier: 'free',
                subscription_id: null,
                subscription_status: 'cancelled',
                profile_limit: 1
            })
            .eq('id', userId);
            
        if (updateError) {
            console.error(`Supabase downgrade error: ${updateError.message}`);
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: 'Subscription cancelled successfully.' }),
        };

    } catch (error) {
        console.error("Cancel Error:", error.message);
        return { 
            statusCode: 500, 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
