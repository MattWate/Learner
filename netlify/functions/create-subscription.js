/*
 * NETLIFY FUNCTION: create-subscription.js
 * Uses official 'paystack-api' SDK to initialize transactions.
 */

const Paystack = require('paystack-api');

exports.handler = async (event) => {
    
    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const {
            PAYSTACK_SECRET_KEY,        
            PAYSTACK_PLAN_SINGLE_CODE,
            PAYSTACK_PLAN_FAMILY_CODE,
            PAYSTACK_PLAN_ULTRA_CODE,
            URL                         
        } = process.env;

        if (!PAYSTACK_SECRET_KEY) {
            throw new Error('Server configuration error: Missing Secret Key.');
        }

        // Initialize SDK with the Secret Key
        const paystack = Paystack(PAYSTACK_SECRET_KEY);

        const { userId, email, plan } = JSON.parse(event.body);

        if (!userId || !email || !plan) {
            return {
                statusCode: 400,
                body: JSON.stringify({ error: 'Missing required fields.' })
            };
        }

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
            throw new Error(`Plan code missing for '${plan}'`);
        }

        const planCode = rawPlanCode.trim();
        const callbackUrl = URL ? `${URL}/app.html` : 'https://learnergenie.dubyahinnovation.com/app.html';

        console.log(`[SDK Init] User: ${userId}, Plan: ${plan}, Code: "${planCode}"`);

        // SDK Method: transaction.initialize
        const result = await paystack.transaction.initialize({
            email: email,
            plan: planCode,
            callback_url: callbackUrl,
            metadata: {
                supabase_user_id: userId,
                profile_limit: profileLimit
            }
        });

        // The SDK returns the data object directly on success
        if (!result || !result.status) {
             console.error('[SDK Error]:', result);
             throw new Error(result.message || 'Paystack initialization failed.');
        }

        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutUrl: result.data.authorization_url }),
        };

    } catch (error) {
        console.error("SDK Error:", error.message || error);
        // SDK errors sometimes come as objects with a 'message' property
        const errorMsg = error.message || (error.error && error.error.message) || 'Unknown SDK Error';
        
        return { 
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ error: errorMsg }) 
        };
    }
};
