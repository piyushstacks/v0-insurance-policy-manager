'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users, Plus, Mail, UserX, Copy, CheckCircle,
  Loader2, Shield, AlertCircle, Clock, LogOut, RefreshCw,
  Crown, Trash2, SendHorizonal, ChevronDown, UserCog, Phone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { emailRegex } from '@/lib/schemas';

interface Member {
  id: string;
  user_id: string;
  role: 'ADMIN' | 'SUB_ADMIN' | 'MEMBER';
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
  role: 'ADMIN' | 'SUB_ADMIN' | 'MEMBER' | null;
  members: Member[];
  invitations: Invitation[];
}

const ROLE_CONFIG = {
  ADMIN: { label: 'Admin', badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500', icon: Crown },
  SUB_ADMIN: { label: 'Sub Admin', badge: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500', icon: Shield },
  MEMBER: { label: 'Member', badge: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400', icon: Users },
};

// ─── CREATE TEAM PAGE ─────────────────────────────────────────────
function CreateTeamPage() {
  const router = useRouter();
  const [teamName, setTeamName] = useState('');
  const [teamEmail, setTeamEmail] = useState('');
  const [teamPhone, setTeamPhone] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: teamName.trim(),
          email: teamEmail.trim(),
          phone: teamPhone.trim()
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success(`Team "${teamName}" created! You're the Admin.`);
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
        <div className="text-center mb-10">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-indigo-700 border-2 border-white rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-xl shadow-blue-100">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">Create Your Agency</h1>
          <p className="text-slate-500 max-w-sm mx-auto text-sm">
            Establish your business identity. PolicyVault uses these details for all automated client communications.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-[32px] p-8 shadow-2xl shadow-slate-200/50 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">
                Business / Team Name
              </label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="e.g. Apex Solutions or Anil Bhagchandani Team"
                className="h-14 rounded-2xl text-lg font-bold border-slate-200 focus:border-blue-500 focus:ring-blue-500/10 placeholder:text-slate-300"
                autoFocus
              />
              <p className="text-[11px] text-blue-600 font-semibold mt-2 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                Use your business name or your full name as it should appear in emails.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">
                  Contact Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={teamEmail}
                    onChange={(e) => setTeamEmail(e.target.value)}
                    placeholder="office@agency.com"
                    className="h-12 pl-11 rounded-xl font-medium border-slate-200"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block mb-2">
                  Contact Phone
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    value={teamPhone}
                    onChange={(e) => setTeamPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="h-12 pl-11 rounded-xl font-medium border-slate-200"
                  />
                </div>
              </div>
            </div>
          </div>

          <Button 
            onClick={handleCreate} 
            disabled={!teamName.trim() || creating}
            className="w-full h-14 rounded-2xl bg-slate-900 hover:bg-black text-white font-bold text-lg transition-all hover:scale-[1.02] active:scale-100 disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              'Initialize Agency →'
            )}
          </Button>

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

// ─── ROLE BADGE ────────────────────────────────────────────────────
function RoleBadge({ role }: { role: 'ADMIN' | 'SUB_ADMIN' | 'MEMBER' }) {
  const cfg = ROLE_CONFIG[role];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border ${cfg.badge}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

// ─── ROLE SELECTOR ─────────────────────────────────────────────────
function RoleSelector({
  memberId,
  currentRole,
  onRoleChange,
  loading,
}: {
  memberId: string;
  currentRole: 'SUB_ADMIN' | 'MEMBER';
  onRoleChange: (userId: string, role: string) => Promise<void>;
  loading: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={currentRole}
        disabled={loading}
        onChange={(e) => onRoleChange(memberId, e.target.value)}
        className={`
          appearance-none text-xs font-bold pl-2.5 pr-7 py-1.5 rounded-lg border cursor-pointer outline-none
          transition-all duration-200
          ${currentRole === 'SUB_ADMIN'
            ? 'bg-purple-50 border-purple-200 text-purple-700 hover:bg-purple-100'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
          }
          ${loading ? 'opacity-60 cursor-not-allowed' : ''}
          focus:ring-2 focus:ring-blue-100 focus:border-blue-400
        `}
      >
        <option value="MEMBER">Member</option>
        <option value="SUB_ADMIN">Sub Admin</option>
      </select>
      <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
        {loading
          ? <Loader2 className="w-3 h-3 animate-spin text-slate-400" />
          : <ChevronDown className="w-3 h-3 text-slate-400" />
        }
      </div>
    </div>
  );
}

// ─── MEMBER ROW ────────────────────────────────────────────────────
function MemberRow({
  member,
  isAdmin,
  canManageTeam,
  onRoleChange,
  onRemove,
  roleLoading,
  removeLoading,
}: {
  member: Member;
  isAdmin: boolean;
  canManageTeam: boolean;
  onRoleChange: (userId: string, role: string) => Promise<void>;
  onRemove: (userId: string, name: string) => void;
  roleLoading: boolean;
  removeLoading: boolean;
}) {
  const name = member.user_profiles?.full_name || member.email || `${member.user_id.slice(0, 8)}…`;
  const initials = name.slice(0, 2).toUpperCase();
  const isThisAdmin = member.role === 'ADMIN';

  const avatarColors = {
    ADMIN: 'from-amber-400 to-orange-500',
    SUB_ADMIN: 'from-purple-500 to-indigo-600',
    MEMBER: 'from-blue-500 to-cyan-500',
  };

  return (
    <div className={`flex items-center justify-between py-4 px-1 transition-colors rounded-xl ${removeLoading ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${avatarColors[member.role]} flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0`}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-slate-900 truncate">{name}</p>
            {isThisAdmin && <RoleBadge role="ADMIN" />}
          </div>
          {member.email && <p className="text-xs text-slate-400 truncate">{member.email}</p>}
          <p className="text-[10px] text-slate-300 mt-0.5">
            Joined {new Date(member.joined_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        {isAdmin && !isThisAdmin ? (
          <RoleSelector
            memberId={member.user_id}
            currentRole={member.role as 'SUB_ADMIN' | 'MEMBER'}
            onRoleChange={onRoleChange}
            loading={roleLoading}
          />
        ) : !isThisAdmin ? (
          <RoleBadge role={member.role} />
        ) : null}

        {canManageTeam && !isThisAdmin && (
          <Button
            onClick={() => onRemove(member.user_id, name)}
            variant="ghost"
            size="icon"
            disabled={removeLoading}
            className="text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg h-8 w-8 shrink-0"
            title="Remove Member"
          >
            {removeLoading
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <UserX className="w-3.5 h-3.5" />
            }
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── TEAM VIEW PAGE ────────────────────────────────────────────────
function TeamViewPage({ data: initialData, onRefresh }: { data: TeamData; onRefresh: () => void }) {
  const router = useRouter();

  // Local optimistic state for members — so role changes show instantly
  const [members, setMembers] = useState<Member[]>(initialData.members);
  const [invitations, setInvitations] = useState<Invitation[]>(initialData.invitations);

  // Per-member loading states
  const [roleLoadingId, setRoleLoadingId] = useState<string | null>(null);
  const [removeLoadingId, setRemoveLoadingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Sync when parent refreshes
  useEffect(() => {
    setMembers(initialData.members);
    setInvitations(initialData.invitations);
  }, [initialData]);

  const { team, role } = initialData;
  const isAdmin = role === 'ADMIN';
  const isSubAdmin = role === 'SUB_ADMIN';
  const canManageTeam = isAdmin || isSubAdmin;

  // ── Invite ──
  async function handleInvite() {
    if (!emailRegex.test(inviteEmail)) {
      toast.error('Enter a valid email with a domain (e.g. .com, .in)');
      return;
    }
    // Check duplicate invite
    const already = invitations.some(
      (inv) => inv.email.toLowerCase() === inviteEmail.toLowerCase() && inv.status === 'PENDING'
    );
    if (already) {
      toast.warning('A pending invite for this email already exists.');
      return;
    }
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
      toast.success(`Invitation sent to ${inviteEmail}`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setInviting(false);
    }
  }

  // ── Role Change — optimistic update ──
  async function handleUpdateRole(userId: string, newRole: string) {
    if (roleLoadingId) return; // prevent double-clicks

    // Optimistic UI update immediately
    setMembers((prev) =>
      prev.map((m) =>
        m.user_id === userId ? { ...m, role: newRole as Member['role'] } : m
      )
    );
    setRoleLoadingId(userId);

    try {
      const res = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        // Revert optimistic update on failure
        setMembers(initialData.members);
        throw new Error(json.error);
      }
      toast.success(`Role updated to ${ROLE_CONFIG[newRole as keyof typeof ROLE_CONFIG]?.label ?? newRole}`);
      // Sync server state in background without freezing UI
      onRefresh();
    } catch (e: any) {
      toast.error(`Failed to update role: ${e.message}`);
    } finally {
      setRoleLoadingId(null);
    }
  }

  // ── Remove Member ──
  async function handleRemoveMember(userId: string, name: string) {
    if (!confirm(`Remove "${name}" from the team?`)) return;
    setRemoveLoadingId(userId);
    try {
      const res = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      // Optimistic removal from list
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      toast.success(`${name} has been removed.`);
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRemoveLoadingId(null);
    }
  }

  // ── Delete Invitation ──
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
      // Optimistic removal
      setInvitations((prev) => prev.filter((i) => i.id !== inviteId));
      toast.success('Invitation deleted.');
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  // ── Resend Invitation ──
  async function handleResendInvitation(inviteId: string, email: string) {
    setResendingId(inviteId);
    try {
      const res = await fetch('/api/team/invite', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      if (json.emailSent) {
        toast.success(`Invitation resent to ${email}`);
      } else {
        toast.warning(`New link created but email failed. Copy: ${json.inviteUrl}`);
      }
      onRefresh();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setResendingId(null);
    }
  }

  // ── Leave Team ──
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

  const pendingInvites = invitations.filter((i) => i.status === 'PENDING');
  const adminMember = members.find((m) => m.role === 'ADMIN');
  const otherMembers = members.filter((m) => m.role !== 'ADMIN');

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
            <Users className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 leading-tight">{team?.name}</h1>
            <RoleBadge role={role!} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={onRefresh} variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100" title="Refresh">
            <RefreshCw className="w-4 h-4 text-slate-500" />
          </Button>
          {!isAdmin && (
            <Button onClick={handleLeave} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl gap-2 text-sm">
              <LogOut className="w-4 h-4" /> Leave
            </Button>
          )}
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-2xl font-black text-blue-600">{members.length}</p>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">Members</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className="text-2xl font-black text-amber-500">{pendingInvites.length}</p>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">Pending Invites</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
          <p className={`text-lg font-black mt-0.5 ${isAdmin ? 'text-amber-600' : isSubAdmin ? 'text-purple-600' : 'text-slate-600'}`}>
            {ROLE_CONFIG[role!].label}
          </p>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">Your Role</p>
        </div>
      </div>

      {/* ── Invite (Admin / SubAdmin only) ── */}
      {canManageTeam && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
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
              disabled={inviting || !inviteEmail.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl gap-1.5 h-11 shrink-0"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Invite
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
        <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-1 text-sm">
          <UserCog className="w-4 h-4 text-blue-600" />
          Members
          <span className="text-xs font-normal text-slate-400">({members.length})</span>
        </h2>

        {isAdmin && (
          <p className="text-xs text-slate-400 mb-4">
            Use the dropdown to change a member's role. Changes apply immediately.
          </p>
        )}

        <div className="divide-y divide-slate-100">
          {/* Admin first */}
          {adminMember && (
            <MemberRow
              key={adminMember.id}
              member={adminMember}
              isAdmin={isAdmin}
              canManageTeam={canManageTeam}
              onRoleChange={handleUpdateRole}
              onRemove={handleRemoveMember}
              roleLoading={roleLoadingId === adminMember.user_id}
              removeLoading={removeLoadingId === adminMember.user_id}
            />
          )}
          {/* Other members */}
          {otherMembers.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isAdmin={isAdmin}
              canManageTeam={canManageTeam}
              onRoleChange={handleUpdateRole}
              onRemove={handleRemoveMember}
              roleLoading={roleLoadingId === member.user_id}
              removeLoading={removeLoadingId === member.user_id}
            />
          ))}

          {members.length === 0 && (
            <div className="py-8 text-center text-slate-400 text-sm">No members yet.</div>
          )}
        </div>
      </div>

      {/* ── Pending Invitations ── */}
      {canManageTeam && pendingInvites.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-3xl p-6 shadow-sm">
          <h2 className="font-bold text-slate-900 flex items-center gap-2 mb-4 text-sm">
            <Clock className="w-4 h-4 text-amber-500" />
            Pending Invitations
            <span className="text-xs font-normal text-slate-400">({pendingInvites.length})</span>
          </h2>
          <div className="divide-y divide-slate-100">
            {pendingInvites.map((inv) => {
              const isExpired = new Date(inv.expires_at) < new Date();
              return (
                <div key={inv.id} className="flex items-center justify-between py-3.5">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{inv.email}</p>
                    <p className={`text-xs mt-0.5 ${isExpired ? 'text-red-400 font-semibold' : 'text-slate-400'}`}>
                      {isExpired ? '⚠️ Expired' : `Expires ${new Date(inv.expires_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isExpired ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                      {isExpired ? 'EXPIRED' : 'PENDING'}
                    </span>
                    <Button
                      onClick={() => handleResendInvitation(inv.id, inv.email)}
                      disabled={resendingId === inv.id}
                      variant="ghost"
                      size="icon"
                      className="text-blue-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg h-8 w-8"
                      title="Resend Invitation"
                    >
                      {resendingId === inv.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <SendHorizonal className="w-3.5 h-3.5" />}
                    </Button>
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
              );
            })}
          </div>
        </div>
      )}

      {/* ── Member Permissions Info ── */}
      {!isAdmin && (
        <div className={`border rounded-3xl p-6 ${isSubAdmin ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'}`}>
          <h2 className={`font-bold flex items-center gap-2 mb-3 text-sm ${isSubAdmin ? 'text-purple-900' : 'text-blue-900'}`}>
            <Shield className="w-4 h-4" /> Your Permissions
          </h2>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            {[
              { can: true, text: 'View all policies & customers' },
              { can: true, text: 'Add clients & upload policies' },
              { can: true, text: isSubAdmin ? 'Approve/reject changes' : 'Request edits or deletes' },
              { can: isSubAdmin, text: 'Delete records directly' },
              { can: isSubAdmin, text: 'Manage team or invite members' },
              { can: false, text: 'Access billing or change roles' },
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

// ─── MAIN PAGE ─────────────────────────────────────────────────────
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
        console.error('[TeamPage] API error:', json);
        setApiError(json.error || `Server error ${res.status}`);
        return;
      }

      setData(json);
    } catch {
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

  if (!data?.team) {
    return <CreateTeamPage />;
  }

  return <TeamViewPage data={data} onRefresh={fetchTeam} />;
}
