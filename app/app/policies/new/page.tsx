'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import BulkFileUpload from '@/components/bulk-file-upload';

interface UploadedPolicy {
  policyId: string;
  fileName: string;
}

export default function NewPolicyPage() {
  const router = useRouter();
  const [uploadedPolicies, setUploadedPolicies] = useState<UploadedPolicy[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Subscribe to real-time policy updates
  useEffect(() => {
    if (!supabase || uploadedPolicies.length === 0) return;

    console.log('[v0/Bulk] Setting up realtime listeners for uploaded policies');
    
    const channels = uploadedPolicies.map(policy => {
      const channel = supabase
        .channel(`policy-update-${policy.policyId}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'policies',
            filter: `id=eq.${policy.policyId}`,
          },
          (payload) => {
            console.log(`[v0/Bulk] Policy ${policy.policyId} updated:`, payload.new);
            // Refresh to show new extracted data
            setIsRefreshing(true);
            setTimeout(() => setIsRefreshing(false), 500);
          }
        )
        .subscribe();

      return channel;
    });

    return () => {
      console.log('[v0/Bulk] Cleaning up realtime listeners');
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [uploadedPolicies]);

  const handleAllComplete = useCallback((results: UploadedPolicy[]) => {
    setUploadedPolicies(prev => [...prev, ...results]);
    toast.info('Policies queued for extraction', {
      description: `${results.length} policies are being processed in the background.`,
    });
  }, []);

  const handlePolicyCreated = useCallback((policyId: string, fileName: string) => {
    // This is called immediately when a policy is created
    console.log(`[v0/Bulk] Policy created: ${policyId} from ${fileName}`);
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
            Upload multiple policy documents at once. Each file will be processed sequentially to ensure proper data extraction. 
            Extracted policies will automatically appear in your Policies list without requiring a page refresh.
          </p>
        </div>
      </div>

      {/* Main Upload Component */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <BulkFileUpload 
          onAllComplete={handleAllComplete}
          onPolicyCreated={handlePolicyCreated}
        />
      </div>

      {/* Uploaded Policies Summary */}
      {uploadedPolicies.length > 0 && (
        <div className="mt-8 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">Recently Created Policies ({uploadedPolicies.length})</h2>
            <p className="text-sm text-slate-600 mb-4">
              Click on a policy to view details and extracted data in real-time.
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
              className="bg-slate-900 hover:bg-slate-800 text-white shadow-md"
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
