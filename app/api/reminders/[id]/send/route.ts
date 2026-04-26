import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, reminderEmail } from '@/services/email';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const params = await props.params;
    const reminderId = params.id;
    const cookieStore = await cookies();
    
    // Auth check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch reminder data with all necessary info
    const { data: reminder, error } = await supabaseAdmin!
      .from('reminders')
      .select(`
        id,
        scheduled_date,
        reminder_type,
        status,
        policies (
          id,
          policy_number,
          expiry_date,
          premium_amount,
          customers (
            name,
            email,
            mobile
          )
        )
      `)
      .eq('id', reminderId)
      .single();

    if (error || !reminder) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    const policyData = (reminder.policies as any);
    const customerData = policyData?.customers;

    if (!customerData || !customerData.email) {
      return NextResponse.json({ error: 'Customer email is missing' }, { status: 400 });
    }

    // Validation for dummy/invalid data as requested
    const email = customerData.email.toLowerCase();
    const isDummyEmail = email.includes('xxxx') || email.includes('dummy') || email.includes('example.com') || email.includes('upload.local');
    const isDummyPhone = !customerData.mobile || customerData.mobile.length < 10 || customerData.mobile.includes('0000000000');

    if (isDummyEmail) {
      return NextResponse.json({ 
        error: 'Invalid email address found (xxxx or dummy). Please update customer profile first.',
        missingField: 'email'
      }, { status: 400 });
    }

    // Fetch agency details (from current user's team)
    const { data: profile } = await supabaseAdmin!
      .from('user_profiles')
      .select('full_name, mobile, teams(name)')
      .eq('id', user.id)
      .single();

    const agencyName = (profile?.teams as any)?.name || 'Apex Solutions';
    const agencyContact = profile?.mobile || user.email || '';

    // Send the email
    const emailParams = reminderEmail({
      customerName: customerData.name || 'Customer',
      policyNumber: policyData.policy_number,
      policyCategory: policyData.policy_type?.split('|')[0]?.trim() || 'Insurance',
      dueDate: policyData.expiry_date,
      reminderType: reminder.reminder_type.includes('renewal') ? 'renewal' : 'premium',
      premiumAmount: policyData.premium_amount,
      recipientEmail: customerData.email,
      agencyName,
      agencyContact
    });

    const result = await sendEmail(emailParams);

    if (result.success) {
      // Update status to sent
      await supabaseAdmin!
        .from('reminders')
        .update({ 
          status: 'sent', 
          updated_at: new Date().toISOString() 
        })
        .eq('id', reminderId);

      return NextResponse.json({ success: true, message: 'Reminder sent successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to send email. Please check SMTP settings.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Manual Send Reminder] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
