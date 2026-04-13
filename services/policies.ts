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
  },
  page = 1,
  pageSize = 20
) {
  try {
    let query = supabaseAdmin!
      .from('policies')
      .select('*, customer:customers(name, email), insurer:insurers(name)')
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
 * Get single policy with documents
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

    // Get documents
    const { data: documents, error: docsError } = await supabaseAdmin!
      .from('policy_documents')
      .select('*')
      .eq('policy_id', policyId)
      .order('upload_date', { ascending: false });

    if (docsError) throw docsError;

    return {
      policy,
      documents: documents ?? [],
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
