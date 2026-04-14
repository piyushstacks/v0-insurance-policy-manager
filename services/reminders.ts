/**
 * Reminders Service
 * Creates, manages, and sends reminders for policy renewals and payments
 */

import { supabaseAdmin, supabase } from '@/lib/supabase';
import type { Reminder } from '@/lib/types';

/**
 * Generate reminders for policies expiring soon
 * Call this daily via cron job
 */
export async function generateExpiryReminders(daysAhead: number = 30) {
  try {
    // Find active policies expiring within the timeframe
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const { data: expiringPolicies, error: fetchError } = await supabaseAdmin!
      .from('policies')
      .select('id, coverage_end')
      .eq('status', 'active')
      .gte('coverage_end', new Date().toISOString().split('T')[0])
      .lte('coverage_end', futureDate.toISOString().split('T')[0]);

    if (fetchError) throw fetchError;

    const reminders: any[] = [];

    // Create reminder for each expiring policy (if not already created)
    for (const policy of expiringPolicies) {
      const reminderDate = new Date(policy.coverage_end);
      reminderDate.setDate(reminderDate.getDate() - 7); // 7 days before expiry

      // Check if reminder already exists
      const { data: existing } = await supabaseAdmin!
        .from('reminders')
        .select('id')
        .eq('policy_id', policy.id)
        .eq('reminder_type', 'renewal_7days')
        .eq('status', 'pending')
        .single();

      if (existing) continue; // Reminder already exists

      reminders.push({
        policy_id: policy.id,
        scheduled_date: reminderDate.toISOString().split('T')[0],
        reminder_type: 'renewal_7days',
        status: 'pending',
      });
    }

    if (reminders.length === 0) {
      console.log('[v0] No new reminders to generate');
      return { created: 0 };
    }

    // Batch insert reminders
    const { error: insertError } = await supabaseAdmin!
      .from('reminders')
      .insert(reminders);

    if (insertError) throw insertError;

    console.log(`[v0] Generated ${reminders.length} expiry reminders`);
    return { created: reminders.length };
  } catch (error) {
    console.error('[v0] Failed to generate reminders:', error);
    throw error;
  }
}

/**
 * Get pending reminders for a user
 */
export async function getPendingReminders(userId: string) {
  try {
    const { data: reminders, error } = await supabaseAdmin!
      .from('reminders')
      .select(
        `
        id,
        scheduled_date,
        reminder_type,
        status,
        policies (
          id,
          policy_number,
          policy_type,
          coverage_end,
          customers (
            name
          ),
          insurers (
            name
          )
        )
      `
      )
      .eq('status', 'pending')
      .lte('scheduled_date', new Date().toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true });

    if (error) throw error;

    return reminders || [];
  } catch (error) {
    console.error('[v0] Failed to fetch reminders:', error);
    throw error;
  }
}

/**
 * Get all reminders for a user (paginated)
 */
export async function getReminders(userId: string, page = 1, pageSize = 20) {
  try {
    const { data: reminders, error, count } = await supabaseAdmin!
      .from('reminders')
      .select(
        `
        id,
        scheduled_date,
        reminder_type,
        status,
        policies (
          id,
          policy_number,
          policy_type,
          coverage_end
        )
      `,
        { count: 'exact' }
      )
      .order('scheduled_date', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    if (error) throw error;

    return {
      data: reminders || [],
      total: count || 0,
      page,
      pageSize,
    };
  } catch (error) {
    console.error('[v0] Failed to fetch reminders:', error);
    throw error;
  }
}

/**
 * Dismiss a reminder
 */
export async function dismissReminder(reminderId: string, userId: string) {
  try {
    const { data: reminder } = await supabaseAdmin!
      .from('reminders')
      .select('id')
      .eq('id', reminderId)
      .single();

    if (!reminder) throw new Error('Reminder not found');

    const { error } = await supabaseAdmin!
      .from('reminders')
      .update({ status: 'skipped' })
      .eq('id', reminderId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('[v0] Failed to dismiss reminder:', error);
    throw error;
  }
}

/**
 * Mark reminder as sent (after email notification)
 */
export async function markReminderSent(reminderId: string) {
  try {
    const { error } = await supabaseAdmin!
      .from('reminders')
      .update({ status: 'sent' })
      .eq('id', reminderId);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('[v0] Failed to mark reminder as sent:', error);
    throw error;
  }
}

/**
 * Bulk generate reminders for all users
 * Call daily via cron job
 */
export async function generateAllReminders() {
  try {
    const { created } = await generateExpiryReminders(30);

    console.log(`[v0] Reminder generation completed: ${created} new reminders`);

    return { success: true, created };
  } catch (error) {
    console.error('[v0] Bulk reminder generation failed:', error);
    throw error;
  }
}

/**
 * Check if a reminder needs action
 * Returns true if reminder date has passed and is still pending
 */
export function isReminderDue(scheduledDate: string): boolean {
  const reminder = new Date(scheduledDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  reminder.setHours(0, 0, 0, 0);

  return reminder <= today;
}

/**
 * Format days until reminder
 */
export function daysUntilReminder(scheduledDate: string): number {
  const reminder = new Date(scheduledDate);
  const today = new Date();
  
  reminder.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = reminder.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
}
