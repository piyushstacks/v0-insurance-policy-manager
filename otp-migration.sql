-- ================================================================
-- APPEND TO Supabase SQL Editor (run after team-migration.sql)
-- ================================================================

-- OTP Codes table
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  hashed_otp TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login', 'email-change')),
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_email_purpose ON public.otp_codes(email, purpose, used);

ALTER TABLE public.otp_codes DISABLE ROW LEVEL SECURITY;

-- Verify
SELECT 'otp_codes table ready' AS status;
