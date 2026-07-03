/**
 * POST /api/auth/otp/cookie
 * Sets Supabase session cookies server-side using createServerClient.
 * This ensures the middleware (which reads server cookies) can see the session
 * immediately on the next request after the client redirects.
 */
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { accessToken, refreshToken } = await request.json();

    if (!accessToken || !refreshToken) {
      return NextResponse.json({ error: 'Missing tokens.' }, { status: 400 });
    }

    // Build a response first — cookies will be attached to it
    const response = NextResponse.json({ ok: true });

    // createServerClient writes cookies into the response headers
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: any[]) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (error) {
      console.error('[Cookie] setSession error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log('[Cookie] ✅ Session cookies set server-side');
    return response;
  } catch (err: any) {
    console.error('[Cookie] error:', err);
    return NextResponse.json({ error: err.message || 'Internal error.' }, { status: 500 });
  }
}
