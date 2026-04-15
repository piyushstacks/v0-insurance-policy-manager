'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Mail, Trash2, Crown, UserX, Copy, CheckCircle,
  Loader2, Shield, AlertCircle, Clock, LogOut, RefreshCw,
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

export default function TeamSettingsPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchTeam = useCallback(async () => {
    try {
      const res = await fetch('/api/team');
      const json = await res.json();
      setData(json);
    } catch {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  async function handleCreateTeam() {
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/team', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('Team created!');
      setTeamName('');
      fetchTeam();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreating(false);
    }
  }

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
      fetchTeam();
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
      fetchTeam();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleLeaveTeam() {
    if (!confirm('Are you sure you want to leave this team?')) return;
    try {
      const res = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'leave' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      toast.success('You have left the team.');
      fetchTeam();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  // No team — offer to create one
  if (!data?.team) {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
          <p className="text-slate-500 mt-1">Create a team to collaborate with your colleagues.</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">Create Your Team</h2>
            <p className="text-slate-500 text-sm mt-1">You'll become the Admin and can invite colleagues to collaborate.</p>
          </div>
          <div className="flex gap-3 max-w-sm mx-auto">
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g. Apex Solutions"
              className="rounded-2xl"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
            />
            <Button
              onClick={handleCreateTeam}
              disabled={creating || !teamName.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl gap-2 shrink-0"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { team, role, members, invitations } = data;
  const isAdmin = role === 'ADMIN';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            {team.name}
          </h1>
          <span className={`inline-flex items-center gap-1 mt-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
            isAdmin ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
          }`}>
            {isAdmin ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
            {role}
          </span>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchTeam} variant="ghost" size="icon" className="rounded-xl">
            <RefreshCw className="w-4 h-4" />
          </Button>
          {!isAdmin && (
            <Button
              onClick={handleLeaveTeam}
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50 rounded-xl gap-2"
            >
              <LogOut className="w-4 h-4" /> Leave Team
            </Button>
          )}
        </div>
      </div>

      {/* Invite (Admin only) */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-600" /> Invite Member
          </h2>
          <div className="flex gap-3">
            <Input
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="colleague@company.com"
              type="email"
              className="rounded-2xl"
              onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
            />
            <Button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.includes('@')}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-2xl gap-2 shrink-0"
            >
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Send Invite
            </Button>
          </div>
          {inviteLink && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
              <p className="text-emerald-700 text-xs font-semibold mb-2">✅ Invite link created — share with your colleague:</p>
              <div className="flex gap-2 items-center">
                <code className="text-xs bg-white border border-emerald-200 text-slate-700 px-3 py-2 rounded-xl flex-1 truncate">
                  {inviteLink}
                </code>
                <Button
                  onClick={() => copyLink(inviteLink)}
                  size="sm"
                  variant="outline"
                  className="rounded-xl shrink-0 border-emerald-300"
                >
                  {copiedLink ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Members */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" /> Members ({members.length})
        </h2>
        <div className="divide-y divide-slate-100">
          {members.map((member) => (
            <div key={member.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                  {(member.user_profiles?.full_name || member.email || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-sm text-slate-800">
                    {member.user_profiles?.full_name || member.email || member.user_id.slice(0, 8)}
                  </p>
                  {member.email && <p className="text-xs text-slate-400">{member.email}</p>}
                  <p className="text-xs text-slate-400">
                    Joined {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  member.role === 'ADMIN' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
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
          ))}
        </div>
      </div>

      {/* Invitations (Admin only) */}
      {isAdmin && invitations && invitations.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" /> Pending Invitations
          </h2>
          <div className="divide-y divide-slate-100">
            {invitations.filter(i => i.status === 'PENDING').map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium text-sm text-slate-800">{inv.email}</p>
                  <p className="text-xs text-slate-400">
                    Expires {new Date(inv.expires_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                  PENDING
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member permissions info */}
      {!isAdmin && (
        <div className="bg-blue-50 border border-blue-200 rounded-3xl p-6">
          <h2 className="font-semibold text-blue-900 flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4" /> Your Permissions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {[
              { can: true, label: 'View all policies & customers' },
              { can: true, label: 'Add new clients & policies' },
              { can: true, label: 'Upload documents' },
              { can: true, label: 'Request edits or deletes' },
              { can: false, label: 'Delete records directly' },
              { can: false, label: 'Manage team or invite users' },
              { can: false, label: 'Access billing/financial data' },
              { can: false, label: 'Approve pending requests' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                {item.can
                  ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                }
                <span className={item.can ? 'text-slate-700' : 'text-slate-400'}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
