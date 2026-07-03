-- ════════════════════════════════════════════════════════════════════
-- Insurance CRM — Full Schema Migration
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/vvueurxfbdrfbdanxbnl/sql/new
-- ════════════════════════════════════════════════════════════════════

-- ── EXTENSIONS ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- for fuzzy search

-- ════════════════════════════════════════════════════════════════════
-- 1. CUSTOMERS — Extended
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS dob             DATE,
  ADD COLUMN IF NOT EXISTS gender          TEXT CHECK (gender IN ('male','female','other')),
  ADD COLUMN IF NOT EXISTS pan             TEXT,
  ADD COLUMN IF NOT EXISTS aadhaar         TEXT,
  ADD COLUMN IF NOT EXISTS ckyc_number     TEXT,
  ADD COLUMN IF NOT EXISTS eia_number      TEXT,
  ADD COLUMN IF NOT EXISTS gst_number      TEXT,
  ADD COLUMN IF NOT EXISTS occupation      TEXT,
  ADD COLUMN IF NOT EXISTS company_customer_id TEXT;

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════
-- 2. POLICIES — Extended with all common fields
-- ════════════════════════════════════════════════════════════════════

-- Rename columns to match new schema if they exist under old names
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='policies' AND column_name='coverage_start') THEN
    ALTER TABLE public.policies RENAME COLUMN coverage_start TO policy_start_date;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='policies' AND column_name='coverage_end') THEN
    ALTER TABLE public.policies RENAME COLUMN coverage_end TO policy_end_date;
  END IF;
END $$;

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS insurance_type    TEXT CHECK (insurance_type IN ('life','health','motor','commercial','other')),
  ADD COLUMN IF NOT EXISTS product_name      TEXT,
  ADD COLUMN IF NOT EXISTS proposal_number   TEXT,
  ADD COLUMN IF NOT EXISTS policy_holder_name TEXT,
  ADD COLUMN IF NOT EXISTS issue_date        DATE,
  ADD COLUMN IF NOT EXISTS policy_start_date DATE,
  ADD COLUMN IF NOT EXISTS policy_end_date   DATE,
  ADD COLUMN IF NOT EXISTS is_renewal        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS premium_frequency TEXT CHECK (premium_frequency IN ('annual','half-yearly','quarterly','monthly','single')),
  ADD COLUMN IF NOT EXISTS gst_amount        NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS total_premium     NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_mode      TEXT CHECK (payment_mode IN ('cheque','online','cash','ecs','nach')),
  ADD COLUMN IF NOT EXISTS payment_date      DATE,
  ADD COLUMN IF NOT EXISTS agent_name        TEXT,
  ADD COLUMN IF NOT EXISTS agent_code        TEXT,
  ADD COLUMN IF NOT EXISTS branch            TEXT,
  ADD COLUMN IF NOT EXISTS intermediary_code TEXT,
  ADD COLUMN IF NOT EXISTS ai_confidence     NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS missing_fields    TEXT[],
  ADD COLUMN IF NOT EXISTS notes             TEXT;

ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_policies_insurance_type ON public.policies(insurance_type);
CREATE INDEX IF NOT EXISTS idx_policies_customer_id ON public.policies(customer_id);
CREATE INDEX IF NOT EXISTS idx_policies_policy_number ON public.policies(policy_number);

-- ════════════════════════════════════════════════════════════════════
-- 3. LIFE POLICIES
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.life_policies (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id               UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  -- Basic
  plan_name               TEXT,
  plan_number             TEXT,
  life_assured            TEXT,
  proposer                TEXT,
  relationship            TEXT,
  -- Dates
  risk_commencement_date  DATE,
  premium_commencement_date DATE,
  maturity_date           DATE,
  premium_paying_term     INTEGER,
  age_at_entry            INTEGER,
  -- Money
  sum_assured             NUMERIC(15,2),
  death_benefit           NUMERIC(15,2),
  maturity_benefit        NUMERIC(15,2),
  guaranteed_benefit      NUMERIC(15,2),
  guaranteed_additions    NUMERIC(15,2),
  loyalty_addition        NUMERIC(15,2),
  bonus_type              TEXT,
  bonus_accumulated       NUMERIC(15,2),
  annual_premium          NUMERIC(12,2),
  modal_premium           NUMERIC(12,2),
  rider_premium           NUMERIC(12,2),
  -- Riders & Nominees (JSONB arrays)
  riders                  JSONB DEFAULT '[]'::JSONB,
  nominees                JSONB DEFAULT '[]'::JSONB,
  -- ULIP
  is_ulip                 BOOLEAN DEFAULT FALSE,
  fund_name               TEXT,
  fund_allocation         TEXT,
  fund_value              NUMERIC(15,2),
  units                   NUMERIC(15,6),
  nav                     NUMERIC(10,4),
  switching_allowed       BOOLEAN,
  lock_in_period          INTEGER, -- years
  -- Assignment / Loan
  is_assigned             BOOLEAN DEFAULT FALSE,
  assignee                TEXT,
  loan_status             TEXT,
  loan_value              NUMERIC(15,2),
  -- Medical
  medical_required        BOOLEAN,
  smoking_status          BOOLEAN,
  alcohol_status          BOOLEAN,
  existing_diseases       TEXT,
  -- Policy states
  revival_date            DATE,
  is_lapsed               BOOLEAN DEFAULT FALSE,
  is_paid_up              BOOLEAN DEFAULT FALSE,
  surrender_value         NUMERIC(15,2),
  gsv                     NUMERIC(15,2),
  ssv                     NUMERIC(15,2),
  free_look_end_date      DATE,
  -- Tax
  section_80c             BOOLEAN DEFAULT TRUE,
  section_10_10d          BOOLEAN DEFAULT TRUE,
  -- Timestamps
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_life_policies_policy_id ON public.life_policies(policy_id);
ALTER TABLE public.life_policies ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════
-- 4. HEALTH POLICIES
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.health_policies (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id               UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  -- Plan
  plan                    TEXT,
  policy_type             TEXT CHECK (policy_type IN ('individual','floater','group')),
  zone                    TEXT,
  renewal_number          TEXT,
  -- Coverage
  base_sum_insured        NUMERIC(12,2),
  total_sum_insured       NUMERIC(12,2),
  cumulative_bonus        NUMERIC(12,2),
  super_bonus             NUMERIC(12,2),
  restore_benefit         BOOLEAN DEFAULT FALSE,
  recharge_benefit        BOOLEAN DEFAULT FALSE,
  safeguard               BOOLEAN DEFAULT FALSE,
  inflation_shield        BOOLEAN DEFAULT FALSE,
  booster                 BOOLEAN DEFAULT FALSE,
  deductible              NUMERIC(12,2),
  co_pay_percent          NUMERIC(5,2),
  room_rent_limit         NUMERIC(12,2),
  icu_limit               NUMERIC(12,2),
  ayush_cover             BOOLEAN DEFAULT FALSE,
  -- Members (JSONB array)
  members                 JSONB DEFAULT '[]'::JSONB,
  -- Waiting periods
  initial_waiting_days    INTEGER,
  ped_waiting_months      INTEGER,
  disease_waiting_months  INTEGER,
  maternity_waiting_months INTEGER,
  -- Add-ons (JSONB)
  addons                  JSONB DEFAULT '{}'::JSONB,
  -- Claims
  claim_count             INTEGER DEFAULT 0,
  claim_amount            NUMERIC(15,2),
  ncb_percent             NUMERIC(5,2),
  ncb_lost                BOOLEAN DEFAULT FALSE,
  -- Nominee
  nominee_name            TEXT,
  nominee_relationship    TEXT,
  -- Network
  tpa                     TEXT,
  cashless_network        TEXT,
  customer_care           TEXT,
  -- Timestamps
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_health_policies_policy_id ON public.health_policies(policy_id);
ALTER TABLE public.health_policies ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════
-- 5. MOTOR POLICIES
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.motor_policies (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id               UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  -- Owner
  owner_name              TEXT,
  owner_mobile            TEXT,
  owner_address           TEXT,
  -- Vehicle
  registration_number     TEXT,
  engine_number           TEXT,
  chassis_number          TEXT,
  make                    TEXT,
  model                   TEXT,
  variant                 TEXT,
  fuel_type               TEXT CHECK (fuel_type IN ('petrol','diesel','electric','cng','hybrid')),
  cubic_capacity          INTEGER,
  seating_capacity        INTEGER,
  manufacturing_year      INTEGER,
  registration_year       INTEGER,
  rto                     TEXT,
  financier               TEXT,
  hypothecation           BOOLEAN DEFAULT FALSE,
  -- Policy
  policy_type             TEXT CHECK (policy_type IN ('comprehensive','third_party','own_damage')),
  idv                     NUMERIC(15,2),
  -- NCB
  previous_ncb_percent    NUMERIC(5,2),
  current_ncb_percent     NUMERIC(5,2),
  claims_history          TEXT,
  previous_insurer        TEXT,
  -- Covers (JSONB)
  covers                  JSONB DEFAULT '{}'::JSONB,
  -- Commercial vehicle
  is_commercial_vehicle   BOOLEAN DEFAULT FALSE,
  vehicle_type            TEXT,
  goods_carrying          BOOLEAN DEFAULT FALSE,
  passenger_carrying      BOOLEAN DEFAULT FALSE,
  permit_type             TEXT,
  gross_weight            NUMERIC(10,2),
  -- Timestamps
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_motor_policies_policy_id ON public.motor_policies(policy_id);
CREATE INDEX IF NOT EXISTS idx_motor_policies_reg_number ON public.motor_policies(registration_number);
ALTER TABLE public.motor_policies ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════
-- 6. COMMERCIAL POLICIES
-- ════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.commercial_policies (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_id               UUID NOT NULL REFERENCES public.policies(id) ON DELETE CASCADE,
  business_name           TEXT,
  proprietor              TEXT,
  business_gst            TEXT,
  business_address        TEXT,
  occupancy               TEXT,
  nature_of_business      TEXT,
  sum_insured             JSONB DEFAULT '{}'::JSONB,  -- { building, stock, machinery, furniture, electronics }
  covers                  JSONB DEFAULT '{}'::JSONB,  -- { cash, burglary, fire, flood, earthquake, ... }
  employee_count          INTEGER,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_policies_policy_id ON public.commercial_policies(policy_id);
ALTER TABLE public.commercial_policies ENABLE ROW LEVEL SECURITY;

-- ════════════════════════════════════════════════════════════════════
-- 7. POLICY DOCUMENTS — Add document_category
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.policy_documents
  ADD COLUMN IF NOT EXISTS document_category TEXT CHECK (
    document_category IN ('policy_pdf','health_card','rc_copy','invoice','proposal_form','kyc','nomination','other')
  ) DEFAULT 'policy_pdf';

-- ════════════════════════════════════════════════════════════════════
-- 8. RLS POLICIES — service_role writes, authenticated reads own
-- ════════════════════════════════════════════════════════════════════

-- Life policies
DROP POLICY IF EXISTS "life_service_all" ON public.life_policies;
CREATE POLICY "life_service_all" ON public.life_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Health policies
DROP POLICY IF EXISTS "health_service_all" ON public.health_policies;
CREATE POLICY "health_service_all" ON public.health_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Motor policies
DROP POLICY IF EXISTS "motor_service_all" ON public.motor_policies;
CREATE POLICY "motor_service_all" ON public.motor_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Commercial policies
DROP POLICY IF EXISTS "commercial_service_all" ON public.commercial_policies;
CREATE POLICY "commercial_service_all" ON public.commercial_policies
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════
-- 9. updated_at TRIGGERS
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['life_policies','health_policies','motor_policies','commercial_policies'] LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;
      CREATE TRIGGER trg_%I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
    ', tbl, tbl, tbl, tbl);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════
-- DONE
-- ════════════════════════════════════════════════════════════════════
-- Tables created: life_policies, health_policies, motor_policies, commercial_policies
-- Tables extended: customers, policies, policy_documents
-- RLS: enabled on all tables, service_role has full access
