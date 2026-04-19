/**
 * POST  /api/team          — Create team
 * GET   /api/team          — Get current user's team
 * DELETE /api/team         — Delete team (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  createTeam, getUserTeam, deleteTeam, getTeamMembers, getTeamInvitations
} from '@/services/team';

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

export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const membership = await getUserTeam(user.id);
    console.log('[GET /api/team] membership:', JSON.stringify(membership));

    if (!membership) {
      return NextResponse.json({ team: null, role: null, members: [], invitations: [] });
    }

    // team_id comes from team_members.team_id column
    const teamId = membership.team_id;
    const role = membership.role;

    if (!teamId) {
      console.warn('[GET /api/team] membership found but team_id is null:', membership);
      return NextResponse.json({ team: null, role: null, members: [], invitations: [] });
    }

    const [members, invitations] = await Promise.all([
      getTeamMembers(teamId),
      role === 'ADMIN' ? getTeamInvitations(teamId) : Promise.resolve([]),
    ]);

    // membership.teams is the joined teams row
    const team = (membership as any).teams ?? null;

    console.log('[GET /api/team] team:', team?.id, 'role:', role, 'members:', members?.length);

    return NextResponse.json({ team, role, members, invitations });
  } catch (err: any) {
    console.error('[GET /api/team] error:', err);
    return NextResponse.json(
      { 
        error: String(err.stack || err.message || err) || 'Failed to load team', 
        team: null, role: null, members: [], invitations: [] 
      }, 
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Team name is required' }, { status: 400 });

  try {
    const team = await createTeam(user.id, name.trim());
    return NextResponse.json({ success: true, team });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { teamId } = await request.json();
  if (!teamId) return NextResponse.json({ error: 'teamId required' }, { status: 400 });

  try {
    await deleteTeam(teamId, user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
