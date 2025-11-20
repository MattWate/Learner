/*
 * NETLIFY FUNCTION: create-subscription.js (DEBUG & ROBUST VERSION)
 * 1. Receives userId, email, and plan from the frontend.
 * 2. Trims whitespace from plan codes to prevent copy-paste errors.
 * 3. Logs the plan code being used (for debugging).
 * 4. Initializes Paystack transaction.
 */

exports.handler = async (event) => {
    
    // 1. Check for POST request
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        // 2. Get environment variables
        const {
        //    PAYSTACK_SECRET_KEY,        
            PAYSTACK_PLAN_SINGLE_CODE,
            PAYSTACK_PLAN_FAMILY_CODE,
            PAYSTACK_PLAN_ULTRA_CODE,
            URL                         
        } = process.env;

        const PAYSTACK_SECRET_KEY = "sk_live_65afcf927749f5bd957f01c6a4fe828d8f78e854"

        if (!PAYSTACK_SECRET_KEY) {
            console.error('CRITICAL: PAYSTACK_SECRET_KEY is missing.');
            throw new Error('Server configuration error.');
        }

        // 3. Parse the request body
        const { userId, email, plan } = JSON.parse(event.body);

        if (!userId || !email || !plan) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing required fields: userId, email, or plan.' })
            };
        }

        // 4. Map the plan name to the Paystack Plan Code
        let rawPlanCode;
        let profileLimit;
        
        switch(plan) {
            case 'paid_single':
                rawPlanCode = PAYSTACK_PLAN_SINGLE_CODE; 
                profileLimit = 1;
                break;
            case 'paid_family':
                rawPlanCode = PAYSTACK_PLAN_FAMILY_CODE;
                profileLimit = 2;
                break;
            case 'paid_ultra':
                rawPlanCode = PAYSTACK_PLAN_ULTRA_CODE;
                profileLimit = 4;
                break;
            default:
                throw new Error(`Invalid plan selected: ${plan}`);
        }

        if (!rawPlanCode) {
            throw new Error(`Configuration Missing: No Paystack code found for plan '${plan}' in environment variables.`);
        }

        // 5. CRITICAL FIX: Trim whitespace from the plan code
        const planCode = rawPlanCode.trim();

        // 6. Initialize Paystack Transaction
        const callbackUrl = URL 
            ? `${URL}/app.html` 
            : 'https://learnergenie.dubyahinnovation.com/app.html';

        const paystackPayload = {
            email: email,
            plan: planCode,
            callback_url: callbackUrl,
            metadata: {
                supabase_user_id: userId,
                profile_limit: profileLimit
            }
        };

        // LOGGING: Check your Netlify Function logs to see this output
        console.log(`[Init Subscription] User: ${userId}`);
        console.log(`[Init Subscription] Plan requested: ${plan}`);
        console.log(`[Init Subscription] Plan Code sent to Paystack: "${planCode}"`); // Quotes added to see if there are issues

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
            console.error('[Paystack Error Response]:', JSON.stringify(data, null, 2));
            
            // Provide a more helpful error if it's the specific "Invalid Amount" issue
            if (data.message === 'Invalid Amount Sent') {
                 throw new Error(`Paystack rejected the Plan Code ("${planCode}"). Please verify it exists in your Paystack Dashboard (Live/Test mode mismatch?).`);
            }
            
            throw new Error(data.message || 'Paystack initialization failed.');
        }

        // 7. Return the Authorization URL to the frontend
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutUrl: data.data.authorization_url }),
        };

    } catch (error) {
        console.error("Create Subscription Error:", error.message);
        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: error.message || 'Internal Server Error' }) 
        };
    }
};
