/*
 * LearnerGenie - shared auth/session/profile module
 *
 * Extracted from app.html so standalone activity pages (full page navigation)
 * don't each re-implement Supabase setup, session checks, and profile lookup.
 *
 * app.html is NOT changed to use this yet - it keeps its own inline copy of
 * this logic for now. This file is additive only.
 *
 * Load this before shared/learner-api.js, shared/learner-usage.js, or any
 * activity script that references window.LearnerAuth.
 *
 * Requires the Supabase JS SDK to already be loaded on the page:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
 */
(function () {
    const SUPABASE_URL = 'https://yvoemqckgtmedfjudkzo.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2b2VtcWNrZ3RtZWRmanVka3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Mjk3ODYsImV4cCI6MjA3NjQwNTc4Nn0.tbbJT2QWg_Cpl0_FbfVxyZl1Fsord1LQKJztyGQloJo';
    const FREE_PROFILE_LIMIT = 1;

    if (!window.supabase || !window.supabase.createClient) {
        console.error('LearnerAuth: Supabase SDK not found. Load the Supabase <script> tag before learner-auth.js.');
        return;
    }

    const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    /**
     * Reads ?profile_id= from the current URL, matching the convention
     * already used by study-squads.html.
     */
    function getProfileIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('profile_id');
        return raw ? raw : null;
    }

    /**
     * Confirms there is a logged-in session. Redirects to /login.html if not.
     * Returns the session, or null if it redirected (caller should stop).
     */
    async function requireSession() {
        const { data: { session }, error } = await client.auth.getSession();

        if (error) {
            console.error('LearnerAuth: error getting session', error);
        }

        if (!session) {
            window.location.href = '/login.html';
            return null;
        }

        return session;
    }

    /**
     * Loads the active profile for this page.
     * - Reads profile_id from the URL.
     * - If missing, or the profile doesn't belong to this account, sends the
     *   learner back to /app.html to pick a profile (that flow is not being
     *   rebuilt as a standalone page yet).
     * Returns the profile row, or null if it redirected.
     */
    async function requireProfile(session) {
        const profileId = getProfileIdFromUrl();

        if (!profileId) {
            window.location.href = '/app.html';
            return null;
        }

        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', profileId)
            .eq('account_id', session.user.id)
            .single();

        if (error || !data) {
            console.error('LearnerAuth: could not load profile for this page', error);
            window.location.href = '/app.html';
            return null;
        }

        return data;
    }

    /**
     * Fetches account tier + profile_limit, creating a free-tier row if one
     * doesn't exist yet. Mirrors checkAccountStatus()'s account portion in
     * app.html, minus the profile-picker rendering (activity pages assume a
     * profile has already been chosen via ?profile_id=).
     */
    async function getAccount(userId) {
        const { data: account, error: accountError } = await client
            .from('accounts')
            .select('active_tier, profile_limit')
            .eq('id', userId)
            .single();

        if (accountError && accountError.code !== 'PGRST116') {
            throw new Error(`Failed to fetch account: ${accountError.message}`);
        }

        if (!account) {
            const { error: insertError } = await client
                .from('accounts')
                .insert({ id: userId, active_tier: 'free', profile_limit: FREE_PROFILE_LIMIT });

            if (insertError) throw new Error(`Failed to insert new account: ${insertError.message}`);
            return { active_tier: 'free', profile_limit: FREE_PROFILE_LIMIT };
        }

        return account;
    }

    /**
     * Convenience wrapper for the common case: confirm session, confirm
     * profile, fetch account. Redirects (and returns null) on any failure.
     */
    async function requireSessionAndProfile() {
        const session = await requireSession();
        if (!session) return null;

        const profile = await requireProfile(session);
        if (!profile) return null;

        let account;
        try {
            account = await getAccount(session.user.id);
        } catch (error) {
            console.error('LearnerAuth: error loading account', error);
            account = { active_tier: 'free', profile_limit: FREE_PROFILE_LIMIT };
        }

        return { session, profile, account };
    }

    /**
     * Builds a link back into app.html or another activity page, preserving
     * the current profile_id the way study-squads.html does.
     */
    function withProfileId(path) {
        const profileId = getProfileIdFromUrl();
        if (!profileId) return path;
        const separator = path.includes('?') ? '&' : '?';
        return `${path}${separator}profile_id=${encodeURIComponent(profileId)}`;
    }

    async function signOut() {
        await client.auth.signOut();
        window.location.href = '/login.html';
    }

    window.LearnerAuth = {
        supabase: client,
        FREE_PROFILE_LIMIT,
        getProfileIdFromUrl,
        requireSession,
        requireProfile,
        getAccount,
        requireSessionAndProfile,
        withProfileId,
        signOut
    };
})();
