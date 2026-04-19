/**
 * GET   /api/user/profile — Get current user profile
 * PATCH /api/user/profile — Update name / email (with OTP for email change)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { loginSchema } from '@/lib/schemas';

async function getUser(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {}
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin!
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return NextResponse.json({
    id: user.id,
    email: user.email,
    full_name: profile?.full_name || user.user_metadata?.full_name || '',
    role: profile?.role || 'MEMBER',
    team_id: profile?.team_id || null,
    avatar_url: profile?.avatar_url || null,
    created_at: user.created_at,
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { full_name, new_email, otp } = body as {
    full_name?: string;
    new_email?: string;
    otp?: string;
  };

  const updates: Record<string, any> = {};

  // Update name
  if (full_name !== undefined) {
    if (!full_name.trim()) return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 });
    updates.full_name = full_name.trim();

    const { error } = await supabaseAdmin!
      .from('user_profiles')
      .update({ full_name: full_name.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Also update auth metadata
    await supabaseAdmin!.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, full_name: full_name.trim() },
    });
  }

  // Update email (requires OTP verification)
  if (new_email !== undefined) {
    const emailCheck = loginSchema.pick({ email: true }).safeParse({ email: new_email });
    if (!emailCheck.success) {
      return NextResponse.json({ error: emailCheck.error.errors[0].message }, { status: 400 });
    }

    if (!otp) return NextResponse.json({ error: 'OTP required to change email. Request a code first.', requiresOTP: true }, { status: 400 });

    // Verify OTP
    const { verifyOTP } = await import('@/services/otp');
    const result = await verifyOTP(new_email, otp, 'email-change');
    if (!result.valid) return NextResponse.json({ error: result.error }, { status: 400 });

    // Update email in Supabase Auth
    const { error: emailError } = await supabaseAdmin!.auth.admin.updateUserById(user.id, {
      email: new_email,
    });
    if (emailError) return NextResponse.json({ error: emailError.message }, { status: 500 });

    updates.email = new_email;
  }

  return NextResponse.json({ success: true, updated: updates });
}
