'use client';

import { useState, useEffect, createContext, useContext, useCallback } from 'react';

interface TeamContext {
  role: 'ADMIN' | 'SUB_ADMIN' | 'MEMBER' | null;
  teamId: string | null;
  teamName: string | null;
  loading: boolean;
  isAdmin: boolean;
  isSubAdmin: boolean;
  isMember: boolean;
  canDirectlyAct: boolean; // ADMIN or SUB_ADMIN — can delete/edit without approval
  hasTeam: boolean;
  refresh: () => void;
}

const TeamCtx = createContext<TeamContext>({
  role: null,
  teamId: null,
  teamName: null,
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
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    try {
      const res = await fetch('/api/team');
      if (!res.ok) return;
      const data = await res.json();
      setRole(data.role ?? null);
      setTeamId(data.team?.id ?? null);
      setTeamName(data.team?.name ?? null);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  return {
    role,
    teamId,
    teamName,
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
