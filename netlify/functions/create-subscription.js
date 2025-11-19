/*
 * NETLIFY FUNCTION: create-subscription.js (WORKING VERSION)
 *
 * This version uses the correct Supabase v2 JWT validation method.
 */

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    
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

        // 2. Check for missing required variables
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !PAYSTACK_SECRET_KEY) {
            console.error('CRITICAL: Missing environment variables');
            throw new Error('Server configuration error.');
        }

        // 3. Check for POST request
        if (event.httpMethod !== 'POST') {
            return { 
                statusCode: 405, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Method Not Allowed' })
            };
        }
        
        // 4. Extract the Authorization header
        const authHeader = event.headers.authorization || event.headers.Authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('Missing or malformed Authorization header');
            return { 
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'You must be logged in.' })
            };
        }
        
        const token = authHeader.replace('Bearer ', '');
        console.log('Received token, length:', token.length);

        // 5. CORRECT METHOD: Create a client with the user's JWT token
        // This is the proper way to validate a user's token in Supabase v2
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        // Verify the JWT token and get the user
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError) {
            console.error('Auth Error:', authError.message);
            return { 
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    error: 'Invalid or expired session. Please log in again.'
                })
            };
        }
        
        if (!user) {
            console.error('No user found in token');
            return { 
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'User not found.' })
            };
        }
        
        const userId = user.id;
        const userEmail = user.email;
        
        console.log('User authenticated successfully:', userId);

        // 6. Parse request body and validate plan
        const { plan } = JSON.parse(event.body); 
        
        let planCode;
        let profileLimit;
        
        switch(plan) {
            case 'paid_single':
                planCode = PAYSTACK_PLAN_SINGLE_CODE; 
                profileLimit = 1;
                break;
            case 'paid_family':
                planCode = PAYSTACK_PLAN_FAMILY_CODE;
                profileLimit = 2;
                break;
            case 'paid_ultra':
                planCode = PAYSTACK_PLAN_ULTRA_CODE;
                profileLimit = 4;
                break;
            default:
                throw new Error('Invalid plan specified.');
        }

       if (!planCode) {
            // CRITICAL FIX: Improved logging and error message for a missing environment variable
            console.error(`Plan code not configured for: ${plan}. Check Netlify environment variables.`);
            throw new Error(`CRITICAL: Plan configuration error for plan '${plan}'. Please check your Netlify environment variables (PAYSTACK_PLAN_SINGLE_CODE, etc.).`);
        }

        // 7. Initialize Paystack transaction
        const callbackUrl = URL 
            ? `${URL}/payment-success.html` 
            : 'https://learnergenie.dubyahinnovation.com/payment-success.html';

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

        console.log('Initializing Paystack transaction...');

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
            console.error('Paystack Error:', JSON.stringify(data, null, 2));
            throw new Error(data.message || 'Paystack initialization failed.');
        }

        console.log('Paystack checkout URL generated');

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutUrl: data.data.authorization_url }),
        };

    } catch (error) {
        console.error("Subscription Error:", error.message);
        console.error("Stack:", error.stack);

        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                error: error.message || 'An unexpected error occurred.'
            }) 
        };
    }
};
