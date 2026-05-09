-- Inspect RLS policy and table security configuration for LearnerGenie.
-- Run this in the Supabase SQL editor and share the output.
-- It does not modify data or schema.

-- 1) RLS status by relevant table
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'accounts',
    'monthly_usage',
    'profiles',
    'saved_work',
    'tutor_centres',
    'tutor_centre_users',
    'tutor_centre_profiles',
    'tutor_groups',
    'tutor_group_profiles'
  )
ORDER BY c.relname;

-- 2) Existing RLS policies on relevant tables
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'accounts',
    'monthly_usage',
    'profiles',
    'saved_work',
    'tutor_centres',
    'tutor_centre_users',
    'tutor_centre_profiles',
    'tutor_groups',
    'tutor_group_profiles'
  )
ORDER BY tablename, policyname, cmd;

-- 3) Grants on relevant tables
SELECT
  table_schema,
  table_name,
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN (
    'accounts',
    'monthly_usage',
    'profiles',
    'saved_work',
    'tutor_centres',
    'tutor_centre_users',
    'tutor_centre_profiles',
    'tutor_groups',
    'tutor_group_profiles'
  )
  AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- 4) Columns and constraints on relevant tables
SELECT
  c.table_schema,
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.table_schema = 'public'
  AND c.table_name IN (
    'accounts',
    'monthly_usage',
    'profiles',
    'saved_work',
    'tutor_centres',
    'tutor_centre_users',
    'tutor_centre_profiles',
    'tutor_groups',
    'tutor_group_profiles'
  )
ORDER BY c.table_name, c.ordinal_position;

-- 5) Foreign keys for relevant tables
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  ccu.table_schema AS foreign_table_schema,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
 AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
 AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN (
    'accounts',
    'monthly_usage',
    'profiles',
    'saved_work',
    'tutor_centres',
    'tutor_centre_users',
    'tutor_centre_profiles',
    'tutor_groups',
    'tutor_group_profiles'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- 6) Indexes on relevant tables
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'accounts',
    'monthly_usage',
    'profiles',
    'saved_work',
    'tutor_centres',
    'tutor_centre_users',
    'tutor_centre_profiles',
    'tutor_groups',
    'tutor_group_profiles'
  )
ORDER BY tablename, indexname;

-- 7) Compact JSON export of policy data only.
-- This is useful if you want to copy/paste one result cell back into ChatGPT.
SELECT jsonb_pretty(jsonb_agg(policy_info ORDER BY policy_info->>'tablename', policy_info->>'policyname')) AS policies_json
FROM (
  SELECT jsonb_build_object(
    'schemaname', schemaname,
    'tablename', tablename,
    'policyname', policyname,
    'permissive', permissive,
    'roles', roles,
    'cmd', cmd,
    'using_expression', qual,
    'with_check_expression', with_check
  ) AS policy_info
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'accounts',
      'monthly_usage',
      'profiles',
      'saved_work',
      'tutor_centres',
      'tutor_centre_users',
      'tutor_centre_profiles',
      'tutor_groups',
      'tutor_group_profiles'
    )
) x;
