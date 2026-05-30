/**
 * POST   /api/team/invite — Send invitation + email
 * GET    /api/team/invite — List invitations (admin only)
 * PATCH  /api/team/invite — Resend invitation (admin only)
 * DELETE /api/team/invite — Delete invitation (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getUserTeam, inviteMember } from '@/services/team';
import { sendEmail, teamInviteEmail } from '@/services/email';
import { supabaseAdmin } from '@/lib/supabase';
import { teamInviteSchema } from '@/lib/schemas';

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

// ── POST: Create & send new invitation ───────────────────────────────────────
export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'SUB_ADMIN')) {
    return NextResponse.json({ error: 'Only team admins or sub-admins can invite members.' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = teamInviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }
  const { email } = parsed.data;

  try {
    const invite = await inviteMember(membership.team_id, email, user.id);
    const teamName = (membership as any).teams?.name || 'Your Team';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000';
    const appUrl = host.includes('localhost') ? `http://${host}` : `${protocol}://${host}`;
    const inviteUrl = `${appUrl}/join?token=${invite.token}`;

    console.log(`[Invite] Created for ${email} → ${inviteUrl}`);

    const emailResult = await sendEmail(
      teamInviteEmail({
        teamName,
        inviterEmail: user.email || 'your admin',
        inviteUrl,
        expiresAt: invite.expires_at,
        recipientEmail: email,
      })
    );

    if (!emailResult.success) console.error(`[Invite] Email failed for ${email}:`, emailResult.error);
    else console.log(`[Invite] ✅ Email sent to ${email}`);

    return NextResponse.json({
      success: true,
      message: emailResult.success
        ? `Invitation email sent to ${email}`
        : `Invitation created but email delivery failed — share the link manually`,
      emailSent: emailResult.success,
      emailError: emailResult.success ? undefined : emailResult.error,
      inviteUrl,
      expiresAt: invite.expires_at,
    });
  } catch (err: any) {
    console.error('[Invite] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// ── GET: List invitations ────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'SUB_ADMIN')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: invitations } = await supabaseAdmin!
    .from('team_invitations')
    .select('*')
    .eq('team_id', membership.team_id)
    .order('created_at', { ascending: false });

  return NextResponse.json({ invitations: invitations || [] });
}

// ── PATCH: Resend an existing invitation ────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'SUB_ADMIN')) {
    return NextResponse.json({ error: 'Only team admins or sub-admins can resend invitations.' }, { status: 403 });
  }

  try {
    const { inviteId } = await request.json();
    if (!inviteId) return NextResponse.json({ error: 'inviteId required' }, { status: 400 });

    // Must belong to this team
    const { data: existing, error: fetchErr } = await supabaseAdmin!
      .from('team_invitations')
      .select('*')
      .eq('id', inviteId)
      .eq('team_id', membership.team_id)
      .maybeSingle();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
    }
    if (existing.status === 'ACCEPTED') {
      return NextResponse.json({ error: 'This invitation has already been accepted.' }, { status: 400 });
    }

    // inviteMember expires old token + creates fresh one with new 24h expiry
    const invite = await inviteMember(membership.team_id, existing.email, user.id);
    const teamName = (membership as any).teams?.name || 'Your Team';
    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const host = request.headers.get('host') || process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL || 'localhost:3000';
    const appUrl = host.includes('localhost') ? `http://${host}` : `${protocol}://${host}`;
    const inviteUrl = `${appUrl}/join?token=${invite.token}`;

    console.log(`[Resend] Fresh invite for ${existing.email} → ${inviteUrl}`);

    const emailResult = await sendEmail(
      teamInviteEmail({
        teamName,
        inviterEmail: user.email || 'your admin',
        inviteUrl,
        expiresAt: invite.expires_at,
        recipientEmail: existing.email,
      })
    );

    if (!emailResult.success) console.error(`[Resend] Email failed:`, emailResult.error);
    else console.log(`[Resend] ✅ Resent to ${existing.email}`);

    return NextResponse.json({
      success: true,
      message: emailResult.success
        ? `Invitation resent to ${existing.email}`
        : `New link created but email delivery failed — share manually`,
      emailSent: emailResult.success,
      emailError: emailResult.success ? undefined : emailResult.error,
      inviteUrl,
      expiresAt: invite.expires_at,
    });
  } catch (err: any) {
    console.error('[Resend] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

// ── DELETE: Remove an invitation ─────────────────────────────────────────────
export async function DELETE(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'SUB_ADMIN')) {
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
