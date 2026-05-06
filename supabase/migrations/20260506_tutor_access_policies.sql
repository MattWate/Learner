-- Extend existing profiles and saved_work RLS so active tutor centre users
-- can read assigned learner profiles and their saved work.
--
-- This keeps tutor access read-only. Parents/account owners retain the existing
-- manage/save/delete access already configured in the database.

-- Tutors/teachers can read learner profiles assigned to one of their active tutor centres.
DROP POLICY IF EXISTS "Tutor centre members can read assigned profiles" ON public.profiles;
CREATE POLICY "Tutor centre members can read assigned profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_centre_profiles tcp
    JOIN public.tutor_centre_users tcu
      ON tcu.tutor_centre_id = tcp.tutor_centre_id
    WHERE tcp.profile_id = profiles.id
      AND tcp.status = 'active'
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

-- Tutors/teachers can read saved work for learner profiles assigned to one
-- of their active tutor centres.
DROP POLICY IF EXISTS "Tutor centre members can read assigned saved work" ON public.saved_work;
CREATE POLICY "Tutor centre members can read assigned saved work"
ON public.saved_work
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_centre_profiles tcp
    JOIN public.tutor_centre_users tcu
      ON tcu.tutor_centre_id = tcp.tutor_centre_id
    WHERE tcp.profile_id = saved_work.profile_id
      AND tcp.status = 'active'
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

-- Optional diagnostic query after running the migration:
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('profiles', 'saved_work')
-- ORDER BY tablename, policyname;
