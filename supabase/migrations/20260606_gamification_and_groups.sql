-- LearnerGenie Premium Social Gamification & Engagement Engine
-- Philosophy: reward consistency and study habits, never academic performance.
-- XP is tied only to platform engagement: asking/generating work and completing tests.

-- Required for gen_random_uuid(). Supabase usually has this enabled, but this is safe.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Helper functions
-- -----------------------------------------------------------------------------

-- Lear