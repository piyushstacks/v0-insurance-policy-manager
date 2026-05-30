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
    const policyId = params.id;
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

    // Fetch policy data with all necessary info
    const { data: policy, error } = await supabaseAdmin!
      .from('policies')
      .select(`
        id,
        policy_number,
        policy_type,
        expiry_date,
        premium_amount,
        extracted_data,
        insurers ( name ),
        customers (
          name,
          email,
          mobile
        )
      `)
      .eq('id', policyId)
      .eq('user_id', user.id)
      .single();

    if (error || !policy) {
      return NextResponse.json({ error: 'Policy not found' }, { status: 404 });
    }

    const customerDataRaw = policy.customers;
    const customerData = Array.isArray(customerDataRaw) ? customerDataRaw[0] : customerDataRaw;
    if (!customerData || !customerData.email) {
      return NextResponse.json({ error: 'Customer email is missing' }, { status: 400 });
    }

    // Validation for dummy/invalid data
    const email = customerData.email.toLowerCase();
    const isDummyEmail = email.includes('xxxx') || email.includes('dummy') || email.includes('example.com') || email.includes('upload.local');

    if (isDummyEmail) {
      return NextResponse.json({ 
        error: 'Invalid email address found (xxxx or dummy). Please update customer profile first.',
        missingField: 'email'
      }, { status: 400 });
    }

    // Fetch agency details
    const { data: profile } = await supabaseAdmin!
      .from('user_profiles')
      .select('full_name, mobile, teams(name)')
      .eq('id', user.id)
      .single();

    const agencyName = (profile?.teams as any)?.name || 'Apex Solutions';
    const agencyContact = profile?.mobile || user.email || '';

    // Extract AI Insights / Highlights
    const extracted = policy.extracted_data || {};
    const insights: string[] = [];
    
    if (extracted.sum_assured) {
      const sa = extracted.sum_assured;
      const formattedSA = sa >= 10000000 ? (sa / 10000000).toFixed(2) + ' Cr' : sa >= 100000 ? (sa / 100000).toFixed(2) + ' Lac' : sa.toLocaleString('en-IN');
      insights.push(`Sum Assured: ₹${formattedSA}`);
    }
    
    if (extracted.is_floater !== undefined) {
      insights.push(extracted.is_floater ? 'Floater Policy' : 'Individual Policy');
    } else if (policy.policy_type?.toLowerCase().includes('floater')) {
      insights.push('Floater Policy');
    }

    if (extracted.plan_name) insights.push(`Plan: ${extracted.plan_name}`);
    if (extracted.vehicle_number) insights.push(`Vehicle: ${extracted.vehicle_number}`);
    if (extracted.nominee_name) insights.push(`Nominee: ${extracted.nominee_name}`);

    // Send the email
    const emailParams = reminderEmail({
      customerName: customerData.name || 'Customer',
      policyNumber: policy.policy_number,
      policyCategory: (policy.policy_type || 'Insurance').split('|')[0]?.trim(),
      insurerName: (policy.insurers as any)?.name || '',
      policyInsights: insights,
      dueDate: policy.expiry_date,
      reminderType: 'renewal', // Generic for manual send
      premiumAmount: policy.premium_amount,
      recipientEmail: customerData.email,
      agencyName,
      agencyContact
    });

    const result = await sendEmail(emailParams);

    if (result.success) {
      return NextResponse.json({ success: true, message: 'Ad-hoc reminder sent successfully' });
    } else {
      return NextResponse.json({ error: 'Failed to send email. Please check SMTP settings.' }, { status: 500 });
    }

  } catch (error: any) {
    console.error('[Manual Send Policy] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
