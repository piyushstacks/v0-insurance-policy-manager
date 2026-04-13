-- Insurance Policy Management System - Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if they exist (for fresh setup)
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS extraction_jobs CASCADE;
DROP TABLE IF EXISTS policy_documents CASCADE;
DROP TABLE IF EXISTS policies CASCADE;
DROP TABLE IF EXISTS insurers CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. Users table (extends Supabase auth.users)
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('admin', 'staff')) DEFAULT 'staff',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON users FOR SELECT
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- 2. Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view customers"
  ON customers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert customers"
  ON customers FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update customers"
  ON customers FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 3. Insurers table
CREATE TABLE insurers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  contact TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE insurers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view insurers"
  ON insurers FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage insurers"
  ON insurers FOR ALL
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- 4. Policies table
CREATE TABLE policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  insurer_id UUID NOT NULL REFERENCES insurers(id) ON DELETE RESTRICT,
  policy_number TEXT NOT NULL UNIQUE,
  policy_type TEXT NOT NULL,
  issue_date DATE,
  start_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  premium_due_date DATE,
  premium_amount DECIMAL(12, 2),
  sum_insured DECIMAL(15, 2),
  vehicle_number TEXT,
  nominee TEXT,
  agent_notes TEXT,
  status TEXT CHECK (status IN ('active', 'expired', 'renewed', 'cancelled')) DEFAULT 'active',
  extraction_confidence FLOAT DEFAULT 0.0 CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_policies_customer_id ON policies(customer_id);
CREATE INDEX idx_policies_insurer_id ON policies(insurer_id);
CREATE INDEX idx_policies_status ON policies(status);
CREATE INDEX idx_policies_expiry_date ON policies(expiry_date);
CREATE INDEX idx_policies_policy_number ON policies(policy_number);

ALTER TABLE policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view policies"
  ON policies FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert policies"
  ON policies FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update policies"
  ON policies FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 5. Policy Documents table
CREATE TABLE policy_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT CHECK (file_type IN ('pdf', 'jpg', 'png')) NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  raw_ocr_text TEXT,
  extraction_status TEXT CHECK (extraction_status IN ('pending', 'extracted', 'reviewed', 'failed')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_policy_documents_policy_id ON policy_documents(policy_id);
CREATE INDEX idx_policy_documents_extraction_status ON policy_documents(extraction_status);

ALTER TABLE policy_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view documents"
  ON policy_documents FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert documents"
  ON policy_documents FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- 6. Extraction Jobs table
CREATE TABLE extraction_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES policy_documents(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('queued', 'processing', 'completed', 'failed')) DEFAULT 'queued',
  job_id TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_extraction_jobs_document_id ON extraction_jobs(document_id);
CREATE INDEX idx_extraction_jobs_status ON extraction_jobs(status);
CREATE INDEX idx_extraction_jobs_job_id ON extraction_jobs(job_id);

ALTER TABLE extraction_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view jobs"
  ON extraction_jobs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert jobs"
  ON extraction_jobs FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update jobs"
  ON extraction_jobs FOR UPDATE
  USING (auth.role() = 'authenticated');

-- 7. Reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  reminder_type TEXT CHECK (reminder_type IN ('renewal_30days', 'renewal_7days', 'premium_due', 'followup')) NOT NULL,
  scheduled_date DATE NOT NULL,
  sent_date DATE,
  status TEXT CHECK (status IN ('pending', 'sent', 'skipped')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reminders_policy_id ON reminders(policy_id);
CREATE INDEX idx_reminders_scheduled_date ON reminders(scheduled_date);
CREATE INDEX idx_reminders_status ON reminders(status);

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view reminders"
  ON reminders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can manage reminders"
  ON reminders FOR ALL
  USING (auth.role() = 'authenticated');

-- 8. Audit Logs table
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID,
  changes JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON audit_logs FOR SELECT
  USING ((SELECT role FROM users WHERE id = auth.uid()) = 'admin');

-- Helper function for audit logging (simplified for now)
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (action, table_name, record_id)
    VALUES ('DELETE', TG_TABLE_NAME, OLD.id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (action, table_name, record_id, changes)
    VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (action, table_name, record_id)
    VALUES ('INSERT', TG_TABLE_NAME, NEW.id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
