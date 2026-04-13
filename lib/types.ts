// Database Types - Match Supabase schema
export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Insurer {
  id: string;
  user_id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface Policy {
  id: string;
  user_id: string;
  customer_id: string;
  insurer_id: string;
  policy_number: string;
  policy_type: string;
  coverage_start: string;
  coverage_end: string;
  premium_amount: number;
  status: 'active' | 'expired' | 'cancelled' | 'pending_renewal';
  renewal_date?: string;
  created_at: string;
  updated_at: string;
}

export interface PolicyDocument {
  id: string;
  policy_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
  extraction_job_id?: string;
}

export interface ExtractionJob {
  id: string;
  user_id: string;
  document_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  extracted_data?: {
    policy_number?: string;
    policy_type?: string;
    coverage_start?: string;
    coverage_end?: string;
    premium_amount?: number;
    [key: string]: any;
  };
  error_message?: string;
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  user_id: string;
  policy_id: string;
  reminder_date: string;
  reminder_type: 'renewal' | 'payment' | 'review' | 'expiry';
  status: 'pending' | 'sent' | 'dismissed';
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  changes?: Record<string, any>;
  created_at: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  page_size: number;
}
