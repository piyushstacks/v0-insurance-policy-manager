import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll() {}
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { customerIds } = body;
    
    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: 'No customer IDs provided' }, { status: 400 });
    }

    if (!supabaseAdmin) throw new Error('Supabase admin undefined');

    // Remove customers
    const { error: custError } = await supabaseAdmin
      .from('customers')
      .delete()
      .in('id', customerIds);

    if (custError) {
       // if we hit foreign key constraint, we can throw beautiful error
       if (custError.code === '23503') {
           return NextResponse.json({ error: 'Cannot delete customer because they have active policies attached. Please remove their policies first.' }, { status: 400 });
       }
       throw custError;
    }

    return NextResponse.json({ success: true, message: `Deleted ${customerIds.length} customers securely.` }, { status: 200 });

  } catch (error: any) {
    console.error('[v0] Bulk Delete Customers Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to bulk delete customers' }, { status: 500 });
  }
}
