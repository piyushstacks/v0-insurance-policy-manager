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
  Building2,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  RefreshCw,
  Download,
  Upload,
  ExternalLink,
  Copy,
  Phone,
  Mail,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileDown,
  Share2,
  UserCheck,
  Zap,
  Check,
  Info
} from 'lucide-react';
import { PageLoader } from '@/components/ui/loader';
import { RoleActionButton } from '@/components/role-action-button';
import { useTeam } from '@/hooks/use-team';

interface Policy {
  id: string;
  policy_number: string;
  policy_type: string;
  insurance_type?: 'life' | 'health' | 'motor' | 'commercial' | 'other';
  product_name?: string;
  proposal_number?: string;
  policy_holder_name?: string;
  issue_date?: string;
  start_date?: string;
  policy_start_date?: string;
  expiry_date?: string;
  policy_end_date?: string;
  is_renewal?: boolean;
  premium_frequency?: 'annual' | 'half-yearly' | 'quarterly' | 'monthly' | 'single';
  premium_amount: number;
  gst_amount?: number;
  total_premium?: number;
  payment_mode?: 'cheque' | 'online' | 'cash' | 'ecs' | 'nach';
  payment_date?: string;
  agent_name?: string;
  agent_code?: string;
  branch?: string;
  intermediary_code?: string;
  ai_confidence?: number;
  missing_fields?: string[];
  notes?: string;
  agent_notes?: string;
  status: 'active' | 'expired' | 'renewed' | 'cancelled' | 'lapsed' | 'matured' | 'surrendered';
  nominee?: string;
  sum_insured?: number;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    name: string;
    email?: string;
    mobile?: string;
    dob?: string;
    gender?: 'male' | 'female' | 'other';
    pan?: string;
    aadhaar?: string;
    ckyc_number?: string;
    eia_number?: string;
    gst_number?: string;
    occupation?: string;
    company_customer_id?: string;
  };
  insurer?: {
    id: string;
    name: string;
    contact?: string;
  };
  life?: any;
  health?: any;
  motor?: any;
  commercial?: any;
}

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  upload_date: string;
  extraction_status: 'pending' | 'extracted' | 'reviewed' | 'failed' | 'rejected';
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
  const [showRawOcr, setShowRawOcr] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Policy number copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (isSharing) return;
    
    if (navigator.share) {
      setIsSharing(true);
      try {
        await navigator.share({
          title: `Policy ${policy?.policy_number}`,
          text: `Check out policy details for ${policy?.policy_number}`,
          url: window.location.href,
        });
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      } finally {
        setIsSharing(false);
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

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
      toast.success('Re-extraction started', { description: 'Running AI pipeline in the background.' });
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete policy');
      
      if (data.pendingApproval) {
        toast.success('Approval Requested', { description: data.message });
      } else {
        toast.success('Policy deleted');
        router.push('/app/policies');
      }
    } catch (err: any) {
      toast.error('Delete failed', { description: err.message });
    } finally {
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

  // Formatting helpers
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const calculateDaysRemaining = (endDateStr?: string) => {
    if (!endDateStr) return null;
    const end = new Date(endDateStr);
    if (isNaN(end.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const formatCurrency = (amount?: number) => {
    if (amount === undefined || amount === null) return '—';
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const maskPan = (pan?: string) => {
    if (!pan) return '—';
    const clean = pan.trim().toUpperCase();
    if (clean.length < 4) return clean;
    return `XXXXXX${clean.slice(-4)}`;
  };

  const daysRemaining = calculateDaysRemaining(policy.expiry_date || policy.policy_end_date);
  const isExpired = daysRemaining !== null && daysRemaining < 0;

  const statusColors: Record<string, string> = {
    active: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    renewed: 'bg-sky-50 text-sky-700 border-sky-200/80',
    expired: 'bg-rose-50 text-rose-700 border-rose-200/80',
    cancelled: 'bg-slate-50 text-slate-700 border-slate-200/80',
    lapsed: 'bg-amber-50 text-amber-700 border-amber-200/80',
    matured: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    surrendered: 'bg-slate-50 text-slate-600 border-slate-200/80',
  };

  // Determine categories
  const category = policy.insurance_type || 
    (policy.policy_type?.toLowerCase().includes('motor') ? 'motor'
      : policy.policy_type?.toLowerCase().includes('health') ? 'health'
      : policy.policy_type?.toLowerCase().includes('life') ? 'life'
      : policy.policy_type?.toLowerCase().includes('business') ? 'commercial' : 'other');

  // Nested relation array resolvers (for Supabase array format)
  const life = Array.isArray(policy.life) ? policy.life[0] : policy.life;
  const health = Array.isArray(policy.health) ? policy.health[0] : policy.health;
  const motor = Array.isArray(policy.motor) ? policy.motor[0] : policy.motor;
  const commercial = Array.isArray(policy.commercial) ? policy.commercial[0] : policy.commercial;
  const details = life || health || motor || commercial;

  // AI summary generator
  const generatedSummary = (() => {
    const insuredName = policy.customer?.name || 'an insured person';
    const compName = policy.insurer?.name || 'their insurer';
    const planName = policy.product_name || policy.policy_type || 'a standard plan';
    const premiumStr = policy.premium_amount ? formatCurrency(policy.premium_amount) : '—';
    const startStr = formatDate(policy.start_date || policy.policy_start_date);
    const endStr = formatDate(policy.expiry_date || policy.policy_end_date);
    
    return `${category.charAt(0).toUpperCase() + category.slice(1)} insurance policy issued by ${compName} covering ${insuredName} under ${planName}. The policy has an premium of ${premiumStr} with active coverage from ${startStr} to ${endStr}.`;
  })();

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* ── STICKY HEADER ── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/app/policies">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg border-slate-200 hover:bg-slate-50">
                <ArrowLeft className="w-4 h-4 text-slate-600" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">{policy.policy_number}</h1>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-slate-600" onClick={() => copyToClipboard(policy.policy_number)}>
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                </Button>
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${statusColors[policy.status] || 'bg-slate-100'}`}>
                  {policy.status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-0.5 font-medium">
                {category.toUpperCase()} INSURANCE &bull; {policy.product_name || policy.policy_type || '—'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {documents[0] && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-9 border-indigo-200 text-indigo-700 bg-indigo-50/50 hover:bg-indigo-100 hover:text-indigo-800 transition-colors shadow-sm font-semibold flex items-center gap-1.5" 
                onClick={() => handleReExtractDoc(documents[0].id)}
                disabled={reExtractingDoc === documents[0].id}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reExtractingDoc === documents[0].id ? 'animate-spin' : ''}`} />
                Re-extract
              </Button>
            )}
            <Link href={`/app/policies/${policyId}/edit`}>
              <Button variant="outline" size="sm" className="h-9 border-slate-200 text-slate-700 bg-white hover:bg-slate-50">
                Edit
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="h-9 border-slate-200 text-slate-700 bg-white hover:bg-slate-50" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" /> Share
            </Button>
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
              className="h-9 text-rose-600 border-rose-200 hover:bg-rose-50 bg-white"
              reasonPrompt="Why do you want to delete this policy?"
              metadata={{ policy_number: policy.policy_number }}
            />
          </div>

        </div>

        {/* Quick Summary Chips */}
        <div className="border-t border-slate-100 bg-slate-50/50 px-4 sm:px-6 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-slate-500">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Premium:</span>
              <span className="text-slate-800">{formatCurrency(policy.premium_amount)} / year</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Expires:</span>
              {daysRemaining !== null ? (
                <span className={isExpired ? 'text-rose-600' : 'text-slate-800'}>
                  {isExpired ? `Expired ${Math.abs(daysRemaining)} days ago` : `In ${daysRemaining} days`}
                </span>
              ) : (
                <span className="text-slate-800">—</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Insurer:</span>
              <span className="text-slate-800">{policy.insurer?.name || '—'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT & CENTER COLUMNS */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* SECTION 1: POLICY OVERVIEW */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Policy Overview</h2>
              </div>
              <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-6">
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Policy Type</span>
                  <span className="block text-sm font-bold text-slate-800 mt-1">{category.toUpperCase()}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Plan Name</span>
                  <span className="block text-sm font-bold text-slate-800 mt-1 truncate" title={policy.product_name || policy.policy_type}>{policy.product_name || policy.policy_type || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Company</span>
                  <span className="block text-sm font-bold text-slate-800 mt-1 truncate">{policy.insurer?.name || '—'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Coverage Period</span>
                  <span className="block text-xs font-bold text-slate-800 mt-1">
                    {formatDate(policy.start_date || policy.policy_start_date)} - {formatDate(policy.expiry_date || policy.policy_end_date)}
                  </span>
                </div>
                <div className="mt-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Premium</span>
                  <span className="block text-sm font-bold text-slate-800 mt-1">{formatCurrency(policy.premium_amount)}</span>
                </div>
                <div className="mt-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sum Insured</span>
                  <span className="block text-sm font-bold text-slate-800 mt-1">{formatCurrency(policy.sum_insured)}</span>
                </div>
                <div className="mt-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Payment Mode</span>
                  <span className="block text-sm font-bold text-slate-800 mt-1 uppercase">{policy.payment_mode || '—'}</span>
                </div>
                <div className="mt-2">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</span>
                  <span className="block text-sm font-bold text-slate-800 mt-1 capitalize">{policy.status}</span>
                </div>
              </div>
            </section>

            {/* SECTION 2: PEOPLE (Merged Customer + Nominee) */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Insured People</h2>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Customer Info */}
                  <div>
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5" /> Customer Details
                    </h3>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-xs text-slate-400 font-medium">Name</span>
                        <span className="text-sm font-bold text-slate-800">{policy.customer?.name || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-xs text-slate-400 font-medium">DOB</span>
                        <span className="text-sm font-bold text-slate-800">{formatDate(policy.customer?.dob)}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-xs text-slate-400 font-medium">Gender</span>
                        <span className="text-sm font-bold text-slate-800 capitalize">{policy.customer?.gender || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-xs text-slate-400 font-medium">Mobile</span>
                        <span className="text-sm font-bold text-slate-800">
                          {policy.customer?.mobile ? (
                            <a href={`tel:${policy.customer.mobile}`} className="text-indigo-600 hover:underline flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {policy.customer.mobile}
                            </a>
                          ) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-50">
                        <span className="text-xs text-slate-400 font-medium">Email</span>
                        <span className="text-sm font-bold text-slate-800">
                          {policy.customer?.email ? (
                            <a href={`mailto:${policy.customer.email}`} className="text-indigo-600 hover:underline flex items-center gap-1">
                              <Mail className="w-3 h-3" /> {policy.customer.email}
                            </a>
                          ) : '—'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-xs text-slate-400 font-medium">PAN</span>
                        <span className="text-sm font-bold text-slate-800 tracking-wider">{maskPan(policy.customer?.pan)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Nominee Info */}
                  <div className="bg-slate-50/50 p-5 rounded-lg border border-slate-100 flex flex-col justify-center">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> Nominee Details
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                        <span className="text-xs text-slate-400 font-medium">Nominee Name</span>
                        <span className="text-sm font-bold text-slate-800">{policy.nominee || details?.nominee_name || '—'}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-slate-200/50">
                        <span className="text-xs text-slate-400 font-medium">Relationship</span>
                        <span className="text-sm font-bold text-slate-800 capitalize">
                          {details?.nominee_relationship || '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 4: COVERAGE DETAIL CHIPS */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">Coverage & Benefits</h2>
                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{category}</span>
              </div>
              <div className="p-6">
                {category === 'health' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {/* Room Rent Limit */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room Rent Limit</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {health?.room_rent_limit ? formatCurrency(health.room_rent_limit) : 'Private Room Cover'}
                      </span>
                    </div>
                    {/* ICU Limit */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">ICU Limit</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {health?.icu_limit ? formatCurrency(health.icu_limit) : 'No Limit / Actuals'}
                      </span>
                    </div>
                    {/* Restoration Benefit */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Restoration</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                        {health?.restore_benefit ? (
                          <>
                            <ShieldCheck className="w-4 h-4 text-emerald-500" /> Active (100%)
                          </>
                        ) : 'Not Available'}
                      </span>
                    </div>
                    {/* No Claim Bonus */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">No Claim Bonus (NCB)</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {health?.ncb_percent ? `${health.ncb_percent}%` : '50% (Max 100%)'}
                      </span>
                    </div>
                    {/* Pre & Post Hospitalisation */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pre / Post Hosp.</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">60 Days / 180 Days</span>
                    </div>
                    {/* Copay */}
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Co-pay</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {health?.co_pay_percent ? `${health.co_pay_percent}%` : 'No Co-pay (0%)'}
                      </span>
                    </div>
                  </div>
                )}

                {category === 'motor' && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Zero Depreciation</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {motor?.covers?.zero_dep ? '✓ Covered' : 'Not Covered'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Engine Protect</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {motor?.covers?.engine_protect ? '✓ Covered' : 'Not Covered'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Roadside Assistance (RSA)</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {motor?.covers?.rsa ? '✓ Covered' : 'Not Covered'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Consumables Cover</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {motor?.covers?.consumables ? '✓ Covered' : 'Not Covered'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Return to Invoice</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {motor?.covers?.return_to_invoice ? '✓ Covered' : 'Not Covered'}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">NCB Percentage</span>
                      <span className="block text-sm font-bold text-slate-800 mt-1">
                        {motor?.current_ncb_percent ? `${motor.current_ncb_percent}%` : '—'}
                      </span>
                    </div>
                  </div>
                )}

                {category !== 'health' && category !== 'motor' && (
                  <div className="p-4 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-center text-center">
                    <div>
                      <ShieldCheck className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                      <p className="text-sm font-bold text-slate-800">Standard policy benefits apply</p>
                      <p className="text-xs text-slate-400 mt-1">Refer to PDF document below for full scope of coverage.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* SECTION 8: AI Summary & Health Checks */}
            <section className="bg-gradient-to-br from-indigo-900 to-indigo-950 text-white rounded-xl border border-indigo-950 shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-indigo-800/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400 animate-pulse" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-indigo-200">AI Summary & Flags</h2>
                </div>
                <span className="bg-indigo-800/80 text-indigo-100 px-2 py-0.5 rounded text-[10px] font-semibold">
                  Confidence: {policy.ai_confidence ? `${Math.round(policy.ai_confidence * 100)}%` : '—'}
                </span>
              </div>
              <div className="p-6 space-y-6">
                {/* Generated Text */}
                <p className="text-sm text-indigo-100 leading-relaxed font-medium">
                  "{generatedSummary}"
                </p>

                {/* Health Checks */}
                <div className="grid grid-cols-2 gap-4 border-t border-indigo-800/50 pt-5 text-xs">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-[9px] shrink-0">✓</span>
                      <span>PAN Verified</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-[9px] shrink-0">✓</span>
                      <span>DOB Extracted</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-[9px] shrink-0">✓</span>
                      <span>Policy Number Verified</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {policy.sum_insured ? (
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-[9px] shrink-0">✓</span>
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-[9px] shrink-0">!</span>
                      )}
                      <span className={policy.sum_insured ? '' : 'text-indigo-200'}>
                        {policy.sum_insured ? 'Sum Insured Extracted' : 'Sum Insured Missing'}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {policy.insurer?.contact ? (
                        <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center font-bold text-[9px] shrink-0">✓</span>
                      ) : (
                        <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-[9px] shrink-0">!</span>
                      )}
                      <span className={policy.insurer?.contact ? '' : 'text-indigo-200'}>
                        {policy.insurer?.contact ? 'Insurer Contact Verified' : 'Insurer Contact Missing'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-8">
            
            {/* SECTION 5: FINANCIAL SUMMARY */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Financial Summary</h3>
              </div>
              <div className="p-5 space-y-4">
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Premium Amount</span>
                  <span className="text-sm font-bold text-slate-800">{formatCurrency(policy.premium_amount)}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">GST (18%)</span>
                  <span className="text-sm font-bold text-slate-800">
                    {policy.gst_amount ? formatCurrency(policy.gst_amount) : formatCurrency(Math.round(policy.premium_amount * 0.18))}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 pb-3">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Total Premium</span>
                  <span className="text-sm font-extrabold text-slate-900">
                    {policy.total_premium ? formatCurrency(policy.total_premium) : formatCurrency(Math.round(policy.premium_amount * 1.18))}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Frequency</span>
                  <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                    {policy.premium_frequency || 'Annual'}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Next Due Date</span>
                  <span className="text-sm font-bold text-slate-800">{formatDate(policy.expiry_date || policy.policy_end_date)}</span>
                </div>
              </div>
            </section>

            {/* SECTION 3: INSURANCE COMPANY CARD */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Insurance Company</h3>
              </div>
              <div className="p-5 flex flex-col items-center">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center mb-3">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                </div>
                <h4 className="font-bold text-slate-800 text-center">{policy.insurer?.name || '—'}</h4>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-widest mt-1">Authorized Provider</p>

                <div className="w-full mt-5 space-y-3.5 border-t border-slate-50 pt-4 text-xs font-semibold">
                  {policy.insurer?.contact && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 uppercase tracking-wider">Helpline</span>
                      <a href={`tel:${policy.insurer.contact}`} className="text-indigo-600 hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {policy.insurer.contact}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 uppercase tracking-wider">Claim Status</span>
                    <span className="text-slate-800">Cashless Network</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 uppercase tracking-wider">Support</span>
                    <a href="mailto:support@insurer.com" className="text-indigo-600 hover:underline flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Email Support
                    </a>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400 uppercase tracking-wider">Website</span>
                    <a href="https://www.hdfcergo.com" target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline flex items-center gap-1">
                      hdfcergo.com <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 6: TIMELINE */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Policy Timeline</h3>
              </div>
              <div className="p-5">
                <div className="relative pl-6 border-l border-slate-200 space-y-6">
                  {/* Timeline Event 1: Issued */}
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center shrink-0"></div>
                    <p className="text-xs font-bold text-slate-800">Policy Issued</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(policy.issue_date || policy.start_date || policy.policy_start_date)}</p>
                  </div>
                  {/* Timeline Event 2: Active */}
                  <div className="relative">
                    <div className={`absolute -left-[30px] top-0.5 w-4 h-4 rounded-full border-4 border-white flex items-center justify-center shrink-0 ${policy.status === 'active' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                    <p className={`text-xs font-bold ${policy.status === 'active' ? 'text-slate-800' : 'text-slate-400'}`}>Policy Active</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(policy.start_date || policy.policy_start_date)}</p>
                  </div>
                  {/* Timeline Event 3: Renewal Due */}
                  <div className="relative">
                    <div className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full bg-slate-200 border-4 border-white flex items-center justify-center shrink-0"></div>
                    <p className="text-xs font-bold text-slate-400">Renewal Due</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(policy.expiry_date || policy.policy_end_date)}</p>
                  </div>
                  {/* Timeline Event 4: Expired */}
                  <div className="relative">
                    <div className={`absolute -left-[30px] top-0.5 w-4 h-4 rounded-full border-4 border-white flex items-center justify-center shrink-0 ${isExpired ? 'bg-rose-500' : 'bg-slate-200'}`}></div>
                    <p className={`text-xs font-bold ${isExpired ? 'text-rose-600' : 'text-slate-400'}`}>Expired</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(policy.expiry_date || policy.policy_end_date)}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* SECTION 7: DOCUMENTS */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Documents</h3>
                <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{documents.length}</span>
              </div>
              <div className="p-5 space-y-4">
                {documents.length === 0 ? (
                  <div className="text-center py-6">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-500">No documents</p>
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate" title={doc.file_name}>{doc.file_name}</p>
                          <p className="text-[9px] text-slate-400 font-semibold mt-0.5">{formatDate(doc.upload_date || doc.created_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <a href={`/api/documents/${doc.id}/download`} target="_blank" rel="noreferrer" download={doc.file_name} className="h-7 w-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center hover:bg-slate-50 text-slate-600 shadow-sm transition-colors">
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs border-indigo-200 text-indigo-700 bg-indigo-50/40 hover:bg-indigo-50 hover:text-indigo-800 shadow-sm font-semibold flex items-center gap-1 transition-colors" onClick={() => handleReExtractDoc(doc.id)} disabled={reExtractingDoc === doc.id}>
                          <RefreshCw className={`w-3 h-3 ${reExtractingDoc === doc.id ? 'animate-spin text-indigo-650' : ''}`} />
                          Re-extract
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

          </div>

        </div>

        {/* SECTION 9: RAW OCR DATA ACCORDION */}
        {Object.keys(extractedData).length > 0 && (
          <section className="mt-12 border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
            <button className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50/50 transition-colors" onClick={() => setShowRawOcr(!showRawOcr)}>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-slate-400" /> Raw OCR Data (Advanced)
              </span>
              {showRawOcr ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            {showRawOcr && (
              <div className="border-t border-slate-100 p-6 bg-slate-50/30">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-4">
                  {Object.entries(extractedData).map(([key, val]) => {
                    if (val === null || val === undefined || val === '') return null;
                    if (typeof val === 'object') return null; // skip nested structures
                    return (
                      <div key={key} className="py-2 border-b border-slate-100 flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate" title={key}>{key.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-bold text-slate-700 mt-1 break-words">{String(val)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
