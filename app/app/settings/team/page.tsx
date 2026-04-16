'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, Mail, UserX, Copy, CheckCircle,
  Loader2, Shield, AlertCircle, Clock, LogOut, RefreshCw,
  Crown, Trash2, ChevronRight, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface Member {
  id: string;
  user_id: string;
  role: 'ADMIN' | 'MEMBER';
  status: string;
  joined_at: string;
  email?: string;
  user_profiles?: { full_name: string };
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface TeamData {
  team: { id: string; name: string; admin_id: string } | null;
  role: 'ADMIN' | 'MEMBER' | null;
  members: Member[];
  invitations: Invitation[];
}

// ─── CREATE TEAM PAGE ─────────────────────────────────────────────
function CreateTeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Team "${teamName}" created! You're the Admin.`);
      // Hard redirect to force fresh data load
      router.push('/app/settings/team?created=1');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
      setCreating(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 border-2 border-blue-200 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-blue-100">
            <Users className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Create Your Team</h1>
          <p className="text-slate-500 max-w-sm mx-auto">
            Set up a shared workspace for your colleagues. You'll be the <strong>Admin</strong> and can invite members.
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white border border-slate-200 rounded-[28px] p-8 shadow-xl shadow-slate-100 space-y-6">
          <div>
            <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">
              Team Name
            </label>
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Apex Solutions"
              className="h-12 rounded-2xl text-base font-semibold border-slate-200 focus:border-blue-400 focus:ring-blue-400/10"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <p className="text-xs text-slate-400 mt-2 ml-1">This will be visible to all team members.</p>
          </div>

          <Button
            onClick={handleCreate}
            disabled={creating || !teamName.trim()}
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold text-base gap-2 shadow-lg shadow-blue-200"
          >
            {creating ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Creating team...</>
            ) : (
              <><Plus className="w-5 h-5" /> Create Team</>
            )}
          </Button>

          {/* Permissions preview */}
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">As Admin you can:</p>
            <div className="space-y-2">
              {[
                'Invite & remove team members',
                'Approve or reject member action requests',
                'Full access to all policies, customers & data',
                'Manage team settings & billing',
              ].map((perm) => (
                <div key={perm} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="text-sm text-slate-600">{perm}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── TEAM VIEW PAGE ────────────────────────────────────────────────
function TeamViewPage({ data, onRefresh }: { data: TeamData; onRefresh: () => void }) {
  const router = useRouter();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const { team, role, members, invitations } = data;
  const isAdmin = role === 'ADMIN';

  async function handleInvite() {
    if (!inviteEmail.includes('@')) return;
    setInviting(true);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setInviteLink(json.inviteUrl);
      setInviteEmail('');
      toast.success(`Invitation created for ${inviteEmail}`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!confirm('Remove this member from the team?')) return;
    try {
      const res = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Member removed.');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleDeleteInvitation(inviteId: string) {
    if (!confirm('Delete this pending invitation permanently?')) return;
    try {
      const res = await fetch('/api/team/invite', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Invitation securely deleted.');
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleLeave() {
    if (!confirm('Leave this team? You will lose all access.')) return;
    try {
      const res = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('You have left the team.');
      router.push('/app/settings/team');
      router.refresh();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  function copyLink(link: string) {
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
    toast.success('Invite link copied!');
  }

  const pendingInvites = (invitations || []).filter(i => i.status === 'PENDING');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900">{team?.name}</h1>
              <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {isAdmin ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                {role}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onRefresh} variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {!isAdmin && (
            <Button onClick={handleLeave} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl gap-2 text-sm">
              <LogOut className="w-4 h-4" /> Leave
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Members', value: members.length, color: 'blue' },
          { label: 'Pending Invites', value: pendingInvites.length, color: 'amber' },
          { label: 'Role', value: role, color: isAdmin ? 'amber' : 'slate' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
            <p className={`text-2xl font-black text-${color}-600`}>{value}</p>
            <p className="text-xs font-medium text-slate-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Invite (Admin only) ── */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" /> Invite a Member
          </h2>
          <div className="flex gap-3">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              type="email"
              className="rounded-2xl h-11"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.includes('@')}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl gap-1.5 h-11 shrink-0"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send
            </Button>
          </div>

          {inviteLink && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2">
              <p className="text-emerald-700 text-xs font-bold">✅ Share this link with your colleague:</p>
              <div className="flex gap-2">
                <code className="text-xs bg-white border border-emerald-200 text-slate-700 px-3 py-2 rounded-xl flex-1 truncate block">
                  {inviteLink}
                </code>
                <Button onClick={() => copyLink(inviteLink)} size="sm" variant="outline" className="rounded-xl shrink-0 border-emerald-300 h-9">
                  {copiedLink ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Members List ── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-blue-600" /> Members ({members.length})
        </h2>
        <div className="divide-y divide-slate-100">
          {members.map((member) => {
            const name = member.user_profiles?.full_name || member.email || member.user_id.slice(0, 8) + '...';
            return (
              <div key={member.id} className="flex items-center justify-between py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow">
                    {name[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-900">{name}</p>
                    {member.email && <p className="text-xs text-slate-400">{member.email}</p>}
                    <p className="text-xs text-slate-400">Joined {new Date(member.joined_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    member.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {member.role}
                  </span>
                  {isAdmin && member.role !== 'ADMIN' && (
                    <Button
                      onClick={() => handleRemoveMember(member.user_id)}
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg h-8 w-8"
                    >
                      <UserX className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Pending Invitations (Admin only) ── */}
      {isAdmin && pendingInvites.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-3xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-amber-500" /> Pending Invitations ({pendingInvites.length})
          </h2>
          <div className="divide-y divide-slate-100">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-semibold text-sm text-slate-900">{inv.email}</p>
                  <p className="text-xs text-slate-400">Expires {new Date(inv.expires_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">PENDING</span>
                  <Button
                    onClick={() => handleDeleteInvitation(inv.id)}
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg h-8 w-8"
                    title="Delete Invitation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Member Permissions Info ── */}
      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6">
          <h2 className="font-bold text-blue-900 flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4" /> Your Permissions
          </h2>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {[
              { can: true, text: 'View all policies & customers' },
              { can: true, text: 'Add clients & upload policies' },
              { can: true, text: 'Request edits or deletes' },
              { can: false, text: 'Delete records directly' },
              { can: false, text: 'Manage team or invite members' },
              { can: false, text: 'Access billing data' },
            ].map(({ can, text }) => (
              <div key={text} className="flex items-center gap-2">
                {can
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                <span className={can ? 'text-slate-700' : 'text-slate-400'}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MAIN PAGE (router between create / view) ─────────────────────
export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    setApiError(null);
    try {
      const res = await fetch('/api/team');
      const json = await res.json();

      if (!res.ok) {
        // Real API error — don't fall to create page
        console.error('[TeamPage] API error:', json);
        setApiError(json.error || `Server error ${res.status}`);
        return;
      }

      setData(json);
    } catch (err: any) {
      setApiError('Network error — could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-500 text-sm font-medium">Loading team...</p>
        </div>
      </div>
    );
  }

  // Real API error (not just empty team)
  if (apiError) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-6">
        <div className="text-center max-w-md space-y-4">
          <div className="w-16 h-16 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Failed to load team</h2>
          <p className="text-slate-500 text-sm bg-slate-100 px-4 py-2 rounded-xl font-mono">{apiError}</p>
          <Button onClick={fetchTeam} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl">
            <RefreshCw className="w-4 h-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  // No team — show dedicated create page
  if (!data?.team) {
    return <CreateTeamPage />;
  }

  // Has team — show team management view
  return <TeamViewPage data={data} onRefresh={fetchTeam} />;
}
