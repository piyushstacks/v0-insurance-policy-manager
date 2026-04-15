/**
 * Team Service — Core business logic for teams, members, invitations
 */

import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export type TeamRole = 'ADMIN' | 'MEMBER';
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED';
export type ActionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ActionRequestType =
  | 'DELETE_POLICY' | 'EDIT_POLICY'
  | 'DELETE_CUSTOMER' | 'EDIT_CUSTOMER'
  | 'DELETE_DOCUMENT';

export interface TeamMemberWithProfile {
  id: string;
  user_id: string;
  role: TeamRole;
  status: string;
  joined_at: string;
  user_profiles?: { full_name: string; status: string } | null;
  email?: string;
}

// ─── TEAM CRUD ────────────────────────────────────────────────────

export async function createTeam(adminUserId: string, teamName: string) {
  // One team per user
  const existing = await getUserTeam(adminUserId);
  if (existing) throw new Error('You are already part of a team. Leave first to create a new one.');

  const { data: team, error } = await supabaseAdmin!
    .from('teams')
    .insert([{ name: teamName, admin_id: adminUserId }])
    .select('*')
    .single();

  if (error) throw error;

  // Add admin as team member
  await supabaseAdmin!.from('team_members').insert([{
    team_id: team.id,
    user_id: adminUserId,
    role: 'ADMIN',
    status: 'ACTIVE',
  }]);

  // Update user profile
  await supabaseAdmin!.from('user_profiles')
    .update({ team_id: team.id, role: 'ADMIN' })
    .eq('id', adminUserId);

  return team;
}

export async function getTeam(teamId: string) {
  const { data, error } = await supabaseAdmin!
    .from('teams')
    .select('*')
    .eq('id', teamId)
    .single();
  if (error) throw error;
  return data;
}

export async function getUserTeam(userId: string) {
  const { data } = await supabaseAdmin!
    .from('team_members')
    .select('*, teams(*)')
    .eq('user_id', userId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  return data;
}

export async function getUserRole(userId: string, teamId: string): Promise<TeamRole | null> {
  const { data } = await supabaseAdmin!
    .from('team_members')
    .select('role')
    .eq('user_id', userId)
    .eq('team_id', teamId)
    .eq('status', 'ACTIVE')
    .maybeSingle();
  return (data?.role as TeamRole) ?? null;
}

export async function getTeamMembers(teamId: string): Promise<TeamMemberWithProfile[]> {
  const { data, error } = await supabaseAdmin!
    .from('team_members')
    .select('*, user_profiles(full_name, status)')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true });

  if (error) throw error;

  // Enrich with emails from auth.users via admin API
  const enriched = await Promise.all((data || []).map(async (m) => {
    try {
      const { data: authUser } = await supabaseAdmin!.auth.admin.getUserById(m.user_id);
      return { ...m, email: authUser?.user?.email };
    } catch {
      return m;
    }
  }));

  return enriched as TeamMemberWithProfile[];
}

export async function removeMember(teamId: string, userId: string, adminUserId: string) {
  const team = await getTeam(teamId);
  if (team.admin_id === userId) throw new Error('Cannot remove the team admin.');

  await supabaseAdmin!.from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);

  await supabaseAdmin!.from('user_profiles')
    .update({ team_id: null, role: 'MEMBER' })
    .eq('id', userId);
}

export async function leaveTeam(userId: string, teamId: string) {
  const team = await getTeam(teamId);
  if (team.admin_id === userId) throw new Error('Admin cannot leave — transfer ownership or delete the team first.');

  await supabaseAdmin!.from('team_members')
    .delete()
    .eq('team_id', teamId)
    .eq('user_id', userId);

  await supabaseAdmin!.from('user_profiles')
    .update({ team_id: null, role: 'MEMBER' })
    .eq('id', userId);
}

export async function deleteTeam(teamId: string, adminUserId: string) {
  const team = await getTeam(teamId);
  if (team.admin_id !== adminUserId) throw new Error('Only the admin can delete the team.');

  // Reset all members
  await supabaseAdmin!.from('user_profiles')
    .update({ team_id: null, role: 'MEMBER' })
    .eq('team_id', teamId);

  await supabaseAdmin!.from('teams').delete().eq('id', teamId);
}

// ─── INVITATIONS ─────────────────────────────────────────────────

export async function inviteMember(teamId: string, email: string, invitedBy: string) {
  // Expire old pending invites for this email+team
  await supabaseAdmin!.from('team_invitations')
    .update({ status: 'EXPIRED' })
    .eq('team_id', teamId)
    .eq('email', email.toLowerCase())
    .eq('status', 'PENDING');

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin!.from('team_invitations').insert([{
    team_id: teamId,
    email: email.toLowerCase(),
    invited_by: invitedBy,
    token,
    status: 'PENDING',
    expires_at: expiresAt,
  }]).select().single();

  if (error) throw error;
  return { ...data, inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/join?token=${token}` };
}

export async function getInviteByToken(token: string) {
  const { data, error } = await supabaseAdmin!
    .from('team_invitations')
    .select('*, teams(name)')
    .eq('token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function acceptInvite(token: string, userId: string) {
  const invite = await getInviteByToken(token);
  if (!invite) throw new Error('Invalid invitation token.');
  if (invite.status !== 'PENDING') throw new Error('This invitation has already been used or expired.');
  if (new Date(invite.expires_at) < new Date()) {
    await supabaseAdmin!.from('team_invitations').update({ status: 'EXPIRED' }).eq('id', invite.id);
    throw new Error('This invitation has expired.');
  }

  // Check if user already in a team
  const existingMembership = await getUserTeam(userId);
  if (existingMembership) throw new Error('You are already part of a team. Leave first to accept this invite.');

  // Add to team
  await supabaseAdmin!.from('team_members').insert([{
    team_id: invite.team_id,
    user_id: userId,
    role: 'MEMBER',
    status: 'ACTIVE',
  }]);

  // Update profile
  await supabaseAdmin!.from('user_profiles')
    .update({ team_id: invite.team_id, role: 'MEMBER' })
    .eq('id', userId);

  // Mark invite accepted
  await supabaseAdmin!.from('team_invitations')
    .update({ status: 'ACCEPTED' })
    .eq('id', invite.id);

  return invite;
}

export async function getTeamInvitations(teamId: string) {
  const { data, error } = await supabaseAdmin!
    .from('team_invitations')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

// ─── ACTION REQUESTS ──────────────────────────────────────────────

export async function createActionRequest(params: {
  teamId: string;
  type: ActionRequestType;
  entityId: string;
  entityType: string;
  requestedBy: string;
  reason?: string;
  metadata?: Record<string, any>;
}) {
  // Prevent duplicates (same entity + type + pending)
  const { data: existing } = await supabaseAdmin!
    .from('action_requests')
    .select('id')
    .eq('team_id', params.teamId)
    .eq('type', params.type)
    .eq('entity_id', params.entityId)
    .eq('status', 'PENDING')
    .maybeSingle();

  if (existing) throw new Error('A request for this action is already pending approval.');

  const { data, error } = await supabaseAdmin!.from('action_requests').insert([{
    team_id: params.teamId,
    type: params.type,
    entity_id: params.entityId,
    entity_type: params.entityType,
    requested_by: params.requestedBy,
    status: 'PENDING',
    reason: params.reason || null,
    metadata: params.metadata || {},
  }]).select().single();

  if (error) throw error;
  return data;
}

export async function getActionRequests(teamId: string, status?: ActionRequestStatus) {
  let query = supabaseAdmin!
    .from('action_requests')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function reviewActionRequest(
  requestId: string,
  reviewedBy: string,
  decision: 'APPROVED' | 'REJECTED',
  note?: string
) {
  const { data: req, error: fetchErr } = await supabaseAdmin!
    .from('action_requests')
    .select('*')
    .eq('id', requestId)
    .single();

  if (fetchErr || !req) throw new Error('Action request not found.');
  if (req.status !== 'PENDING') throw new Error('This request has already been reviewed.');

  await supabaseAdmin!.from('action_requests').update({
    status: decision,
    reviewed_by: reviewedBy,
    reviewed_at: new Date().toISOString(),
    note: note || null,
  }).eq('id', requestId);

  return { ...req, status: decision };
}

export async function getUserProfile(userId: string) {
  const { data } = await supabaseAdmin!
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  return data;
}
