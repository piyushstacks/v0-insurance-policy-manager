'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import BulkFileUpload from '@/components/bulk-file-upload';

interface UploadedPolicy {
  policyId: string;
  fileName: string;
}

export default function NewPolicyPage() {
  const router = useRouter();
  const [uploadedPolicies, setUploadedPolicies] = useState<UploadedPolicy[]>([]);

  const handleUploadComplete = useCallback((results: Array<{ fileName: string; policyId: string; documentId: string; status: string }>) => {
    const policies = results.map(r => ({ policyId: r.policyId, fileName: r.fileName }));
    setUploadedPolicies(prev => [...prev, ...policies]);
  }, []);

  return (
    <div className="flex-1 flex flex-col p-4 md:p-8 max-w-4xl mx-auto w-full">
      <div className="mb-8">
        <Link href="/app/policies" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-4 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Policies
        </Link>
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">Bulk Upload & Extract</h1>
          <p className="text-slate-500 mt-2 text-sm max-w-2xl">
            Upload multiple policy documents at once. All files are uploaded simultaneously, then extracted one-by-one in the background.
            Check back in a few moments to see extracted data automatically appear in your Policies list via real-time updates.
          </p>
        </div>
      </div>

      {/* Main Upload Component */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <BulkFileUpload 
          onUploadComplete={handleUploadComplete}
        />
      </div>

      {/* Uploaded Policies Summary */}
      {uploadedPolicies.length > 0 && (
        <div className="mt-8 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Recently Created Policies ({uploadedPolicies.length})</h2>
            <p className="text-sm text-slate-600 mb-4">
              These policies are now queued for extraction. Extraction status updates automatically via real-time sync.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {uploadedPolicies.map(policy => (
              <Link key={policy.policyId} href={`/app/policies/${policy.policyId}`}>
                <div className="block p-4 border border-slate-200 rounded-lg hover:border-slate-300 hover:shadow-md transition-all cursor-pointer bg-white hover:bg-slate-50">
                  <p className="text-sm font-medium text-slate-900 truncate">{policy.fileName}</p>
                  <p className="text-xs text-slate-500 mt-1">ID: {policy.policyId.substring(0, 8)}...</p>
                </div>
              </Link>
            ))}
          </div>

          <div className="pt-4 flex gap-3">
            <Button 
              onClick={() => router.push('/app/policies')}
              variant="default"
            >
              View All Policies
            </Button>
            <Button 
              onClick={() => {
                setUploadedPolicies([]);
              }}
              variant="outline"
            >
              Clear List
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
