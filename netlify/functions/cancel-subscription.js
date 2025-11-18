/*
 * NETLIFY FUNCTION: cancel-subscription.js
 *
 * This function is called by the frontend to securely cancel a user's Paystack subscription.
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // Paystack API calls

exports.handler = async (event, context) => {
    // 1. Check for user authentication
    if (!context.clientContext || !context.clientContext.user) {
        return { 
            statusCode: 401, 
            body: JSON.stringify({ error: 'You must be logged in.' }) 
        };
    }
    const userId = context.clientContext.user.sub;

    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        PAYSTACK_SECRET_KEY
    } = process.env;

    try {
        // 2. Fetch the user's current subscription ID from the database
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
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

        // 3. Call the Paystack API to disable the subscription immediately (using code/token)
        // Paystack uses a "disable" endpoint for cancellation
        const response = await fetch(`https://api.paystack.co/subscription/disable`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: subscriptionId, // Paystack calls the subscription ID a 'code' here
                token: PAYSTACK_SECRET_KEY // Using the secret key as the token for immediate disable
            })
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            console.error('Paystack API Error on Cancel:', data);
            throw new Error(data.message || 'Paystack API failed to cancel subscription');
        }

        // 4. Update the user's Supabase account status (Downgrade to free)
        // This is a safety measure; the webhook should also handle this via 'subscription.disable'
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
            console.error(`Supabase downgrade error on cancel: ${updateError.message}`);
            // We still return 200 to the client since Paystack succeeded.
        }

        // 5. Success
        return {
            statusCode: 200,
            body: JSON.stringify({ message: 'Subscription successfully cancelled. You have been downgraded to the free tier.' }),
        };

    } catch (error) {
        console.error("Cancel Subscription Error:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
