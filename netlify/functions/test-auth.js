/*
 * DIAGNOSTIC FUNCTION: netlify/functions/test-auth.js
 * 
 * Create this file to test your Supabase authentication setup.
 * Access it at: https://yoursite.com/api/test-auth
 */

const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
    const {
        SUPABASE_URL,
        SUPABASE_SERVICE_KEY,
        SUPABASE_ANON_KEY
    } = process.env;

    // Check environment variables
    const diagnostics = {
        timestamp: new Date().toISOString(),
        environment: {
            supabaseUrlSet: !!SUPABASE_URL,
            supabaseUrlValue: SUPABASE_URL,
            serviceKeySet: !!SUPABASE_SERVICE_KEY,
            serviceKeyPrefix: SUPABASE_SERVICE_KEY?.substring(0, 30),
            anonKeySet: !!SUPABASE_ANON_KEY,
            anonKeyPrefix: SUPABASE_ANON_KEY?.substring(0, 30)
        },
        auth: {
            headerPresent: !!(event.headers.authorization || event.headers.Authorization),
            headerValue: null,
            tokenLength: 0,
            validationResult: null
        }
    };

    // Get the authorization header
    const authHeader = event.headers.authorization || event.headers.Authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        diagnostics.auth.headerValue = 'Bearer ' + token.substring(0, 20) + '...';
        diagnostics.auth.tokenLength = token.length;

        // Try to validate the token
        try {
            const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error) {
                diagnostics.auth.validationResult = {
                    success: false,
                    error: error.message,
                    errorName: error.name,
                    errorStatus: error.status
                };
            } else if (user) {
                diagnostics.auth.validationResult = {
                    success: true,
                    userId: user.id,
                    userEmail: user.email,
                    userCreatedAt: user.created_at
                };
            } else {
                diagnostics.auth.validationResult = {
                    success: false,
                    error: 'No user returned'
                };
            }
        } catch (err) {
            diagnostics.auth.validationResult = {
                success: false,
                error: err.message,
                stack: err.stack
            };
        }
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(diagnostics, null, 2)
    };
};
