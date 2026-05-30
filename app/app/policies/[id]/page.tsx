'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Button as ActionButton } from '@/components/base/buttons/button';
import {
  ArrowLeft,
  Calendar,
  IndianRupee,
  FileText,
  Building,
  User,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  ExternalLink,
} from 'lucide-react';
import { PageLoader } from '@/components/ui/loader';
import { RoleActionButton } from '@/components/role-action-button';
import { useTeam } from '@/hooks/use-team';

interface Policy {
  id: string;
  policy_number: string;
  policy_type: string;
  start_date?: string;
  coverage_start?: string;
  expiry_date?: string;
  coverage_end?: string;
  premium_amount: number;
  status: 'active' | 'expired' | 'renewed' | 'cancelled';
  nominee?: string;
  agent_notes?: string;
  sum_insured?: number;
  created_at: string;
  updated_at: string;
  customer?: { name: string; email?: string; mobile?: string };
  insurer?: { name: string; contact?: string };
  reminder_preferences?: {
    enabled: boolean;
    email: boolean;
    timing_days: number[];
    types: string[];
  };
}

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  upload_date: string;
  extraction_status: 'pending' | 'extracted' | 'reviewed' | 'failed';
  created_at?: string;
}

export default function PolicyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const policyId = params.id as string;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [extractedData, setExtractedData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reExtractingDoc, setReExtractingDoc] = useState<string | null>(null);
  const { canDirectlyAct } = useTeam();

  useEffect(() => {
    async function fetchPolicy() {
      try {
        const res = await fetch(`/api/policies/${policyId}`);
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Failed to load policy');
        }
        const data = await res.json();
        setPolicy(data.policy ?? data);
        setDocuments(data.documents ?? []);
        setExtractedData(data.extractedData ?? {});
      } catch (err: any) {
        toast.error('Failed to load policy', { description: err.message });
      } finally {
        setIsLoading(false);
      }
    }
    fetchPolicy();
  }, [policyId]);

  async function handleReExtractDoc(docId: string) {
    if (!policy) return;
    setReExtractingDoc(docId);
    try {
      const res = await fetch('/api/extract/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId, policyId: policy.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Re-extraction started', { description: 'Check back in a moment for updated data.' });
      setDocuments(prev =>
        prev.map(d => d.id === docId ? { ...d, extraction_status: 'pending' } : d)
      );
    } catch (err: any) {
      toast.error('Re-extraction failed', { description: err.message });
    } finally {
      setReExtractingDoc(null);
    }
  }

  async function handleDelete() {
    if (!confirm('Delete this policy and all its documents? This cannot be undone.')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/policies/${policyId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete policy');
      toast.success('Policy deleted');
      router.push('/app/policies');
    } catch (err: any) {
      toast.error('Delete failed', { description: err.message });
      setIsDeleting(false);
    }
  }

  if (isLoading) {
    return <PageLoader words={['policy', 'coverage', 'premium', 'details', 'policy']} label="loading" />;
  }

  if (!policy) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
        <h2 className="text-xl font-semibold mb-2">Policy not found</h2>
        <Link href="/app/policies">
          <Button variant="outline">Back to Policies</Button>
        </Link>
      </div>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    expired: 'bg-red-100 text-red-800',
    renewed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-gray-100 text-gray-700',
  };

  const extractionColors: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-800 border-amber-200',
    extracted: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    reviewed: 'bg-blue-100 text-blue-800 border-blue-200',
    failed: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/app/policies">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold mb-1">{policy.policy_number}</h1>
            {(() => {
              const parts = policy.policy_type?.split(' | ') || [];
              const category = parts[0] || 'General';
              const subcat = parts[1] || '';
              return (
                 <div className="flex items-center gap-2">
                     <span className="bg-indigo-100 text-indigo-800 font-semibold px-2 py-0.5 rounded text-xs tracking-wider">{category}</span>
                     {subcat && <span className="text-muted-foreground text-sm">{subcat}</span>}
                 </div>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[policy.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {policy.status}
          </span>
          <RoleActionButton
            canDirectlyAct={canDirectlyAct}
            requestType="DELETE_POLICY"
            entityId={policyId}
            entityType="policy"
            directAction={handleDelete}
            label="Delete"
            icon={Trash2}
            variant="outline"
            size="sm"
            className="text-red-600 border-red-200 hover:bg-red-50"
            reasonPrompt="Why do you want to delete this policy?"
            metadata={{ policy_number: policy.policy_number }}
          />
        </div>
      </div>

      {/* ── Unified Policy Details Card ── */}
      {(() => {
        const fmt = (d: string | undefined) => {
          if (!d) return '—';
          const parsed = new Date(d);
          return isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        // Build the canonical field set from DB (always shown, never duplicated)
        const coreFields: { label: string; value: string }[] = [];

        if (policy.policy_number) coreFields.push({ label: 'Policy Number', value: policy.policy_number });
        if (policy.policy_type) {
          const parts = policy.policy_type.split(' | ');
          coreFields.push({ label: 'Policy Type', value: parts.join(' — ') });
        }
        if (policy.start_date || policy.coverage_start) coreFields.push({ label: 'Coverage Start', value: fmt(policy.start_date || policy.coverage_start) });
        if (policy.expiry_date || policy.coverage_end) coreFields.push({ label: 'Coverage End', value: fmt(policy.expiry_date || policy.coverage_end) });
        if (policy.premium_amount) coreFields.push({ label: 'Premium Amount', value: `₹${policy.premium_amount.toLocaleString('en-IN')}` });
        if (policy.sum_insured) coreFields.push({ label: 'Sum Insured', value: `₹${policy.sum_insured.toLocaleString('en-IN')}` });
        if (policy.customer?.name) coreFields.push({ label: 'Customer', value: policy.customer.name });
        if (policy.customer?.mobile) coreFields.push({ label: 'Mobile', value: policy.customer.mobile });
        if (policy.customer?.email) coreFields.push({ label: 'Email', value: policy.customer.email });
        if (policy.insurer?.name) coreFields.push({ label: 'Insurer', value: policy.insurer.name });
        if (policy.insurer?.contact) coreFields.push({ label: 'Insurer Contact', value: policy.insurer.contact });

        // Track which labels are already shown to avoid duplication
        const shownLabels = new Set(coreFields.map(f => f.label.toLowerCase()));

        // Field label map for AI data
        const fieldLabels: Record<string, string> = {
          policy_number: 'Policy Number',
          policy_type: 'Policy Type',
          policy_category: 'Category',
          policy_sub_category: 'Sub Category',
          coverage_start: 'Coverage Start',
          coverage_end: 'Coverage End',
          premium_amount: 'Premium Amount',
          sum_insured: 'Sum Insured',
          insurer_name: 'Insurer',
          customer_name: 'Customer',
          customer_email: 'Email',
          customer_mobile: 'Mobile',
          vehicle_number: 'Vehicle No',
          nominee_name: 'Nominee',
          health_ped: 'Health PED',
        };

        // Fields to always skip (raw HTML / internal)
        const skipKeys = new Set(['key_important_details', 'agent_notes']);

        // Extra fields from AI extraction not already shown
        const extraFields: { label: string; value: string }[] = [];
        Object.entries(extractedData).forEach(([key, value]) => {
          if (skipKeys.has(key)) return;
          if (value === null || value === undefined || value === '') return;
          const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          if (shownLabels.has(label.toLowerCase())) return; // already shown above
          let displayValue = String(value).replace(/<[^>]*>/g, '').trim();
          if (!displayValue) return;
          if ((key === 'coverage_start' || key === 'coverage_end') && !shownLabels.has(label.toLowerCase())) {
            try { displayValue = new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { }
          }
          if (key === 'premium_amount' && typeof value === 'number') {
            displayValue = `₹${value.toLocaleString('en-IN')}`;
          }
          extraFields.push({ label, value: displayValue });
        });

        const allFields = [...coreFields, ...extraFields];

        // Parse agent_notes / key_important_details for bullet items
        const rawNotes = extractedData.agent_notes || extractedData.key_important_details || policy.agent_notes;
        let bulletItems: string[] = [];
        if (rawNotes) {
          const raw = String(rawNotes);
          const liMatches = raw.match(/<li>(.*?)<\/li>/gi);
          if (liMatches && liMatches.length > 0) {
            bulletItems = liMatches.map(li => li.replace(/<[^>]*>/g, '').trim()).filter(Boolean);
          } else {
            bulletItems = raw.split(/\n|•/).map(s => s.replace(/<[^>]*>/g, '').trim()).filter(Boolean);
          }
        }

        return (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            {/* Card Header */}
            <div className="px-5 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-indigo-900 uppercase tracking-widest">Policy Details</h3>
            </div>

            {/* Main Fields Grid */}
            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {allFields.map(({ label, value }) => (
                <div key={label} className="bg-slate-50 rounded-lg border border-slate-200 px-4 py-3 hover:border-indigo-300 transition-colors">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                  <p className="font-semibold text-slate-800 text-sm break-words">{value}</p>
                </div>
              ))}
            </div>

            {/* Key Details Bullets */}
            {bulletItems.length > 0 && (
              <div className="px-5 pb-5 border-t border-slate-100 pt-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Key Details</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {bulletItems.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-2">
                      <span className="text-indigo-400 font-bold shrink-0 mt-0.5">›</span>
                      <p className="text-sm text-indigo-900 leading-snug">{item}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Documents ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-500" /> Documents
            {documents.length > 0 && (
              <span className="text-xs font-normal text-slate-400">({documents.length})</span>
            )}
          </h3>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
              <Upload className="w-6 h-6 text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No documents uploaded yet</p>
            <p className="text-xs text-slate-400 mt-1">Documents attached during upload will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
              const downloadUrl = doc.file_path
                ? `${supabaseUrl}/storage/v1/object/public/policy-documents/${doc.file_path}`
                : null;

              return (
                <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <FileText className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-900 truncate">{doc.file_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Uploaded {(doc.upload_date || doc.created_at) ? new Date(doc.upload_date || doc.created_at || '').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      doc.extraction_status === 'extracted' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      doc.extraction_status === 'failed'    ? 'bg-red-50 text-red-700 border-red-200' :
                      doc.extraction_status === 'reviewed'  ? 'bg-blue-50 text-blue-700 border-blue-200' :
                      'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {doc.extraction_status?.toUpperCase() ?? 'PENDING'}
                    </span>

                    {downloadUrl ? (
                      <a
                        href={downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={doc.file_name}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        title="Download document"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    ) : (
                      <span className="text-xs text-red-500">URL missing</span>
                    )}

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleReExtractDoc(doc.id)}
                      disabled={reExtractingDoc === doc.id}
                      title="Re-run AI extraction"
                      className="h-8 w-8 p-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${reExtractingDoc === doc.id ? 'animate-spin text-indigo-500' : 'text-slate-400'}`} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground flex items-center gap-4">
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Created {new Date(policy.created_at).toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <CheckCircle className="w-3 h-3" />
          Updated {new Date(policy.updated_at).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
