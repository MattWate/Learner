// Robust free-tier usage enforcement.
// Loaded after app.html so it overrides the original client-side counter logic.
// The learner tools already call checkAndIncrementUsage() before generation.

(function () {
  async function rpcUsageLimitCheck() {
    try {
      if (!window.supabaseClient || !window.state) {
        console.error('Usage limit check could not find app state or Supabase client.');
        return false;
      }

      if (state.accountData?.active_tier !== 'free') {
        return true;
      }

      const { data, error } = await supabaseClient.rpc('consume_free_usage', {
        p_free_limit: typeof FREE_USAGE_LIMIT !== 'undefined' ? FREE_USAGE_LIMIT : 5,
        p_window_days: 7
      });

      if (error) {
        console.error('Usage limit RPC failed:', error);
        showPaywallModal('usage');
        return false;
      }

      const result = Array.isArray(data) ? data[0] : data;

      if (!result || result.allowed !== true) {
        if (result?.usage_count !== undefined) {
          state.usageData.count = result.usage_count;
        }
        if (result?.reset_date) {
          state.usageData.resetDate = result.reset_date;
        }
        if (typeof updateSidebar === 'function') updateSidebar();
        showPaywallModal('usage');
        return false;
      }

      if (result.usage_count !== undefined) {
        state.usageData.count = result.usage_count;
      }
      if (result.reset_date) {
        state.usageData.resetDate = result.reset_date;
      }
      if (typeof updateSidebar === 'function') updateSidebar();

      return true;
    } catch (error) {
      console.error('Unexpected usage limit check error:', error);
      showPaywallModal('usage');
      return false;
    }
  }

  window.checkAndIncrementUsage = rpcUsageLimitCheck;
})();
