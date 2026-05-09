-- Tutor centres and learner reporting support
-- Created for LearnerGenie tutor/teacher dashboard feature.
-- Safe to run once in Supabase SQL editor or through Supabase migrations.

-- 1) Optional learner metadata for grouping and reporting
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grade text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS school text;

-- 2) Optional saved work metadata for better reporting/filtering
ALTER TABLE public.saved_work
  ADD COLUMN IF NOT EXISTS subject text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS language text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Tutor centres manually onboarded by admin/owner for V1
CREATE TABLE IF NOT EXISTS public.tutor_centres (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  description text,
  contact_email text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4) Links normal accounts to tutor centres
CREATE TABLE IF NOT EXISTS public.tutor_centre_users (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tutor_centre_id bigint NOT NULL REFERENCES public.tutor_centres(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'tutor' CHECK (role IN ('owner', 'admin', 'tutor', 'teacher')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tutor_centre_id, account_id)
);

-- 5) Links learner profiles to tutor centres
CREATE TABLE IF NOT EXISTS public.tutor_centre_profiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tutor_centre_id bigint NOT NULL REFERENCES public.tutor_centres(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'revoked', 'inactive')),
  assigned_at timestamp with time zone NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES public.accounts(id),
  UNIQUE (tutor_centre_id, profile_id)
);

-- 6) Tutor centre groups/classes/cohorts
CREATE TABLE IF NOT EXISTS public.tutor_groups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tutor_centre_id bigint NOT NULL REFERENCES public.tutor_centres(id) ON DELETE CASCADE,
  name text NOT NULL,
  group_type text NOT NULL DEFAULT 'custom' CHECK (group_type IN ('grade', 'subject', 'language', 'custom')),
  description text,
  created_by uuid REFERENCES public.accounts(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 7) Many-to-many learner membership in tutor groups
CREATE TABLE IF NOT EXISTS public.tutor_group_profiles (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tutor_group_id bigint NOT NULL REFERENCES public.tutor_groups(id) ON DELETE CASCADE,
  profile_id bigint NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (tutor_group_id, profile_id)
);

-- Helpful indexes for dashboard/reporting queries
CREATE INDEX IF NOT EXISTS idx_profiles_account_id ON public.profiles(account_id);
CREATE INDEX IF NOT EXISTS idx_saved_work_profile_id_created_at ON public.saved_work(profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_work_subject ON public.saved_work(subject);
CREATE INDEX IF NOT EXISTS idx_tutor_centre_users_account_id ON public.tutor_centre_users(account_id);
CREATE INDEX IF NOT EXISTS idx_tutor_centre_users_centre_id ON public.tutor_centre_users(tutor_centre_id);
CREATE INDEX IF NOT EXISTS idx_tutor_centre_profiles_profile_id ON public.tutor_centre_profiles(profile_id);
CREATE INDEX IF NOT EXISTS idx_tutor_centre_profiles_centre_id ON public.tutor_centre_profiles(tutor_centre_id);
CREATE INDEX IF NOT EXISTS idx_tutor_groups_centre_id ON public.tutor_groups(tutor_centre_id);
CREATE INDEX IF NOT EXISTS idx_tutor_group_profiles_group_id ON public.tutor_group_profiles(tutor_group_id);
CREATE INDEX IF NOT EXISTS idx_tutor_group_profiles_profile_id ON public.tutor_group_profiles(profile_id);

-- Keep updated_at current on tutor_centres
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tutor_centres_updated_at ON public.tutor_centres;
CREATE TRIGGER set_tutor_centres_updated_at
BEFORE UPDATE ON public.tutor_centres
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS setup
ALTER TABLE public.tutor_centres ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_centre_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_centre_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutor_group_profiles ENABLE ROW LEVEL SECURITY;

-- Tutor centre members can read their own centres
DROP POLICY IF EXISTS "Tutor centre members can read centres" ON public.tutor_centres;
CREATE POLICY "Tutor centre members can read centres"
ON public.tutor_centres
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_centre_users tcu
    WHERE tcu.tutor_centre_id = tutor_centres.id
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

-- Users can read their own centre membership rows
DROP POLICY IF EXISTS "Users can read their tutor centre memberships" ON public.tutor_centre_users;
CREATE POLICY "Users can read their tutor centre memberships"
ON public.tutor_centre_users
FOR SELECT
USING (account_id = auth.uid());

-- Centre members can read learner assignments for their centres
DROP POLICY IF EXISTS "Tutor centre members can read profile assignments" ON public.tutor_centre_profiles;
CREATE POLICY "Tutor centre members can read profile assignments"
ON public.tutor_centre_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_centre_users tcu
    WHERE tcu.tutor_centre_id = tutor_centre_profiles.tutor_centre_id
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

-- Centre members can read groups for their centres
DROP POLICY IF EXISTS "Tutor centre members can read groups" ON public.tutor_groups;
CREATE POLICY "Tutor centre members can read groups"
ON public.tutor_groups
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_centre_users tcu
    WHERE tcu.tutor_centre_id = tutor_groups.tutor_centre_id
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

-- Centre members can create groups in their centre
DROP POLICY IF EXISTS "Tutor centre members can create groups" ON public.tutor_groups;
CREATE POLICY "Tutor centre members can create groups"
ON public.tutor_groups
FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tutor_centre_users tcu
    WHERE tcu.tutor_centre_id = tutor_groups.tutor_centre_id
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

-- Group creators or centre admins can update/delete groups
DROP POLICY IF EXISTS "Tutor centre members can manage groups" ON public.tutor_groups;
CREATE POLICY "Tutor centre members can manage groups"
ON public.tutor_groups
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_centre_users tcu
    WHERE tcu.tutor_centre_id = tutor_groups.tutor_centre_id
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
      AND (tcu.role IN ('owner', 'admin') OR tutor_groups.created_by = auth.uid())
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tutor_centre_users tcu
    WHERE tcu.tutor_centre_id = tutor_groups.tutor_centre_id
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
      AND (tcu.role IN ('owner', 'admin') OR tutor_groups.created_by = auth.uid())
  )
);

-- Centre members can read group memberships for groups in their centre
DROP POLICY IF EXISTS "Tutor centre members can read group profiles" ON public.tutor_group_profiles;
CREATE POLICY "Tutor centre members can read group profiles"
ON public.tutor_group_profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_groups tg
    JOIN public.tutor_centre_users tcu ON tcu.tutor_centre_id = tg.tutor_centre_id
    WHERE tg.id = tutor_group_profiles.tutor_group_id
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

-- Centre members can add learners to groups only if the learner is assigned to that centre
DROP POLICY IF EXISTS "Tutor centre members can manage group profiles" ON public.tutor_group_profiles;
CREATE POLICY "Tutor centre members can manage group profiles"
ON public.tutor_group_profiles
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.tutor_groups tg
    JOIN public.tutor_centre_users tcu ON tcu.tutor_centre_id = tg.tutor_centre_id
    WHERE tg.id = tutor_group_profiles.tutor_group_id
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.tutor_groups tg
    JOIN public.tutor_centre_users tcu ON tcu.tutor_centre_id = tg.tutor_centre_id
    JOIN public.tutor_centre_profiles tcp ON tcp.tutor_centre_id = tg.tutor_centre_id
    WHERE tg.id = tutor_group_profiles.tutor_group_id
      AND tcp.profile_id = tutor_group_profiles.profile_id
      AND tcp.status = 'active'
      AND tcu.account_id = auth.uid()
      AND tcu.status = 'active'
  )
);

-- NOTE: Existing profiles/saved_work RLS policies may also need extending.
-- Tutors need SELECT access to profiles and saved_work where the profile is actively assigned
-- to one of their active tutor centres. Add these only after checking existing policy names.
