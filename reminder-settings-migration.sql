-- Centralized Reminder Settings
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS reminder_preferences JSONB DEFAULT '{"enabled": true, "email": true, "timing_days": [7, 15, 30], "types": ["renewal", "premium"]}';

-- Remove from policies if we created it
ALTER TABLE public.policies DROP COLUMN IF EXISTS reminder_preferences;
