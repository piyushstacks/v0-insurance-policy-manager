-- ─────────────────────────────────────────────────────────────────────────────
-- RLS fix for public.customer_dedup_log
-- Run this in Supabase SQL Editor → https://supabase.com/dashboard/project/vvueurxfbdrfbdanxbnl/sql
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Enable RLS (blocks all access by default)
ALTER TABLE public.customer_dedup_log ENABLE ROW LEVEL SECURITY;

-- 2. anon role: NO access (this is an internal log table)
--    (no policy = deny — explicit revoke for clarity)
REVOKE ALL ON public.customer_dedup_log FROM anon;

-- 3. authenticated role: NO direct SELECT/UPDATE/DELETE — only service role writes this
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.customer_dedup_log FROM authenticated;

-- 4. service_role bypasses RLS automatically — no policy needed for it.
--    But if you ever need authenticated users to INSERT (e.g. via RPC), add:
--
-- CREATE POLICY "Allow authenticated insert" ON public.customer_dedup_log
--   FOR INSERT TO authenticated
--   WITH CHECK (true);
--
-- For SELECT restricted to own rows (if user_id column exists):
-- CREATE POLICY "Users see own logs" ON public.customer_dedup_log
--   FOR SELECT TO authenticated
--   USING (user_id = auth.uid());
