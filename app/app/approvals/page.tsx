'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell, CheckCircle, XCircle, Clock, Filter, ChevronDown,
  Loader2, Trash2, Edit, AlertTriangle, User, FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ActionRequest {
  id: string;
  type: string;
  entity_id: string;
  entity_type: string;
  requested_by: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string;
  note?: string;
  metadata?: any;
  created_at: string;
  reviewed_at?: string;
}

const TYPE_LABELS: Record<string, { label: string; icon: any; color: string }> = {
  DELETE_POLICY: { label: 'Delete Policy', icon: Trash2, color: 'text-red-500' },
  EDIT_POLICY: { label: 'Edit Policy', icon: Edit, color: 'text-amber-500' },
  DELETE_CUSTOMER: { label: 'Delete Customer', icon: Trash2, color: 'text-red-500' },
  EDIT_CUSTOMER: { label: 'Edit Customer', icon: Edit, color: 'text-amber-500' },
  DELETE_DOCUMENT: { label: 'Delete Document', icon: Trash2, color: 'text-red-500' },
};

export default function ApprovalCenterPage() {
  const [requests, setRequests] = useState<ActionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [processing, setProcessing] = useState<string | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'SUB_ADMIN' | 'MEMBER' | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const [teamRes, reqRes] = await Promise.all([
        fetch('/api/team'),
        fetch(`/api/team/requests${filter !== 'ALL' ? `?status=${filter}` : ''}`),
      ]);
      const teamData = await teamRes.json();
      const reqData = await reqRes.json();
      setRole(teamData.role);
      setRequests(reqData.requests || []);
    } catch {
      toast.error('Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleDecision(requestId: string, decision: 'APPROVED' | 'REJECTED', note?: string) {
    setProcessing(requestId);
    try {
      const res = await fetch('/api/team/requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, decision, note }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(decision === 'APPROVED' ? '✅ Request approved and executed' : '❌ Request rejected');
      fetchRequests();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setProcessing(null);
    }
  }

  const statusCounts = {
    PENDING: requests.filter(r => r.status === 'PENDING').length,
    APPROVED: requests.filter(r => r.status === 'APPROVED').length,
    REJECTED: requests.filter(r => r.status === 'REJECTED').length,
  };

  const displayed = filter === 'ALL' ? requests : requests.filter(r => r.status === filter);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="w-6 h-6 text-blue-600" />
            Approval Center
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {role === 'ADMIN' || role === 'SUB_ADMIN'
              ? 'Review and approve member action requests.'
              : 'Track your pending action requests.'}
          </p>
        </div>
        <Button onClick={fetchRequests} variant="ghost" size="icon" disabled={loading}>
          <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : 'opacity-0'}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { key: 'PENDING', label: 'Pending', color: 'amber', icon: Clock },
          { key: 'APPROVED', label: 'Approved', color: 'emerald', icon: CheckCircle },
          { key: 'REJECTED', label: 'Rejected', color: 'red', icon: XCircle },
        ].map(({ key, label, color, icon: Icon }) => (
          <div
            key={key}
            onClick={() => setFilter(key as any)}
            className={`cursor-pointer p-4 rounded-2xl border-2 transition-all ${
              filter === key
                ? `border-${color}-400 bg-${color}-50`
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <Icon className={`w-5 h-5 text-${color}-500 mb-1`} />
            <p className={`text-2xl font-bold text-${color}-600`}>{statusCounts[key as keyof typeof statusCounts]}</p>
            <p className="text-xs text-slate-500 font-medium">{label}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex gap-2">
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-3xl border border-slate-200">
          <Bell className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No {filter !== 'ALL' ? filter.toLowerCase() : ''} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((req) => {
            const typeInfo = TYPE_LABELS[req.type] || { label: req.type, icon: AlertTriangle, color: 'text-slate-500' };
            const TypeIcon = typeInfo.icon;
            const isPending = req.status === 'PENDING';

            return (
              <div
                key={req.id}
                className={`bg-white border rounded-2xl p-5 shadow-sm transition-all ${
                  isPending ? 'border-amber-200' : req.status === 'APPROVED' ? 'border-emerald-200' : 'border-red-100'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      req.type.startsWith('DELETE') ? 'bg-red-50' : 'bg-amber-50'
                    }`}>
                      <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">{typeInfo.label}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          req.status === 'PENDING' ? 'bg-amber-100 text-amber-700'
                          : req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                        }`}>
                          {req.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 font-mono truncate">
                        {req.entity_type}: {req.entity_id.slice(0, 20)}...
                      </p>
                      {req.reason && (
                        <p className="text-xs text-slate-600 mt-2 bg-slate-50 px-3 py-1.5 rounded-lg">
                          💬 "{req.reason}"
                        </p>
                      )}
                      {req.note && !isPending && (
                        <p className="text-xs text-blue-600 mt-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                          📝 Admin note: "{req.note}"
                        </p>
                      )}
                      <p className="text-xs text-slate-400 mt-2">
                        Requested {new Date(req.created_at).toLocaleString()}
                        {req.reviewed_at && ` · Reviewed ${new Date(req.reviewed_at).toLocaleString()}`}
                      </p>
                    </div>
                  </div>

                  {/* Admin/SubAdmin action buttons */}
                  {(role === 'ADMIN' || role === 'SUB_ADMIN') && isPending && (
                    <div className="flex gap-2 shrink-0">
                      <Button
                        onClick={() => {
                          const note = prompt('Add a note for the requester (optional):') || undefined;
                          handleDecision(req.id, 'REJECTED', note);
                        }}
                        disabled={processing === req.id}
                        variant="outline"
                        size="sm"
                        className="border-red-200 text-red-600 hover:bg-red-50 rounded-xl gap-1"
                      >
                        {processing === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Reject
                      </Button>
                      <Button
                        onClick={() => handleDecision(req.id, 'APPROVED')}
                        disabled={processing === req.id}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1"
                      >
                        {processing === req.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Approve
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
