import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { uploadPolicyDocument } from '@/services/upload';
import { supabaseAdmin } from '@/lib/supabase';
import { extractDocumentInline } from '@/services/extraction';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes – needed for sequential OCR + AI on bulk files

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore in Server Components
            }
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const customerId = (formData.get('customerId') as string) || '';
    const uploadType = (formData.get('uploadType') as string) || 'policy';
    const storeFile = uploadType !== 'renewal';
    const storagePref = (formData.get('storagePref') as 'platform' | 'drive') || 'platform';

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 });
    }

    // Ensure we have a customer and insurer to use
    let finalCustomerId = customerId;
    if (!finalCustomerId) {
      // Get or create default customer
      let { data: custData } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('name', 'Bulk Upload Customer')
        .limit(1)
        .maybeSingle();

      if (!custData) {
        const { data: newCust, error: newCustErr } = await supabaseAdmin
          .from('customers')
          .insert([{ name: 'Bulk Upload Customer', email: 'bulk@upload.local', user_id: user.id }])
          .select('id')
          .single();
        if (newCustErr || !newCust) {
          return NextResponse.json(
            { error: 'DB Customer Insert Failed: ' + (newCustErr?.message ?? 'unknown') },
            { status: 500 }
          );
        }
        custData = newCust;
      }
      finalCustomerId = custData.id;
    }

    // Get or create default insurer
    let { data: insData } = await supabaseAdmin
      .from('insurers')
      .select('id')
      .eq('name', 'Bulk Upload Insurer')
      .limit(1)
      .maybeSingle();

    if (!insData) {
      const { data: newIns, error: newInsErr } = await supabaseAdmin
        .from('insurers')
        .insert([{ name: 'Bulk Upload Insurer' }])
        .select('id')
        .single();
      if (newInsErr || !newIns) {
        return NextResponse.json(
          { error: 'DB Insurer Insert Failed: ' + (newInsErr?.message ?? 'unknown') },
          { status: 500 }
        );
      }
      insData = newIns;
    }

    const uploadResults = [];

    // Process each file sequentially — upload then immediately extract
    // (Sequential rather than parallel prevents AI API rate-limit hammering)
    for (const file of files) {
      if (file.type !== 'application/pdf') {
        uploadResults.push({
          fileName: file.name,
          status: 'error',
          error: 'Upload rejected: Only PDF documents are allowed.',
        });
        continue;
      }

      try {
        // Create placeholder policy for this file
        const timestamp = Date.now();
        const { data: polData, error: polErr } = await supabaseAdmin
          .from('policies')
          .insert([{
            user_id: user.id,
            customer_id: finalCustomerId,
            insurer_id: insData.id,
            policy_number: `BULK_OCR_${timestamp}_${Math.floor(Math.random() * 10000)}`,
            policy_type: 'Pending Extraction',
            start_date: new Date().toISOString(),
            expiry_date: new Date(Date.now() + 31536000000).toISOString(),
            premium_amount: 1,
            status: 'active',
          }])
          .select('id')
          .single();

        if (polErr || !polData) {
          uploadResults.push({
            fileName: file.name,
            status: 'error',
            error: 'Failed to create policy placeholder',
          });
          continue;
        }

        const policyId = polData.id;

        // Step 1: Upload file to storage (extraction=false, we handle it below)
        const result = await uploadPolicyDocument(user.id, policyId, file, false, storeFile, storagePref);

        // Step 2: Run synchronous extraction — awaited so it always completes
        // before this function returns. Vercel won't kill it inside maxDuration=300.
        if (storeFile && result.documentId && result.documentId !== 'no-document') {
          try {
            console.log(`[BulkUpload] Extracting ${file.name} (doc: ${result.documentId})...`);
            await extractDocumentInline(result.documentId, policyId, result.fileUrl || null);
            console.log(`[BulkUpload] Extraction done for ${file.name}`);
          } catch (extractErr: any) {
            console.error(`[BulkUpload] Extraction failed for ${file.name} (non-fatal):`, extractErr.message);
          }
        }

        uploadResults.push({
          fileName: file.name,
          policyId,
          documentId: result.documentId,
          status: 'extracted',
          message: storeFile ? 'Uploaded and extracted successfully' : 'Renewal receipt processed',
        });
      } catch (err: any) {
        uploadResults.push({
          fileName: file.name,
          status: 'error',
          error: err.message || 'Upload failed',
        });
      }
    }

    return NextResponse.json(
      {
        success: true,
        totalFiles: files.length,
        results: uploadResults,
        successCount: uploadResults.filter(r => r.status === 'success').length,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Bulk upload API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Bulk upload failed' },
      { status: 500 }
    );
  }
}
