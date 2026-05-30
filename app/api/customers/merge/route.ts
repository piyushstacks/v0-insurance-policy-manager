import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { getUserTeam } from '@/services/team';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
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

    const team = await getUserTeam(user.id);
    if (team?.role === 'MEMBER') {
      return NextResponse.json({ error: 'Members cannot merge customers directly. Please request approval.' }, { status: 403 });
    }

    const { sourceCustomerId, targetCustomerId } = await request.json();
    if (!sourceCustomerId || !targetCustomerId) {
      return NextResponse.json({ error: 'Missing source or target customer ID' }, { status: 400 });
    }

    // 1. Verify ownership of both customers
    const { data: verifySource } = await supabaseAdmin!
      .from('customers')
      .select('id, name')
      .eq('id', sourceCustomerId)
      .eq('user_id', user.id)
      .single();

    const { data: verifyTarget } = await supabaseAdmin!
      .from('customers')
      .select('id, name')
      .eq('id', targetCustomerId)
      .eq('user_id', user.id)
      .single();

    if (!verifySource || !verifyTarget) {
      return NextResponse.json({ error: 'Customer not found or unauthorized' }, { status: 404 });
    }

    // 2. Re-assign all policies belonging to source customer to target customer
    const { error: updateError } = await supabaseAdmin!
      .from('policies')
      .update({ customer_id: targetCustomerId })
      .eq('customer_id', sourceCustomerId);

    if (updateError) {
      console.error('Re-assigning policies error:', updateError);
      throw new Error('Failed to re-assign customer policies');
    }

    // 3. Delete the source customer record
    const { error: deleteError } = await supabaseAdmin!
      .from('customers')
      .delete()
      .eq('id', sourceCustomerId);

    if (deleteError) {
      console.error('Deleting merged customer error:', deleteError);
      throw new Error('Failed to delete merged customer');
    }

    return NextResponse.json({
      success: true,
      message: `Successfully merged '${verifySource.name}' into '${verifyTarget.name}' and transferred all policies.`
    }, { status: 200 });

  } catch (error: any) {
    console.error('Customer merge API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to merge customers' }, { status: 500 });
  }
}
