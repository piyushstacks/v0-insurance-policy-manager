import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { customerSchema } from '@/lib/schemas';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getTeamUserIds } from '@/services/team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    // Authenticate
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const teamUserIds = await getTeamUserIds(user.id);

    // Fetch customer details, policies, and policy documents
    // Note: removed related_customer_id and commission_rate from explicit select to avoid breaking if migration hasn't run
    const { data: customer, error } = await supabaseAdmin!
      .from('customers')
      .select(`
         *,
         policies (
           id,
           policy_number,
           policy_type,
           insurance_type,
           start_date,
           expiry_date,
           premium_amount,
           sum_insured,
           status,
           insurer:insurers(name),
           life_policies (sum_assured),
           policy_documents (id, file_name, file_path, created_at)
         )
      `)
      .eq('id', id)
      .in('user_id', teamUserIds)
      .single();

    if (error || !customer) {
      console.error('Customer fetch error:', error);
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    // Fetch family members (disabled until SQL migration for related_customer_id is run)
    const family: any[] = [];

    // Fetch activity logs
    const policyIds = customer.policies ? customer.policies.map((p: any) => p.id) : [];
    const { data: logs } = await supabaseAdmin!
      .from('audit_logs')
      .select('id, action, table_name, created_at, changes')
      .or(`and(table_name.eq.customers,record_id.eq.${id}),and(table_name.eq.policies,record_id.in.(${policyIds.length ? policyIds.join(',') : '00000000-0000-0000-0000-000000000000'}))`)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ 
      data: {
        ...customer,
        family_members: family || [],
        activity_logs: logs || []
      } 
    }, { status: 200 });
  } catch (error) {
    console.error('API Error /customers/[id]:', error);
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await request.json();

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {},
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const teamUserIds = await getTeamUserIds(user.id);

    // Verify ownership
    const { data: exists } = await supabaseAdmin!
      .from('customers')
      .select('id')
      .eq('id', params.id)
      .in('user_id', teamUserIds)
      .single();

    if (!exists) return NextResponse.json({ error: 'Not Found or unauthorized' }, { status: 404 });

    const parsed = customerSchema.partial().safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => e.message).join(', ');
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const updateData: any = {
      name: parsed.data.name,
      email: parsed.data.email || null,
      mobile: parsed.data.mobile || parsed.data.phone || null,
      address: parsed.data.address || null,
    };

    if (body.related_customer_id !== undefined) {
      updateData.related_customer_id = body.related_customer_id;
    }

    const { data: updated, error } = await supabaseAdmin!
      .from('customers')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
