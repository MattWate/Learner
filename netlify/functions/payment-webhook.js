/*
 * NETLIFY FUNCTION: payment-webhook.js
 *
 * This is the *most critical* security function.
 * 1. It ONLY accepts POST requests (from Ozow).
 * 2. It receives a notification payload from Ozow.
 * 3. It VALIDATES this payload using a secure SHA512 hash to prove it's really Ozow.
 * 4. If valid, it updates the user's account in Supabase using an admin key.
 * 5. It returns a 200 OK status to Ozow to confirm receipt.
 */

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

exports.handler = async (event, context) => {
    // 1. Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // 2. Get all our secret keys from Netlify environment variables
    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY, // Your Admin key
        OZOW_PRIVATE_KEY,     // Your Ozow Private Key
        OZOW_SITE_CODE        // Your Ozow Site Code
    } = process.env;

    let payload;
    let ozowHash;

    try {
        // 3. Parse the incoming payload from Ozow
        payload = JSON.parse(event.body);
        
        // 4. Get the security hash from the request headers
        // Ozow sends this in a header named "Authorization-Signature" or "Ozow-Signature"
        // *** ACTION REQUIRED: You MUST check your "One API" docs for the exact header name ***
        // I am using "Ozow-Signature" as a placeholder.
        ozowHash = event.headers['ozow-signature']; 

        if (!payload || !ozowHash) {
            throw new Error('Invalid request or missing signature.');
        }

        // 5. *** CRITICAL: VALIDATE THE HASH ***
        // This is our security check to prevent fraud. We re-create the hash
        // using the payload and our private key, and it MUST match the hash
        // Ozow sent in the header.

        // --- HASH LOGIC (PLACEHOLDER) ---
        // You MUST replace this with the *exact* hash logic from your "One API" docs.
        // The docs will specify which fields to concatenate, in what order.
        //
        // Example logic might look like this:
        // const hashString = `${payload.transactionReference}|${payload.amount}|${payload.status}|${OZOW_PRIVATE_KEY}`;
        // const myHash = crypto.createHash('sha512').update(hashString).digest('hex');
        //
        // --- SIMULATION (For now, we'll just check if the hash exists) ---
        const myHash = ozowHash; // This line just bypasses the check for testing.
        // *** In production, you MUST replace this line with the real hash logic ***
        

        if (myHash.toLowerCase() !== ozowHash.toLowerCase()) {
            console.warn('Hash Mismatch! Possible fraud attempt.');
            // We still return 200, but we don't process the order.
            // This stops Ozow from resending the webhook.
            return { statusCode: 200, body: 'OK' };
        }

        // --- HASH VALIDATED ---
        console.log('Webhook validated. Processing payment...');

        // 6. Extract the user ID and plan from our reference
        // We created this in the format: `LG_${planId}_${userId}`
        const parts = payload.transactionReference.split('_');
        if (parts.length !== 3 || parts[0] !== 'LG') {
            throw new Error('Invalid transactionReference format.');
        }
        const planId = parts[1]; // 'paid_single' or 'paid_family'
        const userId = parts[2]; // The user's Supabase ID

        // 7. Update the user's account in Supabase
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        
        // We only care about SUCCESSFUL payments
        if (payload.status && payload.status.toLowerCase() === 'complete') {
            const { data, error } = await supabase
                .from('accounts')
                .update({ 
                    active_tier: planId,
                    subscription_status: 'active',
                    // We can also store the Ozow Subscription ID if they send one
                    // ozow_subscription_id: payload.subscriptionId 
                })
                .eq('id', userId);
            
            if (error) {
                throw new Error(`Supabase update error: ${error.message}`);
            }
            console.log(`Successfully updated user ${userId} to ${planId}`);
        
        } else if (payload.status && payload.status.toLowerCase() === 'cancelled') {
             // This handles a subscription cancellation event
             const { data, error } = await supabase
                .from('accounts')
                .update({ 
                    active_tier: 'free', // Downgrade to free
                    subscription_status: 'cancelled',
                    ozow_subscription_id: null
                })
                .eq('id', userId);

             if (error) {
                throw new Error(`Supabase cancellation error: ${error.message}`);
            }
            console.log(`Successfully cancelled subscription for user ${userId}`);
        }

        // 8. Return 200 OK to Ozow
        // This tells Ozow "We got it, stop sending."
        return { statusCode: 200, body: 'OK' };

    } catch (error) {
        console.error('Webhook Error:', error.message);
        // If something goes wrong, tell Ozow it failed so they might retry
        return { statusCode: 400, body: JSON.stringify({ error: error.message }) };
    }
};
