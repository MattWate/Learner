/*
 * LearnerGenie - shared usage limit + paywall module
 *
 * Extracted from app.html (checkAndIncrementUsage, showPaywallModal,
 * paywallModalHTML). Behavior is unchanged - same RPC, same free limit
 * messaging, same close/upgrade buttons.
 *
 * Unlike app.html, this module injects its own modal markup into the page
 * on first use, so activity pages don't need to hand-carry the modal HTML
 * and backdrop CSS themselves.
 *
 * Requires shared/learner-auth.js to be loaded first.
 */
(function () {
    if (!window.LearnerAuth) {
        console.error('LearnerUsage: LearnerAuth not found. Load shared/learner-auth.js before learner-usage.js.');
        return;
    }

    const FREE_USAGE_LIMIT = 5;
    const MODAL_ID = 'learner-paywall-modal';
    const CONTENT_ID = 'learner-paywall-content';

    function ensureModalMounted() {
        if (document.getElementById(MODAL_ID)) return;

        const style = document.createElement('style');
        style.textContent = `
            #${MODAL_ID}.lg-modal-backdrop { background-color: rgba(0, 0, 0, 0.7); }
        `;
        document.head.appendChild(style);

        const modal = document.createElement('div');
        modal.id = MODAL_ID;
        modal.className = 'fixed inset-0 z-50 hidden items-center justify-center lg-modal-backdrop transition-opacity';
        modal.innerHTML = `<div id="${CONTENT_ID}" class="bg-white p-8 rounded-xl shadow-2xl max-w-sm w-full text-center transform transition-transform scale-90"></div>`;
        document.body.appendChild(modal);

        modal.addEventListener('click', (e) => {
            if (e.target.closest('#learner-paywall-close-btn')) {
                hidePaywallModal();
            }
        });
    }

    function paywallModalHTML(reason, account) {
        let title, message;
        if (reason === 'profiles') {
            title = 'Profile Limit Reached';
            message = `You have reached your limit of ${account?.profile_limit ?? 1} learner profile(s). Upgrade your plan to add more profiles.`;
        } else {
            title = 'Weekly Limit Reached';
            message = `You've used your ${FREE_USAGE_LIMIT} free questions this week. Upgrade now for unlimited access!`;
        }

        return `
            <i data-lucide="lock" class="h-12 w-12 text-rose-500 mx-auto mb-4"></i>
            <h2 class="text-2xl font-bold text-gray-800 mb-2">${title}</h2>
            <p class="text-gray-600 mb-6">${message}</p>
            <button id="learner-paywall-close-btn" class="mt-4 mr-2 bg-gray-200 text-gray-800 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300">
                Close
            </button>
            <a href="/app.html" class="mt-4 ml-2 inline-block bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700">
                Upgrade Now
            </a>
        `;
    }

    function showPaywallModal(reason, account) {
        ensureModalMounted();
        const modal = document.getElementById(MODAL_ID);
        const content = document.getElementById(CONTENT_ID);

        content.innerHTML = paywallModalHTML(reason, account);
        if (window.lucide?.createIcons) window.lucide.createIcons();

        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }

    function hidePaywallModal() {
        const modal = document.getElementById(MODAL_ID);
        if (!modal) return;
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    /**
     * Same contract as app.html's checkAndIncrementUsage(): returns true if
     * the request is allowed (and increments usage), false if blocked (and
     * shows the paywall). Callers should `if (!await checkAndIncrementUsage()) return;`
     */
    async function checkAndIncrementUsage(account) {
        try {
            const { data, error } = await window.LearnerAuth.supabase.rpc('consume_free_usage', {
                p_free_limit: FREE_USAGE_LIMIT,
                p_window_days: 7
            });

            if (error) {
                console.error('Usage limit check failed:', error);
                showPaywallModal('usage', account);
                return false;
            }

            const result = Array.isArray(data) ? data[0] : data;

            if (!result || result.allowed !== true) {
                showPaywallModal('usage', account);
                return false;
            }

            return true;

        } catch (error) {
            console.error('Unexpected usage limit check error:', error);
            showPaywallModal('usage', account);
            return false;
        }
    }

    window.LearnerUsage = {
        FREE_USAGE_LIMIT,
        checkAndIncrementUsage,
        showPaywallModal,
        hidePaywallModal
    };
})();
