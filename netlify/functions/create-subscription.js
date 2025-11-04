/*
 * NETLIFY FUNCTION: create-subscription.js
 *
 * This function is called by app.html when a user clicks "Subscribe".
 * It securely calls the Paystack API to create a "checkout session."
 */

const { createClient } = require('@supabase/supabase-js');

// Helper function to fetch the user's email securely
async function getUserEmail(supabaseAdmin, userId) {
    const { data: user, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error) throw new Error(`Supabase user error: ${error.message}`);
    if (!user) throw new Error('Supabase user not found.');
    return user.user.email;
}

exports.handler = async (event, context) => {
    // 1. Check for user authentication
    if (!context.clientContext || !context.clientContext.user) {
        return { 
            statusCode: 401, 
            body: JSON.stringify({ error: 'You must be logged in.' }) 
        };
    }
    const userId = context.clientContext.user.sub;

    // 2. Get all our secret keys from Netlify environment variables
    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY, // Your Admin key
        PAYSTACK_SECRET_KEY   // Your Paystack *Secret* Key (starts with 'sk_')
    } = process.env;

    // 3. Get the plan ID from the request body
    let planCode; // This MUST match the "Plan Code" you create in your Paystack dashboard
    try {
        const { plan } = JSON.parse(event.body); // e.g., 'paid_single' or 'paid_family'
        
        if (plan === 'paid_single') {
            // e.g., 'PLAN_SINGLE_69' or whatever you call it in Paystack
            planCode = process.env.PAYSTACK_PLAN_SINGLE_CODE; 
        } else if (plan === 'paid_family') {
            // e.g., 'PLAN_FAMILY_99'
            planCode = process.env.PAYSTACK_PLAN_FAMILY_CODE;
        } else {
            throw new Error('Invalid plan specified.');
        }

        if (!planCode) {
            throw new Error(`Plan code for ${plan} is not set in environment variables.`);
        }

    } catch (error) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: error.message }) 
        };
    }

    try {
        // 4. Get the user's email from Supabase
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const userEmail = await getUserEmail(supabaseAdmin, userId);

        // 5. Build the Paystack API Payload
        // We are creating a "checkout session"
        const paystackPayload = {
            email: userEmail,
            plan: planCode,
            // We pass our user ID in the metadata so we know who
            // to upgrade when the webhook comes in.
            metadata: {
                supabase_user_id: userId
            }
        };

        // 6. Call the Paystack "Initialize Transaction" Endpoint
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify(paystackPayload)
        });
        
        const data = await response.json();

        if (!response.ok || !data.status) {
            console.error('Paystack API Error:', data);
            throw new Error(data.message || 'Paystack API returned an error');
        }

        // 7. Send the secure checkout URL back to the frontend
        return {
            statusCode: 200,
            body: JSON.stringify({ checkoutUrl: data.data.authorization_url }),
        };

    } catch (error) {
        console.error("Create Subscription Error:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
