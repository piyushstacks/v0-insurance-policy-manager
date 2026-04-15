-- ================================================================
-- TEAM SELF-REPAIR SQL
-- Paste this entire block into Supabase SQL Editor → Run
-- It auto-detects your user + team and inserts the missing rows
-- ================================================================

-- Step 1: See what exists (for your review)
SELECT
  u.id AS user_id,
  u.email,
  t.id AS team_id,
  t.name AS team_name,
  t.admin_id
FROM auth.users u
JOIN public.teams t ON t.admin_id = u.id;

-- Step 2: Insert missing team_members rows for all team admins
INSERT INTO public.team_members (team_id, user_id, role, status)
SELECT
  t.id AS team_id,
  t.admin_id AS user_id,
  'ADMIN' AS role,
  'ACTIVE' AS status
FROM public.teams t
ON CONFLICT (team_id, user_id) DO NOTHING;

-- Step 3: Ensure user_profiles exist and are linked
INSERT INTO public.user_profiles (id, full_name, team_id, role, status)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'full_name', u.email),
  t.id,
  'ADMIN',
  'ACTIVE'
FROM auth.users u
JOIN public.teams t ON t.admin_id = u.id
ON CONFLICT (id) DO UPDATE
  SET team_id = EXCLUDED.team_id,
      role = 'ADMIN',
      status = 'ACTIVE';

-- Step 4: Verify results
SELECT
  tm.user_id,
  u.email,
  t.name AS team_name,
  tm.role,
  tm.status,
  up.team_id AS profile_team_id
FROM public.team_members tm
JOIN public.teams t ON t.id = tm.team_id
JOIN auth.users u ON u.id = tm.user_id
LEFT JOIN public.user_profiles up ON up.id = tm.user_id;
