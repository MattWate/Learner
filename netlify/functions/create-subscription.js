/*
 * NETLIFY FUNCTION: create-subscription.js
 *
 * This version is stable, secure, and includes detailed logging for debugging.
 */

const { createClient } = require('@supabase/supabase-js');
// The explicit require('node-fetch') is REMOVED to stabilize the function runtime.

// Helper function to validate the Supabase JWT
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
    
    // DEFENSIVE OUTER TRY-CATCH: This ensures a proper 500 error is returned instead of a 502 crash.
    try {
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

        // 2. CRITICAL DEBUGGING: Check for missing required variables synchronously.
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !PAYSTACK_SECRET_KEY) {
             throw new Error('CRITICAL: One or more required secrets (Supabase/Paystack Keys) are missing from Netlify environment.');
        }

        // 3. Initialize Supabase Admin Client
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        let userId;
        let userEmail;

        // 4. Check for POST request
        if (event.httpMethod !== 'POST') {
            return { statusCode: 405, body: 'Method Not Allowed' };
        }
        
        // 5. AUTHENTICATION: Validate Supabase JWT
        const authHeader = event.headers.authorization;
        const authResult = await getUserFromSupabaseToken(supabaseAdmin, authHeader);
        
        if (authResult.error) {
            console.error('Supabase JWT Auth Error:', authResult.error);
            return { 
                statusCode: 401, 
                body: JSON.stringify({ error: 'You must be logged in.' }) 
            };
        }
        
        // Use the validated user ID and email
        userId = authResult.userId;
        userEmail = authResult.userEmail;

        // 6. Get the plan details from the request body
        const { plan } = JSON.parse(event.body); 
        
        let planCode;
        let profileLimit;
        
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
            // This catches unset plan codes from env vars
            throw new Error(`CRITICAL: Paystack Plan code for '${plan}' is not configured.`);
        }

        // 7. Call Paystack API
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
        
        // FINAL DEBUGGING STEP: Check for Paystack errors
        if (!response.ok || !data.status) {
            // This will log the specific Paystack error
            console.error('Paystack API Error:', JSON.stringify(data, null, 2));
            throw new Error(data.message || 'Paystack API failed to initialize transaction. Check Netlify logs for details.');
        }

        // Success
        return {
            statusCode: 200,
            body: JSON.stringify({ checkoutUrl: data.data.authorization_url }),
        };

    } catch (error) {
        // Catch any error from setup, auth, or Paystack call.
        console.error("Fatal Subscription Initialization Error:", error);
        
        // This is the error message that will be shown to the user in the alert box
        const userMessage = error.message.includes("CRITICAL") 
            ? "Failed to initialize Paystack checkout. Please check server configuration." 
            : error.message;

        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: userMessage }) 
        };
    }
};
