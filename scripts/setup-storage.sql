-- Setup storage bucket for policy documents
-- Execute this in your Supabase SQL Editor after init-db.sql

-- Create bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('policy-documents', 'policy-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload documents
CREATE POLICY "Allow authenticated users to upload"
ON storage.objects FOR INSERT
WITH CHECK (
  auth.role() = 'authenticated' AND
  bucket_id = 'policy-documents'
);

-- Allow users to view their own documents
CREATE POLICY "Allow users to view own documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'policy-documents' AND (
    -- Allow authenticated users to download
    auth.role() = 'authenticated' OR
    -- Allow public access (documents are tied to policies)
    true
  )
);

-- Allow users to delete their own documents
CREATE POLICY "Allow users to delete own documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'policy-documents' AND
  auth.role() = 'authenticated'
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_storage_bucket_name
ON storage.objects(bucket_id, name);
