/**
 * POST   /api/team/members          — Remove member (admin only)
 * DELETE /api/team/members          — Leave team (member)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getUserTeam, removeMember, leaveTeam, updateMemberRole } from '@/services/team';

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

// Admin removes a member
export async function DELETE(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { userId: targetUserId, action } = body;

  const membership = await getUserTeam(user.id);
  if (!membership) return NextResponse.json({ error: 'Not in a team' }, { status: 400 });

  if (action === 'leave') {
    // Leave team
    try {
      await leaveTeam(user.id, membership.team_id);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
  }

  // Admin / Sub-Admin removing a member
  if (membership.role !== 'ADMIN' && membership.role !== 'SUB_ADMIN') {
    return NextResponse.json({ error: 'Only admins or sub-admins can remove members.' }, { status: 403 });
  }

  if (!targetUserId) return NextResponse.json({ error: 'userId required' }, { status: 400 });

  try {
    await removeMember(membership.team_id, targetUserId, user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { userId: targetUserId, role: newRole } = body;

  const membership = await getUserTeam(user.id);
  if (!membership) return NextResponse.json({ error: 'Not in a team' }, { status: 400 });

  if (membership.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Only the main admin can change roles.' }, { status: 403 });
  }

  if (!targetUserId || !newRole) {
    return NextResponse.json({ error: 'userId and role required' }, { status: 400 });
  }

  if (!['ADMIN', 'SUB_ADMIN', 'MEMBER'].includes(newRole)) {
     return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  try {
    await updateMemberRole(membership.team_id, targetUserId, newRole, user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

