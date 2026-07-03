import { z } from 'zod';

// ─── REUSABLE VALIDATORS ───────────────────────────────────────────
export const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const emailField = z
  .string()
  .trim()
  .email('Invalid email format')
  .refine((val) => emailRegex.test(val), { message: 'Email must have a valid domain (e.g. .com, .in)' });

const optionalEmail = z
  .string()
  .trim()
  .optional()
  .or(z.literal(''))
  .refine((val) => !val || emailRegex.test(val), { message: 'Invalid email domain' });

const phoneRegex = /^(?:\+91[\s-]?)?[6-9]\d{9}$|^$/;
const optionalPhone = z
  .string()
  .trim()
  .refine(
    (v) => v === '' || phoneRegex.test(v.replace(/\s/g, '')),
    'Enter a valid 10-digit Indian mobile number'
  )
  .optional()
  .or(z.literal(''));

// ─── AUTH ────────────────────────────────────────────────────────
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Full name is required'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// ─── CUSTOMER ────────────────────────────────────────────────────
export const customerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  email: optionalEmail,
  phone: optionalPhone,
  mobile: optionalPhone,
  address: z.string().trim().optional().or(z.literal('')),
  dob: z.string().optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional().nullable(),
  pan: z.string().optional().nullable(),
  aadhaar: z.string().optional().nullable(),
  ckyc_number: z.string().optional().nullable(),
  eia_number: z.string().optional().nullable(),
  gst_number: z.string().optional().nullable(),
  occupation: z.string().optional().nullable(),
  company_customer_id: z.string().optional().nullable(),
});

// ─── INSURER ─────────────────────────────────────────────────────
export const insurerSchema = z.object({
  name: z.string().trim().min(2, 'Insurer name is required'),
  contact_email: optionalEmail,
  contact_phone: optionalPhone,
});

// ─── POLICY ──────────────────────────────────────────────────────
const policyBaseSchema = z.object({
  customer_id: z.string().uuid('Invalid customer'),
  insurer_id: z.string().uuid('Invalid insurer'),
  policy_number: z.string().min(1, 'Policy number is required'),
  policy_type: z.string().min(1, 'Policy type is required'),
  coverage_start: z.coerce.date(),
  coverage_end: z.coerce.date(),
  premium_amount: z.number().positive('Premium must be positive'),
  status: z.enum(['active', 'expired', 'cancelled', 'pending_renewal', 'lapsed', 'matured', 'surrendered']),
  renewal_date: z.coerce.date().optional(),
  // Extended common fields
  proposal_number: z.string().optional().nullable(),
  issue_date: z.coerce.date().optional().nullable(),
  is_renewal: z.boolean().optional().nullable(),
  premium_frequency: z.enum(['annual', 'half-yearly', 'quarterly', 'monthly', 'single']).optional().nullable(),
  gst_amount: z.number().optional().nullable(),
  total_premium: z.number().optional().nullable(),
  payment_mode: z.enum(['cheque', 'online', 'cash', 'ecs', 'nach']).optional().nullable(),
  payment_date: z.coerce.date().optional().nullable(),
  agent_name: z.string().optional().nullable(),
  agent_code: z.string().optional().nullable(),
  branch: z.string().optional().nullable(),
  intermediary_code: z.string().optional().nullable(),
  ai_confidence: z.number().min(0).max(1).optional().nullable(),
  missing_fields: z.array(z.string()).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const policySchema = policyBaseSchema.refine(
  (data) => data.coverage_end > data.coverage_start,
  { message: 'End date must be after start date', path: ['coverage_end'] }
);
export const policyUpdateSchema = policyBaseSchema.partial();

// ─── DOCUMENT ────────────────────────────────────────────────────
export const documentUploadSchema = z.object({
  policy_id: z.string().uuid('Invalid policy'),
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File must be less than 10MB')
    .refine(
      (file) => ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type),
      'File must be PDF, JPG, or PNG'
    ),
  document_category: z.enum([
    'policy_pdf', 'health_card', 'rc_copy', 'invoice',
    'proposal_form', 'kyc', 'nomination', 'other'
  ]).optional(),
});

// ─── EXTRACTION RESULT (DISCRIMINATED UNION) ──────────────────────

/** Returned when the document is not a final policy — do not save */
export const extractionRejectedSchema = z.object({
  store: z.literal(false),
  reason: z.string(),
});

/** Life insurance detail fields */
const lifeSchema = z.object({
  plan_name: z.string().nullable().optional(),
  plan_number: z.string().nullable().optional(),
  life_assured: z.string().nullable().optional(),
  proposer: z.string().nullable().optional(),
  relationship: z.string().nullable().optional(),
  risk_commencement_date: z.string().nullable().optional(),
  premium_commencement_date: z.string().nullable().optional(),
  maturity_date: z.string().nullable().optional(),
  premium_paying_term: z.number().nullable().optional(),
  age_at_entry: z.number().nullable().optional(),
  sum_assured: z.number().nullable().optional(),
  death_benefit: z.number().nullable().optional(),
  maturity_benefit: z.number().nullable().optional(),
  guaranteed_benefit: z.number().nullable().optional(),
  guaranteed_additions: z.number().nullable().optional(),
  loyalty_addition: z.number().nullable().optional(),
  bonus_type: z.string().nullable().optional(),
  bonus_accumulated: z.number().nullable().optional(),
  annual_premium: z.number().nullable().optional(),
  modal_premium: z.number().nullable().optional(),
  rider_premium: z.number().nullable().optional(),
  riders: z.array(z.object({
    type: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    sum_assured: z.number().nullable().optional(),
    premium: z.number().nullable().optional(),
    term: z.number().nullable().optional(),
  })).optional().nullable(),
  nominees: z.array(z.object({
    name: z.string().nullable().optional(),
    dob: z.string().nullable().optional(),
    relationship: z.string().nullable().optional(),
    share_percent: z.number().nullable().optional(),
    appointee: z.string().nullable().optional(),
  })).optional().nullable(),
  is_ulip: z.boolean().optional().nullable(),
  fund_name: z.string().nullable().optional(),
  fund_allocation: z.string().nullable().optional(),
  fund_value: z.number().nullable().optional(),
  units: z.number().nullable().optional(),
  nav: z.number().nullable().optional(),
  switching_allowed: z.boolean().nullable().optional(),
  lock_in_period: z.number().nullable().optional(),
  is_assigned: z.boolean().optional().nullable(),
  assignee: z.string().nullable().optional(),
  loan_status: z.string().nullable().optional(),
  medical_required: z.boolean().nullable().optional(),
  smoking_status: z.boolean().nullable().optional(),
  alcohol_status: z.boolean().nullable().optional(),
  existing_diseases: z.string().nullable().optional(),
  revival_date: z.string().nullable().optional(),
  is_lapsed: z.boolean().optional().nullable(),
  is_paid_up: z.boolean().optional().nullable(),
  surrender_value: z.number().nullable().optional(),
  gsv: z.number().nullable().optional(),
  ssv: z.number().nullable().optional(),
  loan_value: z.number().nullable().optional(),
  free_look_end_date: z.string().nullable().optional(),
  section_80c: z.boolean().optional().nullable(),
  section_10_10d: z.boolean().optional().nullable(),
});

/** Health insurance detail fields */
const healthSchema = z.object({
  plan: z.string().nullable().optional(),
  policy_type: z.enum(['individual', 'floater', 'group']).nullable().optional(),
  zone: z.string().nullable().optional(),
  renewal_number: z.string().nullable().optional(),
  base_sum_insured: z.number().nullable().optional(),
  total_sum_insured: z.number().nullable().optional(),
  cumulative_bonus: z.number().nullable().optional(),
  super_bonus: z.number().nullable().optional(),
  restore_benefit: z.boolean().optional().nullable(),
  recharge_benefit: z.boolean().optional().nullable(),
  safeguard: z.boolean().optional().nullable(),
  inflation_shield: z.boolean().optional().nullable(),
  booster: z.boolean().optional().nullable(),
  deductible: z.number().nullable().optional(),
  co_pay_percent: z.number().nullable().optional(),
  room_rent_limit: z.number().nullable().optional(),
  icu_limit: z.number().nullable().optional(),
  ayush_cover: z.boolean().optional().nullable(),
  members: z.array(z.object({
    name: z.string().nullable().optional(),
    dob: z.string().nullable().optional(),
    gender: z.string().nullable().optional(),
    age: z.number().nullable().optional(),
    relationship: z.string().nullable().optional(),
    member_id: z.string().nullable().optional(),
    ped: z.string().nullable().optional(),
    ped_since: z.string().nullable().optional(),
    covered_since: z.string().nullable().optional(),
  })).optional().nullable(),
  initial_waiting_days: z.number().nullable().optional(),
  ped_waiting_months: z.number().nullable().optional(),
  disease_waiting_months: z.number().nullable().optional(),
  maternity_waiting_months: z.number().nullable().optional(),
  addons: z.object({
    hospital_cash: z.boolean().optional(),
    opd: z.boolean().optional(),
    air_ambulance: z.boolean().optional(),
    personal_accident: z.boolean().optional(),
    critical_illness: z.boolean().optional(),
    wellness: z.boolean().optional(),
    health_checkup: z.boolean().optional(),
    unlimited_consultation: z.boolean().optional(),
  }).optional().nullable(),
  claim_count: z.number().nullable().optional(),
  claim_amount: z.number().nullable().optional(),
  ncb_percent: z.number().nullable().optional(),
  ncb_lost: z.boolean().optional().nullable(),
  nominee_name: z.string().nullable().optional(),
  nominee_relationship: z.string().nullable().optional(),
  tpa: z.string().nullable().optional(),
  cashless_network: z.string().nullable().optional(),
  customer_care: z.string().nullable().optional(),
});

/** Motor insurance detail fields */
const motorSchema = z.object({
  owner_name: z.string().nullable().optional(),
  owner_mobile: z.string().nullable().optional(),
  owner_address: z.string().nullable().optional(),
  registration_number: z.string().nullable().optional(),
  engine_number: z.string().nullable().optional(),
  chassis_number: z.string().nullable().optional(),
  make: z.string().nullable().optional(),
  model: z.string().nullable().optional(),
  variant: z.string().nullable().optional(),
  fuel_type: z.enum(['petrol', 'diesel', 'electric', 'cng', 'hybrid']).nullable().optional(),
  cubic_capacity: z.number().nullable().optional(),
  seating_capacity: z.number().nullable().optional(),
  manufacturing_year: z.number().nullable().optional(),
  registration_year: z.number().nullable().optional(),
  rto: z.string().nullable().optional(),
  financier: z.string().nullable().optional(),
  hypothecation: z.boolean().optional().nullable(),
  policy_type: z.enum(['comprehensive', 'third_party', 'own_damage']).nullable().optional(),
  idv: z.number().nullable().optional(),
  previous_ncb_percent: z.number().nullable().optional(),
  current_ncb_percent: z.number().nullable().optional(),
  claims_history: z.string().nullable().optional(),
  previous_insurer: z.string().nullable().optional(),
  covers: z.object({
    own_damage: z.boolean().optional(),
    third_party: z.boolean().optional(),
    personal_accident: z.boolean().optional(),
    zero_dep: z.boolean().optional(),
    engine_protect: z.boolean().optional(),
    rsa: z.boolean().optional(),
    consumables: z.boolean().optional(),
    key_protect: z.boolean().optional(),
    return_to_invoice: z.boolean().optional(),
    tyre_protect: z.boolean().optional(),
    invoice_protect: z.boolean().optional(),
    emi_protect: z.boolean().optional(),
    passenger_cover: z.boolean().optional(),
    accessories_cover: z.boolean().optional(),
  }).optional().nullable(),
  is_commercial_vehicle: z.boolean().optional().nullable(),
  vehicle_type: z.string().nullable().optional(),
  goods_carrying: z.boolean().optional().nullable(),
  passenger_carrying: z.boolean().optional().nullable(),
  permit_type: z.string().nullable().optional(),
  gross_weight: z.number().nullable().optional(),
});

/** Commercial / Fire / Shop insurance detail fields */
const commercialSchema = z.object({
  business_name: z.string().nullable().optional(),
  proprietor: z.string().nullable().optional(),
  business_gst: z.string().nullable().optional(),
  business_address: z.string().nullable().optional(),
  occupancy: z.string().nullable().optional(),
  nature_of_business: z.string().nullable().optional(),
  sum_insured: z.object({
    building: z.number().nullable().optional(),
    stock: z.number().nullable().optional(),
    machinery: z.number().nullable().optional(),
    furniture: z.number().nullable().optional(),
    electronics: z.number().nullable().optional(),
  }).optional().nullable(),
  covers: z.object({
    cash: z.boolean().optional(),
    burglary: z.boolean().optional(),
    fire: z.boolean().optional(),
    flood: z.boolean().optional(),
    earthquake: z.boolean().optional(),
    fidelity_guarantee: z.boolean().optional(),
    public_liability: z.boolean().optional(),
  }).optional().nullable(),
  employee_count: z.number().nullable().optional(),
});

/** Common extracted fields present on all insurance types */
const extractionCommonSchema = z.object({
  store: z.literal(true),
  insurance_type: z.enum(['life', 'health', 'motor', 'commercial', 'other']),
  company: z.string().nullable().optional(),
  product_name: z.string().nullable().optional(),
  policy_number: z.string().nullable().optional(),
  proposal_number: z.string().nullable().optional(),
  policy_status: z.string().nullable().optional(),
  is_renewal: z.boolean().nullable().optional(),
  issue_date: z.string().nullable().optional(),
  policy_start_date: z.string().nullable().optional(),
  policy_end_date: z.string().nullable().optional(),
  policy_term: z.number().nullable().optional(),
  premium_frequency: z.string().nullable().optional(),
  premium_amount: z.number().nullable().optional(),
  gst_amount: z.number().nullable().optional(),
  total_premium: z.number().nullable().optional(),
  payment_mode: z.string().nullable().optional(),
  payment_date: z.string().nullable().optional(),
  renewal_date: z.string().nullable().optional(),
  agent_name: z.string().nullable().optional(),
  agent_code: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  intermediary_code: z.string().nullable().optional(),
  // Customer
  customer_name: z.string().nullable().optional(),
  policy_holder_name: z.string().nullable().optional(),
  customer_dob: z.string().nullable().optional(),
  customer_gender: z.string().nullable().optional(),
  customer_mobile: z.string().nullable().optional(),
  customer_email: z.string().nullable().optional(),
  customer_address: z.string().nullable().optional(),
  customer_pan: z.string().nullable().optional(),
  customer_aadhaar: z.string().nullable().optional(),
  customer_ckyc: z.string().nullable().optional(),
  customer_eia: z.string().nullable().optional(),
  customer_gst: z.string().nullable().optional(),
  customer_occupation: z.string().nullable().optional(),
  company_customer_id: z.string().nullable().optional(),
  // Type-specific detail blocks (optional — only present for matching type)
  life: lifeSchema.optional().nullable(),
  health: healthSchema.optional().nullable(),
  motor: motorSchema.optional().nullable(),
  commercial: commercialSchema.optional().nullable(),
  // Metadata
  ai_confidence: z.number().nullable().optional(),
  missing_fields: z.array(z.string()).optional().nullable(),
  notes: z.string().nullable().optional(),
});

/** Full extraction result — either a valid policy or a rejection */
export const extractionResultSchema = z.union([
  extractionRejectedSchema,
  extractionCommonSchema,
]);

// ─── TEAM ────────────────────────────────────────────────────────
export const teamInviteSchema = z.object({
  email: emailField,
});

// ─── EXPORTS ─────────────────────────────────────────────────────
export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type InsurerInput = z.infer<typeof insurerSchema>;
export type PolicyInput = z.infer<typeof policySchema>;
export type PolicyUpdateInput = z.infer<typeof policyUpdateSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type ExtractionResultInput = ExtractionResult; // backwards compat alias
export type TeamInviteInput = z.infer<typeof teamInviteSchema>;

// Convenience type guards
export function isRejectedExtraction(r: ExtractionResult): r is z.infer<typeof extractionRejectedSchema> {
  return r.store === false;
}
export function isValidExtraction(r: ExtractionResult): r is z.infer<typeof extractionCommonSchema> {
  return r.store === true;
}

export type InsuranceType = 'life' | 'health' | 'motor' | 'commercial' | 'other';
export type LifeData = z.infer<typeof lifeSchema>;
export type HealthData = z.infer<typeof healthSchema>;
export type MotorData = z.infer<typeof motorSchema>;
export type CommercialData = z.infer<typeof commercialSchema>;
