/**
 * POST /api/auth/otp/session
 * Called after our custom OTP is verified — creates a real Supabase session
 * using admin generateLink, then extracts tokens from the redirect URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email?.includes('@')) {
      return NextResponse.json({ error: 'Valid email required.' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Server misconfiguration.' }, { status: 500 });
    }

    // Generate a magic link token via admin API
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: {
        redirectTo: process.env.NEXT_PUBLIC_APP_URL
          ? `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`
          : 'http://localhost:3000/auth/callback',
      },
    });

    if (error || !data?.properties) {
      console.error('[Session] generateLink error:', error);
      return NextResponse.json({ error: error?.message || 'Failed to create session.' }, { status: 500 });
    }

    // Extract hashed_token from the action_link
    const actionLink = data.properties.action_link;
    const url = new URL(actionLink);
    const token_hash = url.searchParams.get('token') || data.properties.hashed_token;
    const type = 'magiclink';

    if (!token_hash) {
      return NextResponse.json({ error: 'Could not extract session token.' }, { status: 500 });
    }

    // Exchange hashed token for a real session
    const { data: sessionData, error: sessionError } = await supabaseAdmin.auth.admin.getUserById(data.user.id);
    if (sessionError || !sessionData?.user) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    // Use verifyOtp server-side to get real tokens
    // We'll use the Supabase client with the token
    const { createClient } = await import('@supabase/supabase-js');
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: verifyData, error: verifyError } = await anonClient.auth.verifyOtp({
      token_hash,
      type: 'magiclink',
    });

    if (verifyError || !verifyData?.session) {
      console.error('[Session] verifyOtp error:', verifyError);
      return NextResponse.json({ error: verifyError?.message || 'Failed to exchange token for session.' }, { status: 500 });
    }

    return NextResponse.json({
      accessToken: verifyData.session.access_token,
      refreshToken: verifyData.session.refresh_token,
    });
  } catch (err: any) {
    console.error('[Session] error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
