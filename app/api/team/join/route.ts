/**
 * GET  /api/team/join?token=xxx  — Validate invite token (pre-join info)
 * POST /api/team/join             — Accept invitation
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getInviteByToken, acceptInvite } from '@/services/team';

async function getUser(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  const invite = await getInviteByToken(token);
  if (!invite) return NextResponse.json({ error: 'Invalid invitation link.' }, { status: 404 });

  if (invite.status !== 'PENDING') {
    return NextResponse.json({ error: 'This invitation has already been used or expired.', status: invite.status }, { status: 400 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: 'This invitation has expired.', status: 'EXPIRED' }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    teamName: invite.teams?.name,
    email: invite.email,
    expiresAt: invite.expires_at,
  });
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Please sign in first to accept this invitation.' }, { status: 401 });

  const { token } = await request.json();
  if (!token) return NextResponse.json({ error: 'Token required' }, { status: 400 });

  try {
    const invite = await acceptInvite(token, user.id);
    return NextResponse.json({ success: true, teamName: (invite.teams as any)?.name });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
