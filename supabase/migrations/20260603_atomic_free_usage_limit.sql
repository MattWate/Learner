-- Atomic free-tier usage enforcement for LearnerGenie.
-- This function should be called immediately before a learner-facing AI generation request.
-- It uses auth.uid(), locks the caller's monthly_usage row, checks the limit, and increments in one transaction.

CREATE OR REPLACE FUNCTION public.consume_free_usage(
  p_free_limit integer DEFAULT 5,
  p_window_days integer DEFAULT 7
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_active_tier text;
  v_subscription_status text;
  v_usage_count integer;
  v_last_reset timestamptz;
  v_window_start timestamptz;
  v_new_count integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'not_authenticated',
      'message', 'Please log in again.'
    );
  END IF;

  SELECT active_tier, subscription_status
  INTO v_active_tier, v_subscription_status
  FROM public.accounts
  WHERE id = v_user_id;

  -- If the account row is missing, create a safe free-tier default.
  IF v_active_tier IS NULL THEN
    INSERT INTO public.accounts (id, active_tier, subscription_status, profile_limit)
    VALUES (v_user_id, 'free', 'free', 1)
    ON CONFLICT (id) DO NOTHING;

    v_active_tier := 'free';
    v_subscription_status := 'free';
  END IF;

  -- Paid users are not limited by the free usage counter.
  IF COALESCE(v_active_tier, 'free') <> 'free'
     OR COALESCE(v_subscription_status, 'free') IN ('active', 'paid', 'trialing') THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'reason', 'paid_account',
      'tier', COALESCE(v_active_tier, 'free')
    );
  END IF;

  INSERT INTO public.monthly_usage (account_id, usage_count, last_reset_date)
  VALUES (v_user_id, 0, now())
  ON CONFLICT (account_id) DO NOTHING;

  -- Lock the row to prevent concurrent requests from both passing the limit check.
  SELECT usage_count, last_reset_date
  INTO v_usage_count, v_last_reset
  FROM public.monthly_usage
  WHERE account_id = v_user_id
  FOR UPDATE;

  v_window_start := COALESCE(v_last_reset, now());
  v_usage_count := COALESCE(v_usage_count, 0);

  IF now() >= v_window_start + make_interval(days => p_window_days) THEN
    v_usage_count := 0;
    v_window_start := now();
  END IF;

  IF v_usage_count >= p_free_limit THEN
    UPDATE public.monthly_usage
    SET usage_count = v_usage_count,
        last_reset_date = v_window_start
    WHERE account_id = v_user_id;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'free_limit_reached',
      'usage_count', v_usage_count,
      'limit', p_free_limit,
      'remaining', 0,
      'reset_date', v_window_start,
      'message', 'You have reached your free usage limit.'
    );
  END IF;

  v_new_count := v_usage_count + 1;

  UPDATE public.monthly_usage
  SET usage_count = v_new_count,
      last_reset_date = v_window_start
  WHERE account_id = v_user_id;

  RETURN jsonb_build_object(
    'allowed', true,
    'reason', 'usage_consumed',
    'usage_count', v_new_count,
    'limit', p_free_limit,
    'remaining', GREATEST(p_free_limit - v_new_count, 0),
    'reset_date', v_window_start
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_free_usage(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_free_usage(integer, integer) TO authenticated;

-- Quick verification after running:
-- SELECT routine_name, security_type
-- FROM information_schema.routines
-- WHERE routine_schema = 'public'
--   AND routine_name = 'consume_free_usage';
