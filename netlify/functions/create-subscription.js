/*
 * NETLIFY FUNCTION: create-subscription.js (SIMPLIFIED VERSION)
 * * 1. Receives userId, email, and plan from the frontend.
 * 2. Initializes a Paystack transaction.
 * 3. Returns the checkout URL to the frontend.
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
            PAYSTACK_SECRET_KEY,        
            PAYSTACK_PLAN_SINGLE_CODE,
            PAYSTACK_PLAN_FAMILY_CODE,
            PAYSTACK_PLAN_ULTRA_CODE,
            URL                         
        } = process.env;

        if (!PAYSTACK_SECRET_KEY) {
            console.error('CRITICAL: PAYSTACK_SECRET_KEY is missing.');
            throw new Error('Server configuration error.');
        }

        // 3. Parse the request body (Expecting userId, email, plan)
        const { userId, email, plan } = JSON.parse(event.body);

        if (!userId || !email || !plan) {
            return {
                statusCode: 400,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ error: 'Missing required fields: userId, email, or plan.' })
            };
        }

        // 4. Map the plan name to the Paystack Plan Code
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
                throw new Error(`Invalid plan selected: ${plan}`);
        }

        if (!planCode) {
            throw new Error(`Configuration Missing: No Paystack code found for plan '${plan}'`);
        }

        // 5. Initialize Paystack Transaction
        // We pass the userId in "metadata" so the Webhook knows who to upgrade later.
        
        const callbackUrl = URL 
            ? `${URL}/app.html` // Redirect back to the app after payment
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

        console.log(`Initializing Paystack for User: ${userId}, Plan: ${plan}`);

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
            console.error('Paystack Initialization Failed:', data);
            throw new Error(data.message || 'Paystack initialization failed.');
        }

        // 6. Return the Authorization URL to the frontend
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
