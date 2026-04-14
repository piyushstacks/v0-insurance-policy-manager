-- Migration: Add extracted_data column to extraction_jobs table
-- This stores the actual extracted data from OCR

ALTER TABLE extraction_jobs ADD COLUMN IF NOT EXISTS extracted_data JSONB;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_extraction_jobs_status_completed 
  ON extraction_jobs(status, completed_at DESC);
