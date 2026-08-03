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
export async function generateExpiryReminders(maxLookaheadDays: number = 45) {
  try {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + maxLookaheadDays);

    const { data: policies, error: fetchError } = await supabaseAdmin!
      .from('policies')
      .select('id, expiry_date')
      .eq('status', 'active')
      .gte('expiry_date', new Date().toISOString().split('T')[0])
      .lte('expiry_date', futureDate.toISOString().split('T')[0]);

    if (fetchError) throw fetchError;

    // Fetch master agency profile for global preferences
    const { data: profile } = await supabaseAdmin!
      .from('user_profiles')
      .select('reminder_preferences')
      .limit(1)
      .maybeSingle();

    const prefs = profile?.reminder_preferences || { enabled: true, timing_days: [7, 15, 30], types: ['renewal'] };
    
    const policyIds = policies.map(p => p.id);
    const { data: existingRemindersData } = await supabaseAdmin!
      .from('reminders')
      .select('policy_id, reminder_type')
      .in('policy_id', policyIds);
    
    const existingSet = new Set(existingRemindersData?.map(r => `${r.policy_id}:${r.reminder_type}`) || []);

    const reminders: any[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (const policy of policies) {
      if (!policy.expiry_date) continue;
      
      if (!prefs.enabled || prefs.timing_days?.length === 0) continue;

      for (const daysBefore of prefs.timing_days) {
        if (daysBefore > maxLookaheadDays) continue;

        const reminderDate = new Date(policy.expiry_date);
        reminderDate.setDate(reminderDate.getDate() - daysBefore);
        const scheduledStr = reminderDate.toISOString().split('T')[0];

        // Skip if this specific reminder date is already in the past
        if (scheduledStr < todayStr) continue;

        const reminderType = prefs.types?.includes('renewal') ? `renewal_${daysBefore}days` : `premium_${daysBefore}days`;

        // Check if reminder exists from our pre-fetched set
        if (existingSet.has(`${policy.id}:${reminderType}`)) continue;

        reminders.push({
          policy_id: policy.id,
          scheduled_date: scheduledStr,
          reminder_type: reminderType,
          status: 'pending',
        });
      }
    }

    if (reminders.length === 0) {
      console.log('[v0] No new custom reminders to generate');
      return { created: 0 };
    }

    const { error: insertError } = await supabaseAdmin!
      .from('reminders')
      .insert(reminders);

    if (insertError) throw insertError;

    console.log(`[v0] Generated ${reminders.length} centralized expiry reminders`);
    return { created: reminders.length };
  } catch (error) {
    console.error('[v0] Failed to generate custom reminders:', error);
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
          expiry_date,
          customers (
            id,
            name,
            email,
            mobile
          ),
          insurers (
            name
          )
        )
      `
      )
      .eq('user_id', userId)
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
          expiry_date,
          customers (
            id,
            name,
            email,
            mobile
          ),
          insurers (
            name
          )
        )
      `,
        { count: 'exact' }
      )
      .eq('user_id', userId)
      .order('scheduled_date', { ascending: true })
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

import { invalidateDashboardCache } from './dashboard-cache';

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
      .update({ status: 'dismissed' })
      .eq('id', reminderId)
      .eq('user_id', userId);

    if (error) throw error;

    await invalidateDashboardCache(userId);
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
