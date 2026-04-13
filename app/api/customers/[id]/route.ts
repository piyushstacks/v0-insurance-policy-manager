import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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
