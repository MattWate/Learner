/*
 * NETLIFY FUNCTION: create-subscription.js
 *
 * This function securely calls the Ozow "One API" to create
 * a new subscription and get a payment redirect URL.
 */

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    // 1. Check for user authentication
    if (!context.clientContext || !context.clientContext.user) {
        return { 
            statusCode: 401, 
            body: JSON.stringify({ error: 'You must be logged in to create a subscription.' }) 
        };
    }
    const userId = context.clientContext.user.sub;

    // 2. Get all our secret keys from Netlify environment variables
    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY, // Your Admin key
        OZOW_API_KEY,         // Your "Client Id"
        SITE_URL              // Your site's main URL
    } = process.env;

    // 3. Get the plan ID from the request body
    let planId; // This must match the "Plan ID" you create in your Ozow dashboard
    try {
        const { plan } = JSON.parse(event.body); // e.g., 'paid_single' or 'paid_family'
        if (plan === 'paid_single') {
            planId = 'plan_single_69'; // EXAMPLE: Replace with your actual Ozow Plan ID
        } else if (plan === 'paid_family') {
            planId = 'plan_family_99'; // EXAMPLE: Replace with your actual Ozow Plan ID
        } else {
            throw new Error('Invalid plan specified.');
        }
    } catch (error) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ error: 'Invalid plan ID specified.' }) 
        };
    }

    // 4. Get the user's email from Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
        return { 
            statusCode: 404, 
            body: JSON.stringify({ error: 'User not found.' }) 
        };
    }
    const userEmail = user.user.email;

    // 5. Build the Ozow API Payload
    const transactionReference = `LG_${planId}_${userId}_${Date.now()}`; 
    
    const ozowPayload = {
        planId: planId,
        customerEmail: userEmail,
        transactionReference: transactionReference,
        successUrl: `${SITE_URL}/app.html?payment=success`,
        cancelUrl: `${SITE_URL}/app.html?payment=cancelled`,
        errorUrl: `${SITE_URL}/app.html?payment=error`,
        notifyUrl: `${SITE_URL}/.netlify/functions/payment-webhook`,
    };

    // 6. Call the Ozow "One API" Subscriptions Endpoint
    // This is the production-ready call.
    try {
        const response = await fetch('https://api.ozow.com/v1/subscriptions', {
            method: 'POST',
            headers: { 
                'ApiKey': OZOW_API_KEY, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(ozowPayload)
        });
        
        const data = await response.json();

        if (!response.ok) {
            console.error('Ozow API Error:', data);
            throw new Error(data.message || 'Ozow API returned an error');
        }

        if (!data.redirectUrl) {
            throw new Error('Ozow did not return a redirectUrl.');
        }
        
        // 7. Send the redirect URL back to the frontend
        return {
            statusCode: 200,
            body: JSON.stringify({ redirectUrl: data.redirectUrl }),
        };

    } catch (error) {
        console.error("Create Subscription Error:", error);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: error.message }) 
        };
    }
};
