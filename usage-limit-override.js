// Robust free-tier usage enforcement for LearnerGenie.
// This script is intentionally self-contained because app.html defines its app state
// with top-level const values that are not available to external scripts.
// It overrides the existing global checkAndIncrementUsage() function used by all tools.

(function () {
  const SUPABASE_URL = 'https://yvoemqckgtmedfjudkzo.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2b2VtcWNrZ3RtZWRmanVka3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA4Mjk3ODYsImV4cCI6MjA3NjQwNTc4Nn0.tbbJT2QWg_Cpl0_FbfVxyZl1Fsord1LQKJztyGQloJo';
  const FREE_USAGE_LIMIT = 5;

  if (!window.supabase?.createClient) {
    console.error('Usage limit override could not find Supabase client library.');
    return;
  }

  const usageClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  function showUsagePaywall() {
    if (typeof window.showPaywallModal === 'function') {
      window.showPaywallModal('usage');
      return;
    }

    const modal = document.getElementById('paywall-modal');
    const content = document.getElementById('paywall-content');
    if (modal && content) {
      content.innerHTML = `
        <i data-lucide="lock" class="mx-auto h-12 w-12 text-indigo-600 mb-4"></i>
        <h2 class="text-2xl font-bold text-gray-800 mb-2">Free limit reached</h2>
        <p class="text-gray-600 mb-6">You have used your free questions. Upgrade to continue learning with LearnerGenie.</p>
        <button onclick="document.querySelector('[data-nav-link=upgrade]')?.click()" class="bg-indigo-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-700">Upgrade now</button>
      `;
      modal.classList.remove('hidden');
      modal.classList.add('flex');
      if (window.lucide?.createIcons) window.lucide.createIcons();
    } else {
      alert('You have reached your free usage limit. Please upgrade to continue.');
    }
  }

  async function rpcUsageLimitCheck() {
    try {
      const { data: sessionData, error: sessionError } = await usageClient.auth.getSession();
      if (sessionError || !sessionData?.session) {
        console.error('Usage limit session check failed:', sessionError);
        window.location.href = '/login.html';
        return false;
      }

      const { data, error } = await usageClient.rpc('consume_free_usage', {
        p_free_limit: FREE_USAGE_LIMIT,
        p_window_days: 7
      });

      if (error) {
        console.error('Usage limit RPC failed:', error);
        showUsagePaywall();
        return false;
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result || result.allowed !== true) {
        showUsagePaywall();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected usage limit check error:', error);
      showUsagePaywall();
      return false;
    }
  }

  window.checkAndIncrementUsage = rpcUsageLimitCheck;
})();
