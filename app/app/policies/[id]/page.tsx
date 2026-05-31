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
          <Link href={`/app/policies/${policyId}/edit`}>
            <Button variant="outline" size="sm" className="bg-white hover:bg-slate-50 border-slate-200 text-slate-700">
              Edit Policy
            </Button>
          </Link>
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

      {/* ── Unified Policy Details Dashboard ── */}
      {(() => {
        const fmt = (d: string | undefined) => {
          if (!d) return '—';
          const parsed = new Date(d);
          return isNaN(parsed.getTime()) ? d : parsed.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
        };

        const notes = String(policy.agent_notes || extractedData.agent_notes || extractedData.key_important_details || policy.agent_notes || '');

        // Helper to format values consistently
        const clean = (val: any): string => {
          if (val === null || val === undefined || val === '') return '—';
          return String(val).replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '').trim() || '—';
        };

        // Regex helpers
        const getMatch = (patterns: RegExp[]): string => {
          for (const pattern of patterns) {
            const match = notes.match(pattern);
            if (match && match[1]) {
              return clean(match[1]);
            }
          }
          return '—';
        };

        const isMotor = policy.policy_type?.toLowerCase().includes('motor') ||
                        policy.policy_type?.toLowerCase().includes('vehicle') ||
                        policy.policy_type?.toLowerCase().includes('car') ||
                        policy.policy_type?.toLowerCase().includes('bike') ||
                        policy.policy_type?.toLowerCase().includes('two wheeler') ||
                        notes.toLowerCase().includes('registration') ||
                        notes.toLowerCase().includes('chassis') ||
                        notes.toLowerCase().includes('engine no');

        const isHealth = policy.policy_type?.toLowerCase().includes('health') ||
                         policy.policy_type?.toLowerCase().includes('medical') ||
                         policy.policy_type?.toLowerCase().includes('mediclaim') ||
                         notes.toLowerCase().includes('ped') ||
                         notes.toLowerCase().includes('pre-existing') ||
                         notes.toLowerCase().includes('tpa');

        // ── CUSTOMER & INSURER FIELDS ──
        const customerName = clean(policy.customer?.name || extractedData.customer_name || getMatch([
          /(?:Customer|Insured|Proposer)(?:\s*Name)?:\s*([^\n<|•]+)/i,
          /(?:Name\s*of\s*Insured|Name\s*of\s*Proposer):\s*([^\n<|•]+)/i
        ]));

        const customerMobile = clean(policy.customer?.mobile || extractedData.customer_mobile || getMatch([
          /(?:Mobile|Phone|Contact|Customer\s*Mobile):\s*([^\n<|•]+)/i
        ]));

        const customerEmail = clean(policy.customer?.email || extractedData.customer_email || getMatch([
          /(?:Email|E-mail|Customer\s*Email):\s*([^\n<|•]+)/i
        ]));

        const nomineeVal = clean(policy.nominee || extractedData.nominee_name || getMatch([
          /(?:Nominee(?:\s*Name)?):\s*([^\n<|•]+)/i
        ]));

        const customerFields = [
          { label: 'Customer Name', value: customerName },
          { label: 'Mobile Number', value: customerMobile },
          { label: 'Email Address', value: customerEmail },
          { label: 'Nominee Name', value: nomineeVal }
        ];

        const insurerName = clean(policy.insurer?.name || extractedData.insurer_name || getMatch([
          /(?:Insurer|Company)(?:\s*Name)?:\s*([^\n<|•]+)/i,
          /(?:Name\s*of\s*Insurer):\s*([^\n<|•]+)/i
        ]));

        const insurerContact = clean(policy.insurer?.contact || getMatch([
          /(?:Insurer\s*Contact|Helpline|Toll\s*Free|Insurer\s*Phone):\s*([^\n<|•]+)/i
        ]));

        const insurerFields = [
          { label: 'Insurer Name', value: insurerName },
          { label: 'Insurer Contact', value: insurerContact }
        ];

        // ── COVERAGE & FINANCIAL FIELDS ──
        const policyNumber = clean(policy.policy_number || extractedData.policy_number || getMatch([
          /(?:Policy\s*Number|Policy\s*No\.?):\s*([^\n<|•]+)/i
        ]));

        let policyType = '—';
        if (policy.policy_type) {
          const parts = policy.policy_type.split(' | ');
          policyType = parts.join(' — ');
        } else {
          policyType = clean(extractedData.policy_type || extractedData.policy_category || getMatch([
            /(?:Policy\s*Type|Category|Plan\s*Type):\s*([^\n<|•]+)/i
          ]));
        }

        const coverageStart = clean(fmt(policy.start_date || policy.coverage_start || getMatch([
          /(?:Coverage\s*Start|Start\s*Date|From\s*Date|Risk\s*Commencement):\s*([^\n<|•]+)/i
        ])));

        const coverageEnd = clean(fmt(policy.expiry_date || policy.coverage_end || getMatch([
          /(?:Coverage\s*End|Expiry\s*Date|To\s*Date|Valid\s*Up\s*to):\s*([^\n<|•]+)/i
        ])));

        let premiumAmount = '—';
        if (policy.premium_amount) {
          premiumAmount = `₹${policy.premium_amount.toLocaleString('en-IN')}`;
        } else {
          const premVal = extractedData.premium_amount || getMatch([
            /(?:Premium|Premium\s*Amount|Net\s*Premium|Total\s*Premium):\s*(?:₹|Rs\.?\s*)?([0-9,]+(?:\.\d{2})?|[^\n<|•]+)/i
          ]);
          if (premVal !== '—') {
            const num = parseFloat(premVal.replace(/[^\d.]/g, ''));
            premiumAmount = isNaN(num) ? premVal : `₹${num.toLocaleString('en-IN')}`;
          }
        }

        let sumInsured = '—';
        if (policy.sum_insured) {
          sumInsured = `₹${policy.sum_insured.toLocaleString('en-IN')}`;
        } else {
          const siVal = extractedData.sum_insured || extractedData.sum_assured || getMatch([
            /(?:Sum\s*(?:Insured|Assured)|Cover\s*Amount|Cover\s*Limit|Coverage\s*Limit|Basic\s*Sum\s*Insured):\s*(?:₹|Rs\.?\s*)?([0-9,]+(?:\.\d{2})?|[^\n<|•]+)/i
          ]);
          if (siVal !== '—') {
            const num = parseFloat(siVal.replace(/[^\d.]/g, ''));
            sumInsured = isNaN(num) ? siVal : `₹${num.toLocaleString('en-IN')}`;
          }
        }

        const planName = clean(extractedData.plan_name || extractedData.product_name || getMatch([
          /(?:Plan(?:\s*Name)?|Product(?:\s*Name)?|Scheme(?:\s*Name)?):\s*([^\n<|•]+)/i
        ]));

        const coverageFinancialFields = [
          { label: 'Policy Number', value: policyNumber },
          { label: 'Policy Type', value: policyType },
          { label: 'Plan Name', value: planName },
          { label: 'Coverage Period', value: (coverageStart !== '—' || coverageEnd !== '—') ? `${coverageStart} TO ${coverageEnd}`.toUpperCase() : '—' },
          { label: 'Premium Amount', value: premiumAmount },
          { label: 'Sum Insured / Assured', value: sumInsured }
        ];

        // ── MOTOR DETAILS EXTRACTION ──
        const regVal = clean(extractedData.vehicle_number || getMatch([
          /(?:Registration\s*No\.?|Reg\s*No\.?|Vehicle\s*No\.?|Registration\s*Number):\s*([^\n<|•]+)/i
        ]));
        const chassisVal = clean(getMatch([
          /(?:Chassis\s*No\.?|Chassis(?:\s*Number)?):\s*([A-Z0-9]+|[^\n<|•]+)/i
        ]));
        const engineVal = clean(getMatch([
          /(?:Engine\s*No\.?|Engine(?:\s*Number)?):\s*([A-Z0-9]+|[^\n<|•]+)/i
        ]));
        let idvVal = '—';
        const rawIdv = getMatch([
          /(?:IDV|Insured\s*Declared\s*Value):\s*(?:₹|Rs\.?\s*)?([0-9,]+(?:\.\d{2})?|[^\n<|•]+)/i
        ]);
        if (rawIdv !== '—') {
          idvVal = rawIdv.startsWith('₹') ? rawIdv : `₹${rawIdv}`;
        }
        const fuelVal = clean(getMatch([
          /(?:Fuel\s*Type|Fuel):\s*([^\n<|•]+)/i
        ]));
        const bodyVal = clean(getMatch([
          /(?:Body\s*Type|Vehicle\s*Type):\s*([^\n<|•]+)/i
        ]));
        const yearVal = clean(getMatch([
          /(?:Year|YOM|Year\s*of\s*Manufacture|Manufacturing\s*Year):\s*([0-9]{4}|[^\n<|•]+)/i
        ]));

        const motorFields = [
          { label: 'Registration No', value: regVal },
          { label: 'Chassis No', value: chassisVal },
          { label: 'Engine No', value: engineVal },
          { label: 'IDV (Insured Declared Value)', value: idvVal },
          { label: 'Fuel Type', value: fuelVal },
          { label: 'Body Type', value: bodyVal },
          { label: 'Year of Manufacture', value: yearVal }
        ];

        // ── HEALTH DETAILS EXTRACTION ──
        const pedVal = clean(extractedData.health_ped || extractedData.ped || getMatch([
          /(?:Health\s*PED|PED|Pre-Existing\s*Diseases?):\s*([^\n<|•]+)/i
        ]));
        const tpaVal = clean(extractedData.tpa_name || extractedData.tpa || getMatch([
          /(?:TPA|Third\s*Party\s*Administrator(?:\s*Name)?):\s*([^\n<|•]+)/i
        ]));
        const copayVal = clean(extractedData.copay || extractedData.co_pay || getMatch([
          /(?:Copay|Co-pay|Co-payment):\s*([^\n<|•]+)/i
        ]));
        const roomVal = clean(extractedData.room_rent_limit || extractedData.room_rent || getMatch([
          /(?:Room\s*Rent(?:\s*Limit)?):\s*([^\n<|•]+)/i
        ]));

        const healthFields = [
          { label: 'Pre-Existing Diseases (PED)', value: pedVal },
          { label: 'TPA Name', value: tpaVal },
          { label: 'Copay / Co-payment', value: copayVal },
          { label: 'Room Rent Limit', value: roomVal }
        ];

        // ── DEDUPLICATE EXTRA EXTRACTED DATA ──
        const rawRenderedKeys = [
          'policy_number', 'policy_type', 'start_date', 'coverage_start', 'expiry_date', 'coverage_end',
          'premium_amount', 'sum_insured', 'sum_assured', 'nominee', 'nominee_name', 'status',
          'name', 'customer_name', 'mobile', 'customer_mobile', 'email', 'customer_email',
          'insurer_name', 'insurer_contact', 'contact', 'vehicle_number', 'health_ped', 'ped',
          'plan_name', 'product_name', 'tpa_name', 'tpa', 'copay', 'co_pay', 'room_rent_limit', 'room_rent',
          'policy_category', 'policy_sub_category'
        ];
        
        const renderedKeys = new Set(rawRenderedKeys.map(k => k.toLowerCase().replace(/[\s_]/g, '')));

        const fieldLabels: Record<string, string> = {
          policy_number: 'Policy Number',
          policy_type: 'Policy Type',
          policy_category: 'Category',
          policy_sub_category: 'Sub Category',
          coverage_start: 'Coverage Start',
          coverage_end: 'Coverage End',
          premium_amount: 'Premium Amount',
          sum_insured: 'Sum Insured',
          insurer_name: 'Insurer Name',
          customer_name: 'Customer Name',
          customer_email: 'Customer Email',
          customer_mobile: 'Customer Mobile',
          vehicle_number: 'Vehicle No',
          nominee_name: 'Nominee',
          health_ped: 'Health PED',
        };

        const skipKeys = new Set(['key_important_details', 'agent_notes']);
        const extraFields: { label: string; value: string }[] = [];

        Object.entries(extractedData).forEach(([key, value]) => {
          if (skipKeys.has(key)) return;
          if (value === null || value === undefined || value === '') return;
          
          const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
          const normalizedKey = key.toLowerCase().replace(/[\s_]/g, '');
          const normalizedLabel = label.toLowerCase().replace(/[\s_]/g, '');
          
          if (renderedKeys.has(normalizedKey) || renderedKeys.has(normalizedLabel)) return;

          let displayValue = String(value).replace(/<[^>]*>/g, '').trim();
          if (!displayValue) return;

          if (key === 'premium_amount' && typeof value === 'number') {
            displayValue = `₹${value.toLocaleString('en-IN')}`;
          }
          extraFields.push({ label, value: displayValue });
        });

        return (
          <div className="space-y-6">
            {/* Row 1: Customer Profile & Insurer Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Customer Profile Card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="px-5 py-3.5 bg-rose-50/70 border-b border-rose-100 flex items-center gap-2">
                  <User className="w-4 h-4 text-rose-500" />
                  <h3 className="font-bold text-xs text-rose-900 uppercase tracking-widest">Customer Profile</h3>
                </div>
                <div className="p-5 space-y-3">
                  {customerFields.map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-b-0">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                      <span className="text-sm font-bold text-slate-800 text-right break-words max-w-[65%]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Insurer Profile Card */}
              <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div className="px-5 py-3.5 bg-indigo-50/70 border-b border-indigo-100 flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-500" />
                  <h3 className="font-bold text-xs text-indigo-900 uppercase tracking-widest">Insurer Profile</h3>
                </div>
                <div className="p-5 space-y-3">
                  {insurerFields.map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-b-0">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                      <span className="text-sm font-bold text-slate-800 text-right break-words max-w-[65%]">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2: Coverage & Financials Card */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              <div className="px-5 py-3.5 bg-amber-50/70 border-b border-amber-100 flex items-center gap-2">
                <IndianRupee className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-xs text-amber-900 uppercase tracking-widest">Coverage & Financials</h3>
              </div>
              <div className="p-5 space-y-3">
                {coverageFinancialFields.map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-b-0">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                    <span className="text-sm font-bold text-slate-800 text-right break-words max-w-[65%]">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Row 3: Policy-Specific Sub-sections & Other Extracted Data */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Motor Policy Details Card */}
              {isMotor && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="px-5 py-3.5 bg-blue-50/70 border-b border-blue-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-blue-500" />
                    <h3 className="font-bold text-xs text-blue-900 uppercase tracking-widest">Motor Policy Details</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    {motorFields.map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-b-0">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                        <span className="text-sm font-bold text-slate-800 text-right break-words max-w-[65%]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Health Policy Details Card */}
              {isHealth && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                  <div className="px-5 py-3.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-500" />
                    <h3 className="font-bold text-xs text-emerald-900 uppercase tracking-widest">Health Policy Details</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    {healthFields.map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-b-0">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                        <span className="text-sm font-bold text-slate-800 text-right break-words max-w-[65%]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Extracted AI Insights Card */}
              {extraFields.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow col-span-1 md:col-span-2">
                  <div className="px-5 py-3.5 bg-purple-50/70 border-b border-purple-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-500" />
                    <h3 className="font-bold text-xs text-purple-900 uppercase tracking-widest">Other Extracted Insights</h3>
                  </div>
                  <div className="p-5 space-y-3">
                    {extraFields.map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center py-2 border-b border-slate-50 last:border-b-0">
                        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
                        <span className="text-sm font-bold text-slate-800 text-right break-words max-w-[65%]">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
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
              // Use our secure backend API which dynamically fetches the environment variables at runtime
              const downloadUrl = doc.id ? `/api/documents/${doc.id}/download` : null;

              return (
                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors gap-4 sm:gap-3">
                  <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
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

                  <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-auto ml-12 sm:ml-0">
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
