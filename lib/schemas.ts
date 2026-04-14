import { z } from 'zod';

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Full name is required'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// Customer schemas
export const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  phone: z.string().optional().or(z.literal('')),
});

// Insurer schemas
export const insurerSchema = z.object({
  name: z.string().min(2, 'Insurer name is required'),
  contact_email: z.string().email().optional().or(z.literal('')),
  contact_phone: z.string().optional().or(z.literal('')),
});

// Policy schemas
export const policySchema = z.object({
  customer_id: z.string().uuid('Invalid customer'),
  insurer_id: z.string().uuid('Invalid insurer'),
  policy_number: z.string().min(1, 'Policy number is required'),
  policy_type: z.string().min(1, 'Policy type is required'),
  coverage_start: z.coerce.date(),
  coverage_end: z.coerce.date(),
  premium_amount: z.number().positive('Premium must be positive'),
  status: z.enum(['active', 'expired', 'cancelled', 'pending_renewal']),
  renewal_date: z.coerce.date().optional(),
}).refine((data) => data.coverage_end > data.coverage_start, {
  message: 'End date must be after start date',
  path: ['coverage_end'],
});

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

// Extraction result schema (mock OCR output)
export const extractionResultSchema = z.object({
  policy_number: z.string().optional(),
  policy_type: z.string().optional(),
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
  additional_fields: z.record(z.any()).optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type InsurerInput = z.infer<typeof insurerSchema>;
export type PolicyInput = z.infer<typeof policySchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type ExtractionResult = z.infer<typeof extractionResultSchema>;
