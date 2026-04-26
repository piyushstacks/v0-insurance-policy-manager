/**
 * Policies Service
 * CRUD operations and business logic for insurance policies
 */

import { supabaseAdmin, supabase } from '@/lib/supabase';
import type { Policy, PolicyDocument } from '@/lib/types';
import { PolicyInput } from '@/lib/schemas';

/**
 * Create a new policy
 */
export async function createPolicy(userId: string, data: PolicyInput) {
  try {
    const { data: policy, error } = await supabaseAdmin!
      .from('policies')
      .insert([
        {
          customer_id: data.customer_id,
          insurer_id: data.insurer_id,
          policy_number: data.policy_number,
          policy_type: data.policy_type,
          coverage_start: data.coverage_start.toISOString().split('T')[0],
          coverage_end: data.coverage_end.toISOString().split('T')[0],
          premium_amount: data.premium_amount,
          status: data.status,
          renewal_date: data.renewal_date
            ? data.renewal_date.toISOString().split('T')[0]
            : null,
        },
      ])
      .select('*')
      .single();

    if (error) throw error;

    // Log audit
    await auditLog(userId, 'CREATE', 'policies', policy.id, {
      policy_number: policy.policy_number,
    });

    return policy;
  } catch (error) {
    console.error('Failed to create policy:', error);
    throw error;
  }
}

/**
 * Get all policies for a user
 */
export async function getPolicies(
  userId: string,
  filters?: {
    status?: string;
    customerId?: string;
    insurerId?: string;
    search?: string;
  },
  page = 1,
  pageSize = 20
) {
  try {
    let query = supabaseAdmin!
      .from('policies')
      .select('*, customer:customers(name, email), insurer:insurers(name), documents:policy_documents(file_path, file_name)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.customerId) {
      query = query.eq('customer_id', filters.customerId);
    }
    if (filters?.insurerId) {
      query = query.eq('insurer_id', filters.insurerId);
    }
    if (filters?.search) {
      query = query.or(`policy_number.ilike.%${filters.search}%,policy_type.ilike.%${filters.search}%`);
    }

    const { data, error, count } = await query
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    return {
      data,
      total: count || 0,
      page,
      pageSize,
    };
  } catch (error) {
    console.error('Failed to fetch policies:', error);
    throw error;
  }
}

/**
 * Get single policy with documents and all extraction data
 */
export async function getPolicyWithDocuments(policyId: string, userId: string) {
  try {
    const { data: policy, error: policyError } = await supabaseAdmin!
      .from('policies')
      .select(`
        *,
        customer:customers(name, email, mobile),
        insurer:insurers(name, contact)
      `)
      .eq('id', policyId)
      .single();

    if (policyError || !policy) throw new Error('Policy not found');

    // Get documents with their extraction jobs
    let documents: any[] = [];
    try {
      const { data, error: docsError } = await supabaseAdmin!
        .from('policy_documents')
        .select(`
          id,
          policy_id,
          file_name,
          file_path,
          file_type,
          upload_date,
          created_at,
          extraction_status,
          raw_ocr_text,
          extraction_jobs!extraction_jobs_document_id_fkey (
            id,
            status,
            extracted_data,
            error_message,
            completed_at
          )
        `)
        .eq('policy_id', policyId)
        .order('created_at', { ascending: false });

      if (docsError) {
        console.warn('[policies] extraction_jobs join failed, falling back to docs-only:', docsError.message);
        // Fallback: documents without the join
        const { data: fallbackData, error: fallbackErr } = await supabaseAdmin!
          .from('policy_documents')
          .select('*')
          .eq('policy_id', policyId)
          .order('created_at', { ascending: false });
        if (fallbackErr) console.error('[policies] fallback doc query also failed:', fallbackErr.message);
        documents = fallbackData || [];
      } else {
        documents = data || [];
      }
    } catch (e) {
      console.warn('[policies] Unexpected error fetching documents:', e);
      const { data } = await supabaseAdmin!
        .from('policy_documents')
        .select('*')
        .eq('policy_id', policyId)
        .order('created_at', { ascending: false });
      documents = data || [];
    }
    console.log(`[policies] Found ${documents.length} documents for policy ${policyId}`);

    // Aggregate all extracted data from all documents and extraction jobs
    const allExtractionData: Record<string, any> = {};
    if (documents && documents.length > 0) {
      for (const doc of documents) {
        const jobs = (doc.extraction_jobs as any[]) || [];
        for (const job of jobs) {
          if (job.extracted_data) {
            // Merge extraction data, preferring non-null values
            Object.entries(job.extracted_data).forEach(([key, value]) => {
              if (value !== null && value !== undefined && value !== '') {
                allExtractionData[key] = value;
              }
            });
          }
        }
      }
    }

    return {
      policy,
      documents: documents ?? [],
      extractedData: allExtractionData,
    };
  } catch (error) {
    console.error('Failed to fetch policy details:', error);
    throw error;
  }
}

/**
 * Update a policy
 */
export async function updatePolicy(
  policyId: string,
  userId: string,
  data: Partial<PolicyInput>
) {
  try {
    // Verify ownership
    const { data: existing } = await supabaseAdmin!
      .from('policies')
      .select('*')
      .eq('id', policyId)
      .single();

    if (!existing) throw new Error('Policy not found');

    const updateData: any = {};
    if (data.customer_id !== undefined) updateData.customer_id = data.customer_id;
    if (data.insurer_id !== undefined) updateData.insurer_id = data.insurer_id;
    if (data.policy_number !== undefined) updateData.policy_number = data.policy_number;
    if (data.policy_type !== undefined) updateData.policy_type = data.policy_type;
    if (data.coverage_start !== undefined)
      updateData.coverage_start = data.coverage_start.toISOString().split('T')[0];
    if (data.coverage_end !== undefined)
      updateData.coverage_end = data.coverage_end.toISOString().split('T')[0];
    if (data.premium_amount !== undefined) updateData.premium_amount = data.premium_amount;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.renewal_date !== undefined)
      updateData.renewal_date = data.renewal_date
        ? data.renewal_date.toISOString().split('T')[0]
        : null;

    const { data: updated, error } = await supabaseAdmin!
      .from('policies')
      .update(updateData)
      .eq('id', policyId)
      .select('*')
      .single();

    if (error) throw error;

    // Log audit
    await auditLog(userId, 'UPDATE', 'policies', policyId, updateData);

    return updated;
  } catch (error) {
    console.error('Failed to update policy:', error);
    throw error;
  }
}

/**
 * Delete a policy and its documents
 */
export async function deletePolicy(policyId: string, userId: string) {
  try {
    // Verify ownership
    const { data: policy } = await supabaseAdmin!
      .from('policies')
      .select('*')
      .eq('id', policyId)
      .single();

    if (!policy) throw new Error('Policy not found');

    // Delete associated documents and extraction jobs
    const { data: documents } = await supabaseAdmin!
      .from('policy_documents')
      .select('id')
      .eq('policy_id', policyId);

    if (documents && documents.length > 0) {
      const docIds = documents.map((d) => d.id);

      // Delete extraction jobs
      await supabaseAdmin!
        .from('extraction_jobs')
        .delete()
        .in('document_id', docIds);

      // Delete documents
      await supabaseAdmin!
        .from('policy_documents')
        .delete()
        .in('id', docIds);
    }

    // Delete policy
    const { error } = await supabaseAdmin!
      .from('policies')
      .delete()
      .eq('id', policyId);

    if (error) throw error;

    // Log audit
    await auditLog(userId, 'DELETE', 'policies', policyId, {
      policy_number: policy.policy_number,
    });

    return { success: true };
  } catch (error) {
    console.error('Failed to delete policy:', error);
    throw error;
  }
}

/**
 * Get customer policies grouped by financial year and category
 */
export async function getCustomerPoliciesByYearAndCategory(customerId: string) {
  try {
    const { data: policies, error } = await supabaseAdmin!
      .from('policies')
      .select(`
        *,
        insurer:insurers(name)
      `)
      .eq('customer_id', customerId)
      .order('start_date', { ascending: false });

    if (error) throw error;

    // Group policies by financial year (Apr-Mar) and category
    interface GroupedPolicies {
      [year: string]: {
        [category: string]: typeof policies;
      };
    }
    
    const grouped: GroupedPolicies = {};

    policies?.forEach((policy) => {
      // Calculate financial year (Apr to Mar)
      const date = new Date(policy.start_date);
      let financialYear = date.getFullYear();
      if (date.getMonth() < 3) {
        // Jan, Feb, Mar belong to previous financial year
        financialYear -= 1;
      }
      const fyStart = financialYear;
      const fyEnd = financialYear + 1;
      const yearLabel = `${fyStart}-${fyEnd}`;

      // Extract category from policy_type
      const category = policy.policy_type?.split('|')[0]?.trim() || 'General';

      // Initialize year group if not exists
      if (!grouped[yearLabel]) {
        grouped[yearLabel] = {};
      }

      // Initialize category group if not exists
      if (!grouped[yearLabel][category]) {
        grouped[yearLabel][category] = [];
      }

      // Add policy to the appropriate group
      grouped[yearLabel][category].push(policy);
    });

    return grouped;
  } catch (error) {
    console.error('Failed to fetch customer policies by year and category:', error);
    throw error;
  }
}

/**
 * Get policies expiring soon
 */
export async function getPoliciesExpiringSoon(userId: string, daysAhead: number = 30) {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data, error } = await supabaseAdmin!
      .from('policies')
      .select('*')
      .eq('status', 'active')
      .gte('coverage_end', new Date().toISOString().split('T')[0])
      .lte('coverage_end', futureDate.toISOString().split('T')[0])
      .order('coverage_end', { ascending: true });

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('Failed to fetch expiring policies:', error);
    throw error;
  }
}

/**
 * Audit log helper
 */
async function auditLog(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  changes?: any
) {
  try {
    await supabaseAdmin!
      .from('audit_logs')
      .insert([
        {
          user_id: userId,
          action,
          entity_type: entityType,
          entity_id: entityId,
          changes,
        },
      ]);
  } catch (error) {
    console.warn('Failed to log audit:', error);
  }
}
