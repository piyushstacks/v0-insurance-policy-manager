'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface TeamMember {
  id: string;
  user_id: string;
  role: 'ADMIN' | 'SUB_ADMIN' | 'MEMBER';
  status: string;
  email?: string;
  user_profiles?: { full_name: string };
}

interface TeamContext {
  role: 'ADMIN' | 'SUB_ADMIN' | 'MEMBER' | null;
  teamId: string | null;
  teamName: string | null;
  members: TeamMember[];
  user: any | null;
  loading: boolean;
  isAdmin: boolean;
  isSubAdmin: boolean;
  isMember: boolean;
  canDirectlyAct: boolean;
  hasTeam: boolean;
  refresh: () => void;
}

const TeamCtx = createContext<TeamContext>({
  role: null,
  teamId: null,
  teamName: null,
  members: [],
  user: null,
  loading: true,
  isAdmin: false,
  isSubAdmin: false,
  isMember: false,
  canDirectlyAct: false,
  hasTeam: false,
  refresh: () => {},
});

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const value = useTeamState();
  return <TeamCtx.Provider value={value}>{children}</TeamCtx.Provider>;
}

function useTeamState(): TeamContext {
  const [role, setRole] = useState<'ADMIN' | 'SUB_ADMIN' | 'MEMBER' | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [teamName, setTeamName] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fetch_ = useCallback(async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      const res = await fetch('/api/team');
      if (!res.ok) return;
      const data = await res.json();
      setRole(data.role ?? null);
      setTeamId(data.team?.id ?? null);
      setTeamName(data.team?.name ?? null);
      setMembers(data.members ?? []);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return {
    role,
    teamId,
    teamName,
    members,
    user,
    loading,
    isAdmin: role === 'ADMIN',
    isSubAdmin: role === 'SUB_ADMIN',
    isMember: role === 'MEMBER',
    canDirectlyAct: role === 'ADMIN' || role === 'SUB_ADMIN',
    hasTeam: !!teamId,
    refresh: fetch_,
  };
}

export function useTeam() {
  return useContext(TeamCtx);
}
