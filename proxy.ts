import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

async function handleProxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Build a mutable response that cookies can be written into
  let response = NextResponse.next({ request });

  // Use the official @supabase/ssr middleware client — it handles
  // chunked cookies, decoding, session refresh, and all cookie formats correctly
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: any[]) {
          // Write refreshed cookies back onto both the request and response
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the JWT and refreshes the session if needed
  const { data: { user } } = await supabase.auth.getUser();
  const authenticated = !!user;

  // ── Route guards ────────────────────────────────────────────────
  if (pathname.startsWith('/app') && !authenticated) {
    return NextResponse.redirect(new URL(`/auth/login?next=${encodeURIComponent(pathname)}`, request.url));
  }

  if (pathname.startsWith('/join')) {
    return response;
  }

  if (pathname.startsWith('/auth') && authenticated) {
    return NextResponse.redirect(new URL('/app', request.url));
  }

  if (pathname === '/') {
    return NextResponse.redirect(
      new URL(authenticated ? '/app' : '/auth/login', request.url)
    );
  }

  return response;
}

// Next.js 16.2 requires named "proxy" export OR default export
export const proxy = handleProxy;
export default handleProxy;

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/).*)'],
};
