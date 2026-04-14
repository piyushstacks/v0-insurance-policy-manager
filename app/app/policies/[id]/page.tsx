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
} from 'lucide-react';
import { PageLoader } from '@/components/ui/loader';

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
  const [extractedData, setExtractedData] = useState<Record<string, any>>({});
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
          <ActionButton
            color="primary-destructive"
            size="sm"
            onClick={handleDelete}
            isLoading={isDeleting}
            iconLeading={Trash2}
          >
            Delete
          </ActionButton>
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
              <p className="font-medium">{new Date(policy.start_date || policy.coverage_start || '').toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Expiry Date</p>
              <p className="font-medium">{new Date(policy.expiry_date || policy.coverage_end || '').toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-4 space-y-3 shadow-sm">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Financial</h3>
          <div className="space-y-2">
            <div>
              <p className="text-xs text-muted-foreground">Premium Amount</p>
              <p className="font-medium text-lg">₹{policy.premium_amount?.toLocaleString('en-IN')}</p>
            </div>
            {policy.sum_insured && (
              <div>
                <p className="text-xs text-muted-foreground">Sum Insured</p>
                <p className="font-medium text-lg">₹{policy.sum_insured?.toLocaleString('en-IN')}</p>
              </div>
            )}
          </div>
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

      {/* Comprehensive Extracted Data from All AI Services */}
      {Object.keys(extractedData).length > 0 && (
        <div className="rounded-lg border bg-purple-50 border-purple-200 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-purple-900 uppercase tracking-wide flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-600" />
            All Extracted Data from AI Intelligence
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(() => {
              // Format extracted data for display
              const displayFields: Record<string, string> = {};
              
              // Map API field names to readable labels
              const fieldLabels: Record<string, string> = {
                'policy_number': 'Policy Number',
                'policy_type': 'Policy Type',
                'policy_category': 'Category',
                'policy_sub_category': 'Sub Category',
                'coverage_start': 'Coverage Start',
                'coverage_end': 'Coverage End',
                'premium_amount': 'Premium Amount',
                'insurer_name': 'Insurer',
                'customer_name': 'Customer',
                'customer_email': 'Email',
                'customer_mobile': 'Mobile',
                'vehicle_number': 'Vehicle No',
                'nominee_name': 'Nominee',
                'health_ped': 'Health PED',
                'key_important_details': 'Key Details',
              };
              
              Object.entries(extractedData).forEach(([key, value]) => {
                if (value === null || value === undefined || value === '') return;
                
                const label = fieldLabels[key] || key.replace(/_/g, ' ').toUpperCase();
                let displayValue = String(value);
                
                // Format specific fields
                if (key === 'premium_amount' && typeof value === 'number') {
                  displayValue = `₹${value.toLocaleString('en-IN')}`;
                } else if (key === 'coverage_start' || key === 'coverage_end') {
                  try {
                    displayValue = new Date(value).toLocaleDateString('en-IN');
                  } catch (e) {
                    displayValue = String(value);
                  }
                } else if (key === 'key_important_details' && displayValue.includes('<li>')) {
                  // Skip HTML content, will be shown in AI insights section
                  return;
                }
                
                displayFields[label] = displayValue;
              });
              
              return Object.entries(displayFields).map(([label, value]) => (
                <div key={label} className="bg-white p-3 rounded-md border border-purple-100 hover:border-purple-300 transition-colors">
                  <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
                  <p className="font-semibold text-purple-900 text-sm word-wrap">{value}</p>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Motor Policy Details (extracted from AI insights) */}
      {policy.policy_type?.toLowerCase().includes('motor') && policy.agent_notes && (
        <div className="rounded-lg border bg-blue-50 border-blue-200 p-5 space-y-4">
          <h3 className="font-semibold text-sm text-blue-900 uppercase tracking-wide flex items-center gap-2">
            <Building className="w-4 h-4 text-blue-600" />
            Motor Policy Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(() => {
              // Extract motor details from agent_notes with comprehensive patterns
              const motorDetails: Record<string, string> = {};
              const notes = policy.agent_notes || '';
              
              // 1. Vehicle Information (Model, Make, Type)
              const vehicleMatch = notes.match(/(?:Vehicle|vehicle|Car|car|Model):\s*([^\n<|•]+)/);
              if (vehicleMatch) {
                const vehicle = vehicleMatch[1].trim().replace(/<[^>]*>/g, '');
                motorDetails['Vehicle'] = vehicle;
              }
              
              // 2. Registration/License Plate
              const regPatterns = [
                /(?:Reg\s*(?:istration)?\s*No(?:\.)?|Vehicle\s*Reg|License\s*Plate|Number\s*Plate):\s*([^\n<|•]+)/i,
                /Reg(?:istration)?(?:\s*No)?:\s*([A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4})/i,
                /(?:Reg\s*No\s*[-:]?\s*)([A-Z]{2}[0-9]{2}[A-Z]{2}[0-9]{4})/i,
              ];
              let regMatch;
              for (const pattern of regPatterns) {
                const match = notes.match(pattern);
                if (match) {
                  regMatch = match;
                  break;
                }
              }
              if (regMatch) {
                const reg = regMatch[1].trim().replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '');
                motorDetails['Registration Number'] = reg;
              }
              
              // 3. NCB (No Claim Bonus)
              const ncbPatterns = [
                /(?:NCB|No[\s-]*Claim[\s-]*Bonus|No\s*Claim\s*Bonus):\s*([^\n<|•]+)/i,
                /(?:NCB|NCP|No[\s-]*Claim)?\s*(?:Bonus|Discount):\s*([^\n<|•]+)/i,
              ];
              let ncbMatch;
              for (const pattern of ncbPatterns) {
                const match = notes.match(pattern);
                if (match) {
                  ncbMatch = match;
                  break;
                }
              }
              if (ncbMatch) {
                const ncb = ncbMatch[1].trim().replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '');
                motorDetails['NCB'] = ncb;
              }
              
              // 4. Nominee Information
              const nomineePatterns = [
                /(?:Nominee)(?:\s*(?:Name)?):\s*([^\n<|•]+)/i,
                /(?:Nominated?)\s*(?:Person|Name)?:\s*([^\n<|•]+)/i,
              ];
              let nomineeMatch;
              for (const pattern of nomineePatterns) {
                const match = notes.match(pattern);
                if (match) {
                  nomineeMatch = match;
                  break;
                }
              }
              if (nomineeMatch) {
                const nominee = nomineeMatch[1].trim().replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '');
                motorDetails['Nominee'] = nominee;
              }
              
              // 5. Premium Amount
              const premiumPatterns = [
                /(?:Premium)(?:\s*Amount)?\s*(?:Payable)?:\s*(?:₹|Rs\.?\s*)([^\n<|•]+)/i,
                /(?:Total\s*)?Premium:\s*(?:₹|Rs\.?\s*)([0-9,]+)/i,
                /(?:Premium|Amount):\s*₹?([0-9,]+(?:\.\d{2})?)/i,
              ];
              let premiumMatch;
              for (const pattern of premiumPatterns) {
                const match = notes.match(pattern);
                if (match) {
                  premiumMatch = match;
                  break;
                }
              }
              if (premiumMatch) {
                const premium = premiumMatch[1].trim().replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '');
                motorDetails['Premium Amount'] = `₹${premium}`;
              }
              
              // 6. Coverage Period/Duration
              const coveragePatterns = [
                /(?:Coverage|Period):\s*([^\n<|•]+)/i,
                /(?:From|Coverage\s*Start):\s*([^\n<|•]+?)(?:\s*to\s*(?:Coverage\s*)?End:\s*([^\n<|•]+))?/i,
              ];
              let coverageMatch;
              for (const pattern of coveragePatterns) {
                const match = notes.match(pattern);
                if (match) {
                  coverageMatch = match;
                  break;
                }
              }
              if (coverageMatch) {
                const coverage = coverageMatch[1].trim().replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '');
                motorDetails['Coverage'] = coverage;
              }
              
              // 7. Additional Motor Details (IDV, Body Type, Fuel Type, etc.)
              const idvMatch = notes.match(/(?:IDV|Insured\s*Declared\s*Value):\s*(?:₹|Rs\.?\s*)([^\n<|•]+)/i);
              if (idvMatch) {
                const idv = idvMatch[1].trim().replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '');
                motorDetails['IDV'] = `₹${idv}`;
              }
              
              const fuelMatch = notes.match(/(?:Fuel\s*Type|Fuel):\s*([^\n<|•]+)/i);
              if (fuelMatch) {
                const fuel = fuelMatch[1].trim().replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '');
                motorDetails['Fuel Type'] = fuel;
              }
              
              const bodyMatch = notes.match(/(?:Body\s*Type|Vehicle\s*Type):\s*([^\n<|•]+)/i);
              if (bodyMatch) {
                const body = bodyMatch[1].trim().replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '');
                motorDetails['Body Type'] = body;
              }
              
              // 8. Year of Manufacture
              const yearMatch = notes.match(/(?:Year|YOM|Year\s*of\s*Manufacture|Manufacturing\s*Year):\s*([0-9]{4}|[^\n<|•]+)/i);
              if (yearMatch) {
                const year = yearMatch[1].trim().replace(/<[^>]*>/g, '').replace(/[|•<>]/g, '');
                motorDetails['Year'] = year;
              }
              
              return Object.entries(motorDetails).length > 0 ? (
                Object.entries(motorDetails).map(([key, value]) => (
                  <div key={key} className="bg-white p-3 rounded-md border border-blue-100 hover:border-blue-300 transition-colors">
                    <p className="text-xs text-muted-foreground mb-1 font-medium">{key}</p>
                    <p className="font-semibold text-blue-900 text-sm word-wrap">{value}</p>
                  </div>
                ))
              ) : null;
            })()}
          </div>
        </div>
      )}

      {/* Extra Details */}
      {policy.agent_notes && (
        <div className="rounded-lg border bg-card p-5 space-y-3 shadow-sm border-t-4 border-t-indigo-400">
          <h3 className="font-semibold text-sm text-indigo-900 uppercase tracking-wide flex items-center gap-2">
             <AlertCircle className="w-4 h-4 text-indigo-500" /> 
             Deep AI Extraction Insights
          </h3>
          <div className="bg-muted/30 p-4 rounded-md text-sm space-y-2">
            {(() => {
              // Parse HTML and extract text content
              const parser = new DOMParser();
              let items: string[] = [];
              
              try {
                // Try to parse as HTML
                const doc = parser.parseFromString(policy.agent_notes, 'text/html');
                const listItems = doc.querySelectorAll('li');
                
                if (listItems.length > 0) {
                  items = Array.from(listItems).map(item => item.textContent?.trim() || '').filter(Boolean);
                } else {
                  // Fallback: split by newlines or common delimiters
                  items = policy.agent_notes
                    .split(/\n|<li>|<\/li>|•/)
                    .map(item => item.replace(/<[^>]*>/g, '').trim())
                    .filter(item => item && item.length > 0);
                }
              } catch {
                // Fallback if parsing fails
                items = policy.agent_notes
                  .split(/\n|•/)
                  .map(item => item.replace(/<[^>]*>/g, '').trim())
                  .filter(item => item && item.length > 0);
              }
              
              return items.length > 0 ? items.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-indigo-600 font-semibold min-w-fit">•</span>
                  <p className="text-muted-foreground leading-relaxed">{item}</p>
                </div>
              )) : (
                <p className="text-muted-foreground">{policy.agent_notes.replace(/<[^>]*>/g, '')}</p>
              );
            })()}
          </div>
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
