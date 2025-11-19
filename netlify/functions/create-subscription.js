/*
 * NETLIFY FUNCTION: create-subscription.js
 *
 * This function is called by app.html when a user clicks "Upgrade".
 * It securely calls the Paystack API to create a "checkout session" for a subscription.
 */

const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // Paystack API calls

// Helper function to validate the Supabase JWT using the Supabase Admin/Service Key
async function getUserFromSupabaseToken(supabaseAdmin, authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return { userId: null, userEmail: null, error: 'Missing or invalid Authorization header.' };
    }
    const token = authHeader.replace('Bearer ', '');
    
    // We use the admin client's auth.getUser(token) to securely verify the JWT.
    const { data: userResponse, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !userResponse.user) { 
        return { userId: null, userEmail: null, error: `Token validation failed: ${authError?.message || 'User object is empty.'}` };
    }
    
    const user = userResponse.user;
    return { userId: user.id, userEmail: user.email, error: null };
}

exports.handler = async (event, context) => {
    // 1. Netlify Identity check is REMOVED.
    
    // 2. Get all our secret keys from Netlify environment variables
    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,       // Your Admin key
        PAYSTACK_SECRET_KEY,        
        PAYSTACK_PLAN_SINGLE_CODE,
        PAYSTACK_PLAN_FAMILY_CODE,
        PAYSTACK_PLAN_ULTRA_CODE,
        URL                         
    } = process.env;
    
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let userId;
    let userEmail;
    
    // 3. NEW AUTHENTICATION & USER INFO RETRIEVAL
    try {
        const authHeader = event.headers.authorization;
        const authResult = await getUserFromSupabaseToken(supabaseAdmin, authHeader);
        
        if (authResult.error) {
             throw new Error(authResult.error);
        }
        
        userId = authResult.userId;
        userEmail = authResult.userEmail;

    } catch (error) {
        console.error('Supabase JWT Auth Error:', error.message);
        return { 
            statusCode: 401, 
            body: JSON.stringify({ error: 'You must be logged in.' }) 
        };
    }
    
    // 4. Get the plan ID and set the corresponding Paystack Plan Code and profile limit
    let planCode;
    let profileLimit;
    try {
        const { plan } = JSON.parse(event.body); 
        
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
        // 5. Determine callback URL (use environment variable or construct it)
        const callbackUrl = URL ? `${URL}/payment-success.html` : 'https://yoursite.com/payment-success.html';

        // 6. Build the Paystack API Payload
        const paystackPayload = {
            email: userEmail,
            plan: planCode,
            callback_url: callbackUrl,  
            metadata: {
                supabase_user_id: userId,
                profile_limit: profileLimit, 
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
