-- Add reminder configuration to policies
ALTER TABLE public.policies ADD COLUMN IF NOT EXISTS reminder_preferences JSONB DEFAULT '{"enabled": true, "email": true, "timing_days": [7, 15, 30], "types": ["renewal", "premium"]}';
