import { z } from 'zod';

// ─── REUSABLE VALIDATORS ───────────────────────────────────────────
// Strict email: must have @ and a dot in the domain part
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
// Indian phone: 10-digit or with +91 prefix, or blank
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
});

// ─── INSURER ─────────────────────────────────────────────────────
export const insurerSchema = z.object({
  name: z.string().trim().min(2, 'Insurer name is required'),
  contact_email: optionalEmail,
  contact_phone: optionalPhone,
});

// Policy schemas
const policyBaseSchema = z.object({
  customer_id: z.string().uuid('Invalid customer'),
  insurer_id: z.string().uuid('Invalid insurer'),
  policy_number: z.string().min(1, 'Policy number is required'),
  policy_type: z.string().min(1, 'Policy type is required'),
  coverage_start: z.coerce.date(),
  coverage_end: z.coerce.date(),
  premium_amount: z.number().positive('Premium must be positive'),
  status: z.enum(['active', 'expired', 'cancelled', 'pending_renewal']),
  renewal_date: z.coerce.date().optional(),
});

// Full policy schema with cross-field validation (for creates)
export const policySchema = policyBaseSchema.refine((data) => data.coverage_end > data.coverage_start, {
  message: 'End date must be after start date',
  path: ['coverage_end'],
});

// Partial update schema (no .refine() — ZodEffects doesn't support .partial())
export const policyUpdateSchema = policyBaseSchema.partial();

// Document upload schema
export const documentUploadSchema = z.object({
  policy_id: z.string().uuid('Invalid policy'),
  file: z.instanceof(File)
    .refine((file) => file.size <= 10 * 1024 * 1024, 'File must be less than 10MB')
    .refine(
      (file) => ['application/pdf', 'image/jpeg', 'image/png'].includes(file.type),
      'File must be PDF, JPG, or PNG'
    ),
});

// Extraction result schema
export const extractionResultSchema = z.object({
  policy_number: z.string().optional(),
  policy_type: z.string().optional(),
  policy_category: z.string().optional(),
  policy_sub_category: z.string().optional(),
  coverage_start: z.string().optional(),
  coverage_end: z.string().optional(),
  premium_amount: z.number().optional(),
  insurer_name: z.string().optional(),
  customer_name: z.string().optional(),
  customer_email: z.string().optional().nullable(),
  customer_mobile: z.string().optional().nullable(),
  vehicle_number: z.string().optional().nullable(),
  nominee_name: z.string().optional().nullable(),
  health_ped: z.string().optional().nullable(),
  key_important_details: z.string().optional(),
  agent_notes: z.string().optional(),
  additional_fields: z.record(z.any()).optional(),
});

// ─── TEAM ────────────────────────────────────────────────────────
export const teamInviteSchema = z.object({
  email: emailField,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type InsurerInput = z.infer<typeof insurerSchema>;
export type PolicyInput = z.infer<typeof policySchema>;
export type PolicyUpdateInput = z.infer<typeof policyUpdateSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
export type TeamInviteInput = z.infer<typeof teamInviteSchema>;
