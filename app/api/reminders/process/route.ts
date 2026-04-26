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

    // 2. Fetch all due pending reminders that haven't been sent with policy and team details
    const { data: reminders, error } = await supabaseAdmin!
      .from('reminders')
      .select(`
        id,
        scheduled_date,
        reminder_type,
        policies (
          id,
          policy_number,
          policy_type,
          expiry_date,
          premium_amount,
          customers (
            name,
            email
          ),
          teams (
            name,
            email,
            phone
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
      const teamData = policyData.teams;
      
      if (!customerData || !customerData.email) {
        // Mark as skipped if no email
        await supabaseAdmin!.from('reminders').update({ status: 'skipped', updated_at: new Date().toISOString() }).eq('id', reminder.id);
        continue;
      }

      const emailParams = reminderEmail({
        customerName: customerData.name || 'Customer',
        policyNumber: policyData.policy_number,
        policyCategory: policyData.policy_type?.split('|')[0]?.trim() || 'Insurance',
        dueDate: policyData.expiry_date,
        reminderType: reminder.reminder_type.includes('renewal') ? 'renewal' : 'premium',
        premiumAmount: policyData.premium_amount,
        recipientEmail: customerData.email,
        agencyName: teamData?.name || 'Apex Solutions',
        agencyContact: teamData?.phone || teamData?.email || ''
      });

      // Send email
      const result = await sendEmail(emailParams);

      if (result.success) {
        await supabaseAdmin!.from('reminders').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', reminder.id);
        sent++;
      } else {
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
