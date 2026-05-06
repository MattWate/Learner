-- Seed and verify a test tutor centre setup.
-- Run the SELECT sections first to find the account/profile IDs you want to use.
-- Then edit the values in the INSERT section before running.

-- 1) Find candidate accounts.
-- Use this to identify the tutor account and parent account IDs.
SELECT
  id AS account_id,
  parent_email,
  active_tier,
  subscription_status,
  profile_limit
FROM public.accounts
ORDER BY parent_email NULLS LAST, id;

-- 2) Find candidate learner profiles.
-- Use this to identify the learner profile ID to assign to the tutor centre.
SELECT
  p.id AS profile_id,
  p.name AS learner_name,
  p.account_id,
  a.parent_email
FROM public.profiles p
LEFT JOIN public.accounts a ON a.id = p.account_id
ORDER BY a.parent_email NULLS LAST, p.name;

-- 3) EDIT THESE VALUES BEFORE RUNNING THE INSERTS BELOW.
-- Replace with real values from the SELECT queries above.
--
-- Example:
-- tutor_account_id = '00000000-0000-0000-0000-000000000000'
-- learner_profile_id = 1

-- 4) Create a test tutor centre.
-- Change the name/email if useful.
INSERT INTO public.tutor_centres (name, description, contact_email)
VALUES ('Test Tutor Centre', 'Initial tutor centre for access testing', 'test@example.com')
RETURNING id AS tutor_centre_id, name;

-- 5) Link a tutor account to the tutor centre.
-- Replace :tutor_centre_id and :tutor_account_id manually before running.
--
-- INSERT INTO public.tutor_centre_users (tutor_centre_id, account_id, role, status)
-- VALUES (:tutor_centre_id, ':tutor_account_id', 'tutor', 'active')
-- RETURNING *;

-- 6) Link a learner profile to the tutor centre.
-- Replace :tutor_centre_id and :learner_profile_id manually before running.
-- assigned_by can be the tutor account ID or your own admin/owner account ID.
--
-- INSERT INTO public.tutor_centre_profiles (tutor_centre_id, profile_id, status, assigned_by)
-- VALUES (:tutor_centre_id, :learner_profile_id, 'active', ':tutor_account_id')
-- RETURNING *;

-- 7) Verify centre membership and assigned learners.
-- Replace :tutor_centre_id manually before running.
--
-- SELECT
--   tc.id AS tutor_centre_id,
--   tc.name AS tutor_centre_name,
--   tcu.account_id AS tutor_account_id,
--   tcu.role,
--   tcu.status AS tutor_status,
--   tcp.profile_id,
--   p.name AS learner_name,
--   tcp.status AS learner_assignment_status
-- FROM public.tutor_centres tc
-- JOIN public.tutor_centre_users tcu ON tcu.tutor_centre_id = tc.id
-- JOIN public.tutor_centre_profiles tcp ON tcp.tutor_centre_id = tc.id
-- JOIN public.profiles p ON p.id = tcp.profile_id
-- WHERE tc.id = :tutor_centre_id;

-- 8) Verify saved work exists for the assigned learner.
-- Replace :learner_profile_id manually before running.
--
-- SELECT
--   id,
--   profile_id,
--   work_type,
--   subject,
--   topic,
--   language,
--   created_at
-- FROM public.saved_work
-- WHERE profile_id = :learner_profile_id
-- ORDER BY created_at DESC
-- LIMIT 20;
