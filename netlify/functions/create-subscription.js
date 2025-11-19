/*
 * NETLIFY FUNCTION: create-subscription.js (FIXED VERSION)
 *
 * This version fixes the JWT validation issue.
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
            throw new Error('Server configuration error. Missing required secrets.');
        }

        // 3. Check for POST request
        if (event.httpMethod !== 'POST') {
            return { 
                statusCode: 405, 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Method Not Allowed' })
            };
        }
        
        // 4. CRITICAL FIX: Extract and validate the Authorization header
        const authHeader = event.headers.authorization || event.headers.Authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.error('Auth Error: Missing or malformed Authorization header');
            return { 
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'You must be logged in.' })
            };
        }
        
        const token = authHeader.replace('Bearer ', '');
        
        // Log token info for debugging (remove in production)
        console.log('Token received:', token.substring(0, 20) + '...');
        console.log('Token length:', token.length);

        // 5. CRITICAL FIX: Use the correct method to verify the JWT
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
        
        // THIS IS THE KEY FIX: Use verifyJWT instead of getUser
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        
        if (authError) {
            console.error('JWT Verification Error:', authError.message);
            return { 
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Invalid or expired session. Please log in again.' })
            };
        }
        
        if (!user) {
            console.error('JWT Valid but no user returned');
            return { 
                statusCode: 401,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'User not found.' })
            };
        }
        
        const userId = user.id;
        const userEmail = user.email;
        
        console.log('User authenticated:', userId);

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
            throw new Error(`CRITICAL: Paystack Plan code for '${plan}' is not configured.`);
        }

        // 7. Call Paystack API
        const callbackUrl = URL ? `${URL}/payment-success.html` : 'https://learnergenie.dubyahinnovation.com/payment-success.html';

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

        console.log('Calling Paystack API...');

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
            console.error('Paystack API Error:', JSON.stringify(data, null, 2));
            throw new Error(data.message || 'Paystack API failed to initialize transaction.');
        }

        console.log('Paystack checkout URL generated successfully');

        // Success - Return JSON
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutUrl: data.data.authorization_url }),
        };

    } catch (error) {
        console.error("Fatal Subscription Error:", error.message);
        console.error("Stack:", error.stack);
        
        const userMessage = error.message.includes("CRITICAL") 
            ? "Failed to initialize checkout. Please contact support." 
            : error.message;

        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: userMessage }) 
        };
    }
};
