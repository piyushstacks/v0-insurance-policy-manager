import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { customerSchema } from '@/lib/schemas';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const { id } = params;

    const { data: customer, error } = await supabaseAdmin!
      .from('customers')
      .select(`
         id,
         name,
         email,
         mobile,
         address,
         created_at,
         policies (
           id,
           policy_number,
           policy_type,
           start_date,
           expiry_date,
           premium_amount,
           status,
           insurer:insurers(name)
         )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!customer) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

    return NextResponse.json({ data: customer }, { status: 200 });
  } catch (error) {
    console.error('API Error /customers/[id]:', error);
    return NextResponse.json({ error: 'Failed to fetch details' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const body = await request.json();

    // Validate fields before DB write
    const parsed = customerSchema.partial().safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.errors.map(e => e.message).join(', ');
      return NextResponse.json({ error: errors }, { status: 400 });
    }

    const { data: updated, error } = await supabaseAdmin!
      .from('customers')
      .update({
        name: parsed.data.name,
        email: parsed.data.email || null,
        mobile: parsed.data.mobile || parsed.data.phone || null,
        address: parsed.data.address || null,
      })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

