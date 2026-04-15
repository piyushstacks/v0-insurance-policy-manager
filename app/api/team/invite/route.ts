/**
 * POST /api/team/invite   — Send invitation
 * GET  /api/team/invite   — List invitations for team
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getUserTeam, inviteMember, getTeamInvitations } from '@/services/team';

async function getUser(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); }
          catch { }
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership || membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only team admins can invite members.' }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email?.includes('@')) return NextResponse.json({ error: 'Valid email required.' }, { status: 400 });

  try {
    const invite = await inviteMember(membership.team_id, email, user.id);

    // In production: send email with invite.inviteUrl
    // For now: return the link directly so admin can share it
    return NextResponse.json({
      success: true,
      message: `Invitation created for ${email}`,
      inviteUrl: invite.inviteUrl,
      expiresAt: invite.expires_at,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership || membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const invitations = await getTeamInvitations(membership.team_id);
  return NextResponse.json({ invitations });
}
