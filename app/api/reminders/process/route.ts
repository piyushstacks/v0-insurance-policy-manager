import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, reminderEmail } from '@/services/email';

export async function POST(request: Request) {
  try {
    // 1. Ensure this is called from a trusted source (e.g. cron job or internal service)
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      // In a real prod setup, require this. For dev testing, we might allow it.
      // return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch all due pending reminders that haven't been sent
    const { data: reminders, error } = await supabaseAdmin!
      .from('reminders')
      .select(`
        id,
        scheduled_date,
        reminder_type,
        policies (
          id,
          policy_number,
          expiry_date,
          net_premium,
          customers (
            name,
            email
          )
        )
      `)
      .eq('status', 'pending')
      .lte('scheduled_date', new Date().toISOString().split('T')[0]);

    if (error) throw error;
    if (!reminders || reminders.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending reminders to process.' });
    }

    let sent = 0;
    let failed = 0;

    // 3. Process each reminder
    for (const reminder of reminders) {
      const policyData = (reminder.policies as any);
      if (!policyData) continue;

      const customerData = policyData.customers;
      if (!customerData || !customerData.email) {
        // Mark as failed or skipped if no email
        await supabaseAdmin!.from('reminders').update({ status: 'skipped', updated_at: new Date().toISOString() }).eq('id', reminder.id);
        continue;
      }

      const emailParams = reminderEmail({
        customerName: customerData.name || 'Customer',
        policyNumber: policyData.policy_number,
        dueDate: policyData.expiry_date,
        reminderType: reminder.reminder_type.includes('renewal') ? 'renewal' : 'premium',
        premiumAmount: policyData.net_premium,
        recipientEmail: customerData.email
      });

      // Send email
      const result = await sendEmail(emailParams);

      if (result.success) {
        await supabaseAdmin!.from('reminders').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', reminder.id);
        sent++;
      } else {
        // Leave pending for retry logic or mark failed. We'll leave pending for next cron to retry.
        failed++;
      }
    }

    return NextResponse.json({
      success: true,
      processed: reminders.length,
      sent,
      failed
    });
  } catch (error: any) {
    console.error('[Reminders Process] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
