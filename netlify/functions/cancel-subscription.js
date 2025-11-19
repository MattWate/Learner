// Drop-in Replacement for netlify/functions/cancel-subscription.js
const { createClient } = require('@supabase/supabase-js');
// const fetch = require('node-fetch'); // REMOVED: Using global fetch

exports.handler = async (event, context) => {
    
    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        PAYSTACK_SECRET_KEY
    } = process.env;

    let userId;
    
    try {
        // 1. Initialize Supabase Admin Client
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        // 2. Validate Supabase JWT from the Authorization header
        const authHeader = event.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return { statusCode: 401, body: JSON.stringify({ error: 'You must be logged in.' }) };
        }
        const token = authHeader.replace('Bearer ', '');
        
        const { data: userResponse, error: authError } = await supabaseAdmin.auth.getUser(token);
        
        if (authError || !userResponse.user) { 
            throw new Error(`Token validation failed: ${authError?.message || 'User object is empty.'}`);
        }
        
        userId = userResponse.user.id;

    } catch (error) {
        console.error('Supabase JWT Auth Error:', error.message);
        return { 
            statusCode: 401, 
            body: JSON.stringify({ error: 'You must be logged in.' }) 
        };
    }

    try {
        // 3. Fetch the user's current subscription ID from the database
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

        // 4. Call the Paystack API to disable the subscription immediately
        const response = await fetch(`https://api.paystack.co/subscription/disable`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                code: subscriptionId, 
                token: PAYSTACK_SECRET_KEY 
            })
        });

        const data = await response.json();

        if (!response.ok || !data.status) {
            console.error('Paystack API Error on Cancel:', data);
            throw new Error(data.message || 'Paystack API failed to cancel subscription');
        }

        // 5. Update the user's Supabase account status
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
        }

        // 6. Success
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
