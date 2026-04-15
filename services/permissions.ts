/**
 * Permissions Service
 * Central authority for role-based access control
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserTeam, getUserRole, type TeamRole } from './team';

export interface UserContext {
  userId: string;
  teamId: string | null;
  role: TeamRole | null;
  isAdmin: boolean;
  isMember: boolean;
}

/**
 * Get user context from session — call at the start of every API handler
 */
export async function getUserContext(request: Request): Promise<UserContext | null> {
  try {
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
    if (!user) return null;

    const membership = await getUserTeam(user.id);
    const teamId = membership?.team_id ?? null;
    const role = teamId ? await getUserRole(user.id, teamId) : null;

    return {
      userId: user.id,
      teamId,
      role,
      isAdmin: role === 'ADMIN',
      isMember: role === 'MEMBER',
    };
  } catch {
    return null;
  }
}

/**
 * Check if a user can perform a direct (non-approval) action
 */
export function canPerformDirectly(ctx: UserContext, action: string): boolean {
  if (ctx.isAdmin) return true;

  // Members can only read and add
  const allowedMemberActions = ['read', 'create'];
  return allowedMemberActions.some(a => action.toLowerCase().startsWith(a));
}

/**
 * Actions that require approval for MEMBER role
 */
export const APPROVAL_REQUIRED_ACTIONS = new Set([
  'DELETE_POLICY',
  'DELETE_CUSTOMER',
  'DELETE_DOCUMENT',
  'EDIT_POLICY',
  'EDIT_CUSTOMER',
]);

export function requiresApproval(action: string): boolean {
  return APPROVAL_REQUIRED_ACTIONS.has(action.toUpperCase());
}
