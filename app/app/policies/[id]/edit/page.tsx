'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Save, AlertTriangle, FileText } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageLoader } from '@/components/ui/loader';

export default function PolicyEditPage() {
  const params = useParams();
  const router = useRouter();
  const policyId = params.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [policy, setPolicy] = useState<any>(null);
  const [extractedData, setExtractedData] = useState<any>({});
  
  const [formData, setFormData] = useState({
    policy_number: '',
    premium_amount: '',
    sum_insured: '',
  });

  useEffect(() => {
    async function fetchPolicy() {
      try {
        const res = await fetch(`/api/policies/${policyId}`);
        if (!res.ok) throw new Error('Failed to load policy');
        const data = await res.json();
        
        const pol = data.policy ?? data;
        const ext = data.extractedData ?? {};
        
        setPolicy(pol);
        setExtractedData(ext);

        // Pre-fill
        let initialPolicyNumber = pol.policy_number || '';
        if (initialPolicyNumber.includes('PENDING_OCR')) {
          initialPolicyNumber = ext.policy_number || ''; 
        }

        const initialPremium = pol.premium_amount || ext.premium_amount || '';
        const initialSumInsured = pol.sum_insured || ext.sum_insured || ext.sum_assured || '';

        setFormData({
          policy_number: initialPolicyNumber,
          premium_amount: initialPremium.toString(),
          sum_insured: initialSumInsured.toString(),
        });
      } catch (err: any) {
        toast.error('Failed to load policy for editing');
        router.push('/app/policies');
      } finally {
        setIsLoading(false);
      }
    }
    fetchPolicy();
  }, [policyId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.policy_number) return toast.error('Policy Number is required');
    if (!formData.premium_amount || isNaN(Number(formData.premium_amount))) return toast.error('Valid Premium Amount is required');
    if (!formData.sum_insured || isNaN(Number(formData.sum_insured))) return toast.error('Valid Sum Insured is required');

    setIsSaving(true);
    try {
      const res = await fetch(`/api/policies/${policyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          policy_number: formData.policy_number,
          premium_amount: Number(formData.premium_amount),
          sum_insured: Number(formData.sum_insured),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update policy');
      }

      toast.success('Policy successfully updated and finalized!');
      router.push(`/app/policies/${policyId}`);
    } catch (err: any) {
      toast.error('Update failed', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <PageLoader words={['policy', 'data']} label="loading" />;

  const isManualEntry = policy?.policy_number?.includes('MANUAL');

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <Link href={`/app/policies/${policyId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Policy
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            {isManualEntry ? 'Manual Entry Required' : 'Edit Policy Details'}
          </h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            {isManualEntry 
              ? 'The AI extraction could not confidently identify the premium or sum assured. Please verify the document and enter the missing details below to finalize the policy.'
              : 'Update the core financial details for this policy.'}
          </p>
        </div>
      </div>

      {isManualEntry && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-red-900">Missing Required Fields</h3>
            <p className="text-xs text-red-700 mt-1">Please open the uploaded document, find the exact Premium Amount and Sum Assured, and enter them below.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
        
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Policy Number</label>
            <Input 
              value={formData.policy_number}
              onChange={(e) => setFormData(prev => ({ ...prev, policy_number: e.target.value }))}
              placeholder="e.g. P/141100/01/2025/001234"
              className="h-11 bg-slate-50 border-slate-200"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Gross Premium Amount (₹)</label>
              <Input 
                type="number"
                value={formData.premium_amount}
                onChange={(e) => setFormData(prev => ({ ...prev, premium_amount: e.target.value }))}
                placeholder="e.g. 25000"
                className="h-11 bg-slate-50 border-slate-200"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sum Insured / Assured (₹)</label>
              <Input 
                type="number"
                value={formData.sum_insured}
                onChange={(e) => setFormData(prev => ({ ...prev, sum_insured: e.target.value }))}
                placeholder="e.g. 500000"
                className="h-11 bg-slate-50 border-slate-200"
                required
              />
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={() => router.push(`/app/policies/${policyId}`)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            variant="primary" 
            disabled={isSaving}
            className="min-w-[140px]"
          >
            {isSaving ? <PageLoader words={[]} label="" className="h-5 w-5" /> : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {isManualEntry ? 'Finalize Policy' : 'Save Changes'}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
