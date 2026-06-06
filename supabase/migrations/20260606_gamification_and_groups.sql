-- LearnerGenie Premium Social Gamification & Engagement Engine
-- Rewards consistency and study habits, not academic performance.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.is_premium_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = p_account_id
      AND (
        COALESCE(a.active_tier, 'free') <> 'free'
        OR COALESCE(a.subscription