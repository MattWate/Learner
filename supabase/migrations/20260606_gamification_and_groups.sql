-- LearnerGenie Premium Social Gamification & Engagement Engine
-- Philosophy: reward consistency and study habits, never academic performance.
-- XP is tied only to platform engagement: asking/generating work and completing tests.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_premium_account(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path =