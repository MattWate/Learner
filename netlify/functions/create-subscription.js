/*
 * NETLIFY FUNCTION: create-subscription.js
 *
 * This function is called by app.html when a user clicks "Upgrade".
 * It securely calls the Paystack API to create a "checkout session" for a subscription.
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // Paystack API calls

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
        SUPABASE_SERVICE_KEY,       // Your Admin key
        PAYSTACK_SECRET_KEY,        // Your Paystack *Secret* Key (starts with 'sk_')
        PAYSTACK_PLAN_SINGLE_CODE,  // PLN_XXXXXX for R69
        PAYSTACK_PLAN_FAMILY_CODE,  // PLN_YYYYYY for R99
        PAYSTACK_PLAN_ULTRA_CODE,   // PLN_ZZZZZZ for R149
        URL                         // Netlify provides this automatically
    } = process.env;

    // 3. Get the plan ID and set the corresponding Paystack Plan Code and profile limit
    let planCode;
    let profileLimit;
    try {
        const { plan } = JSON.parse(event.body); // e.g., 'paid_single', 'paid_family', or 'paid_ultra'
        
        if (plan === 'paid_single') {
            planCode = PAYSTACK_PLAN_SINGLE_CODE; 
            profileLimit = 1;
        } else if (plan === 'paid_family') {
            planCode = PAYSTACK_PLAN_FAMILY_CODE;
            profileLimit = 2;
        } else if (plan === 'paid_ultra') {
            planCode = PAYSTACK_PLAN_ULTRA_CODE;
            profileLimit = 4;
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

        // 5. Determine callback URL (use environment variable or construct it)
        const callbackUrl = URL ? `${URL}/payment-success.html` : 'https://yoursite.com/payment-success.html';

        // 6. Build the Paystack API Payload
        // We pass the profileLimit and user ID in the metadata for the webhook
        const paystackPayload = {
            email: userEmail,
            plan: planCode,
            callback_url: callbackUrl,  // ADDED: Where to redirect after payment
            metadata: {
                supabase_user_id: userId,
                profile_limit: profileLimit, // CRITICAL: Used by the webhook
                custom_fields: [{
                    display_name: "Subscription Plan",
                    variable_name: "subscription_plan",
                    value: planCode
                }]
            }
        };

        // 7. Call the Paystack "Initialize Transaction" Endpoint
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

        // 8. Send the secure checkout URL back to the frontend
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
