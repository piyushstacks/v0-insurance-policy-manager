'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

interface Policy {
  id: string;
  policy_number: string;
  policy_type: string;
  start_date: string;
  expiry_date: string;
  premium_amount: number;
  status: 'active' | 'expired' | 'renewed' | 'cancelled';
  vehicle_number?: string;
  nominee?: string;
  agent_notes?: string;
  sum_insured?: number;
  created_at: string;
  updated_at: string;
  customer?: { name: string; email?: string; mobile?: string };
  insurer?: { name: string; contact?: string };
}

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  upload_date: string;
  extraction_status: 'pending' | 'extracted' | 'reviewed' | 'failed';
}

export default function PolicyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const policyId = params.id as string;

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reExtractingDoc, setReExtractingDoc] = useState<string | null>(null);

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
    return (
      <div className="flex items-center justify-center h-full min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
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
    pending: 'bg-yellow-100 text-yellow-800',
    extracted: 'bg-green-100 text-green-800',
    reviewed: 'bg-blue-100 text-blue-800',
    failed: 'bg-red-100 text-red-800',
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
            <h1 className="text-2xl font-bold">{policy.policy_number}</h1>
            <p className="text-muted-foreground text-sm">{policy.policy_type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[policy.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {policy.status}
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Core Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Coverage</h3>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Start Date</p>
              <p className="font-medium">{new Date(policy.start_date).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="font-medium">{new Date(policy.expiry_date).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3 shadow-sm">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Financial</h3>
          <div className="flex items-center gap-3">
            <IndianRupee className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Premium Amount</p>
              <p className="font-medium">₹{policy.premium_amount?.toLocaleString('en-IN')}</p>
            </div>
          </div>
          {policy.sum_insured && (
            <div className="flex items-center gap-3">
              <IndianRupee className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Sum Insured</p>
                <p className="font-medium">₹{policy.sum_insured?.toLocaleString('en-IN')}</p>
              </div>
            </div>
          )}
        </div>

        {policy.customer && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Customer</h3>
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{policy.customer.name}</p>
                {policy.customer.mobile && <p className="text-sm text-muted-foreground">{policy.customer.mobile}</p>}
                {policy.customer.email && <p className="text-sm text-muted-foreground">{policy.customer.email}</p>}
              </div>
            </div>
          </div>
        )}

        {policy.insurer && (
          <div className="rounded-lg border bg-card p-4 space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Insurer</h3>
            <div className="flex items-center gap-3">
              <Building className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="font-medium">{policy.insurer.name}</p>
                {policy.insurer.contact && <p className="text-sm text-muted-foreground">{policy.insurer.contact}</p>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Extra Details */}
      {(policy.vehicle_number || policy.nominee || policy.agent_notes) && (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Additional Details</h3>
          {policy.vehicle_number && (
            <div><span className="text-xs text-muted-foreground">Vehicle: </span><span className="font-medium">{policy.vehicle_number}</span></div>
          )}
          {policy.nominee && (
            <div><span className="text-xs text-muted-foreground">Nominee: </span><span className="font-medium">{policy.nominee}</span></div>
          )}
          {policy.agent_notes && (
            <div><span className="text-xs text-muted-foreground">Notes: </span><span>{policy.agent_notes}</span></div>
          )}
        </div>
      )}

      {/* Documents */}
      <div className="rounded-lg border bg-card p-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">Documents</h3>
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No documents uploaded yet.</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30">
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.upload_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvueurxfbdrfbdanxbnl.supabase.co'}/storage/v1/object/public/policy-documents/${doc.file_path}`} 
                     target="_blank" 
                     rel="noreferrer"
                     className="px-3 py-1 text-xs font-semibold bg-indigo-50 text-indigo-600 rounded hover:bg-indigo-100 transition-colors">
                     Download original PDF
                  </a>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${extractionColors[doc.extraction_status] ?? 'bg-gray-100 text-gray-700'}`}>
                    {doc.extraction_status}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleReExtractDoc(doc.id)}
                    disabled={reExtractingDoc === doc.id}
                    title="Re-run extraction"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${reExtractingDoc === doc.id ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
              </div>
            ))}
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
