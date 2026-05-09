-- Paste-safe version of tutor access RLS policies.
-- This file intentionally keeps key SQL keywords separated with spaces
-- so it still works if copied from a browser and line breaks are collapsed.

DROP POLICY IF EXISTS "Tutor centre members can read assigned profiles" ON public.profiles;

CREATE POLICY "Tutor centre members can read assigned profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_centre_profiles AS tcp
    JOIN public.tutor_centre_users AS tcu
      ON tcu.tutor_centre_id = tcp.tutor_centre_id
    WHERE tcp.profile_id = profiles.id
      AND tcp.status = 'active'
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

DROP POLICY IF EXISTS "Tutor centre members can read assigned saved work" ON public.saved_work;

CREATE POLICY "Tutor centre members can read assigned saved work"
ON public.saved_work
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_centre_profiles AS tcp
    JOIN public.tutor_centre_users AS tcu
      ON tcu.tutor_centre_id = tcp.tutor_centre_id
    WHERE tcp.profile_id = saved_work.profile_id
      AND tcp.status = 'active'
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'saved_work')
  AND policyname IN (
    'Tutor centre members can read assigned profiles',
    'Tutor centre members can read assigned saved work'
  )
ORDER BY tablename, policyname;
