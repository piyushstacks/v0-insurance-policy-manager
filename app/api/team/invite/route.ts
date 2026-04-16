/**
 * POST /api/team/invite — Send invitation + email
 * GET  /api/team/invite — List invitations for team (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getUserTeam, inviteMember } from '@/services/team';
import { sendEmail, teamInviteEmail } from '@/services/email';
import { supabaseAdmin } from '@/lib/supabase';

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
    const teamData = (membership as any).teams;
    const teamName = teamData?.name || 'Your Team';

    console.log(`[Invite] Created invite for ${email} → ${invite.inviteUrl}`);

    // Send email
    const emailResult = await sendEmail(
      teamInviteEmail({
        teamName,
        inviterEmail: user.email || 'your admin',
        inviteUrl: invite.inviteUrl,
        expiresAt: invite.expires_at,
        recipientEmail: email,
      })
    );

    if (!emailResult.success) {
      console.error(`[Invite] Email failed for ${email}:`, emailResult.error);
    } else {
      console.log(`[Invite] ✅ Email sent to ${email}`);
    }

    return NextResponse.json({
      success: true,
      message: emailResult.success
        ? `Invitation email sent to ${email}`
        : `Invitation created but email delivery failed — share the link manually`,
      emailSent: emailResult.success,
      emailError: emailResult.success ? undefined : emailResult.error,
      inviteUrl: invite.inviteUrl,
      expiresAt: invite.expires_at,
    });
  } catch (err: any) {
    console.error('[Invite] Error:', err);
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

  const { data: invitations } = await supabaseAdmin!
    .from('team_invitations')
    .select('*')
    .eq('team_id', membership.team_id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ invitations: invitations || [] });
}

export async function DELETE(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership || membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { inviteId } = await request.json();
    if (!inviteId) return NextResponse.json({ error: 'Invite ID required' }, { status: 400 });

    const { error } = await supabaseAdmin!
      .from('team_invitations')
      .delete()
      .eq('id', inviteId)
      .eq('team_id', membership.team_id);

    if (error) throw error;
    
    return NextResponse.json({ success: true, message: 'Invitation deleted permanently' });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
