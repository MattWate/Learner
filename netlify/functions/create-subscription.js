/*
 * NETLIFY FUNCTION: create-subscription.js
 *
 * This function securely validates the user's Supabase JWT, retrieves their email,
 * and calls the Paystack API to create a checkout session.
 */

const { createClient } = require('@supabase/supabase-js');
// const fetch = require('node-fetch'); <--- REMOVED: Relying on Netlify's global fetch

// Helper function to validate the Supabase JWT outside the handler for clarity
async function getUserFromSupabaseToken(supabaseAdmin, authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return { userId: null, userEmail: null, error: 'Missing or invalid Authorization header.' };
    }
    const token = authHeader.replace('Bearer ', '');
    
    // Use the admin client to verify the JWT
    const { data: userResponse, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !userResponse.user) { 
        return { userId: null, userEmail: null, error: `Token validation failed: ${authError?.message || 'User object is empty.'}` };
    }
    
    const user = userResponse.user;
    return { userId: user.id, userEmail: user.email, error: null };
}

exports.handler = async (event, context) => {
    // 1. Get environment variables
    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,       
        PAYSTACK_SECRET_KEY,        
        PAYSTACK_PLAN_SINGLE_CODE,
        PAYSTACK_PLAN_FAMILY_CODE,
        PAYSTACK_PLAN_ULTRA_CODE,
        URL                         
    } = process.env;
    
    // 2. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    let userId;
    let userEmail;

    // 3. Check for POST request
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    
    // 4. AUTHENTICATION: Validate Supabase JWT from the Authorization header
    try {
        const authHeader = event.headers.authorization;
        const authResult = await getUserFromSupabaseToken(supabaseAdmin, authHeader);
        
        if (authResult.error) {
             throw new Error(authResult.error);
        }
        
        userId = authResult.userId;
        userEmail = authResult.userEmail;

    } catch (error) {
        // Send 401 if authentication fails
        console.error('Supabase JWT Auth Error:', error.message);
        return { 
            statusCode: 401, 
            body: JSON.stringify({ error: 'You must be logged in.' }) 
        };
    }
    
    // 5. Get the plan details from the request body
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

    // 6. Call Paystack API
    try {
        const callbackUrl = URL ? `${URL}/payment-success.html` : 'https://yoursite.com/payment-success.html';

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

        // Using the global 'fetch' provided by the Netlify runtime
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
        
        // CRITICAL DEBUGGING: Check for Paystack errors
        if (!response.ok || !data.status) {
            // This will log the specific Paystack error (e.g., "Invalid Secret Key")
            console.error('Paystack API Error:', JSON.stringify(data, null, 2));
            throw new Error(data.message || 'Paystack API returned an error');
        }

        // Success
        return {
            statusCode: 200,
            body: JSON.stringify({ checkoutUrl: data.data.authorization_url }),
        };

    } catch (error) {
        // Catch any remaining errors and return a 500
        console.error("Create Subscription Error:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
