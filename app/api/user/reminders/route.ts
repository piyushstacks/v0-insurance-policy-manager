import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();

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
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate structure
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload: enabled must be a boolean' }, { status: 400 });
    }

    // Ensure user_profile row exists first, then update
    const { error: upsertError } = await supabaseAdmin!
      .from('user_profiles')
      .upsert(
        { id: user.id, reminder_preferences: body },
        { onConflict: 'id', ignoreDuplicates: false }
      );

    if (upsertError) {
      console.error('[reminders] DB upsert error:', upsertError);
      return NextResponse.json(
        { error: `Database error: ${upsertError.message} (code: ${upsertError.code})` },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, updated: body });
  } catch (error: any) {
    console.error('[reminders] PATCH error:', error);
    return NextResponse.json({ error: error.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
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

    const { data } = await supabaseAdmin!
      .from('user_profiles')
      .select('reminder_preferences')
      .eq('id', user.id)
      .single();

    return NextResponse.json({ preferences: data?.reminder_preferences || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
