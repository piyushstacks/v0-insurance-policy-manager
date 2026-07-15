import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { uploadPolicyDocument } from '@/services/upload';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

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
    const file = formData.get('file') as File | null;
    let policyId = (formData.get('policyId') as string) || '';
    const autoExtract = formData.get('autoExtract') !== 'false';
    const uploadType = (formData.get('uploadType') as string) || 'policy';
    const storeFile = uploadType !== 'renewal';
    const storagePref = (formData.get('storagePref') as 'platform' | 'drive') || 'platform';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Upload rejected: Only PDF documents are allowed.' }, { status: 400 });
    }

    // --- PRE-UPLOAD VALIDATION ---
    if (file.type === 'application/pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require('pdf-parse');
        const result = await pdfParse(buffer);
        const text = result.text?.toLowerCase() || '';
        
        // Strict Check: if it explicitly says quotation or proposal, reject it
        // BUT bypass for renewal receipts since they are essentially quotes/notices for next year
        if (storeFile && (text.includes('quotation') || text.includes('quote only') || text.includes('this is a quote') || text.includes('proposal form'))) {
           return NextResponse.json({ error: 'Upload rejected: Document appears to be a quotation or proposal, not an issued policy.' }, { status: 400 });
        }
        
        // Check for basic insurance policy indicators
        const hasInsuranceKeywords = text.includes('insurance') || text.includes('policy') || text.includes('premium') || text.includes('schedule');
        if (!hasInsuranceKeywords && text.length > 50) {
           return NextResponse.json({ error: 'Upload rejected: Document does not appear to be a valid insurance policy.' }, { status: 400 });
        }
      } catch (err) {
        console.warn('[v0] Pre-upload PDF validation failed (corrupt or encrypted PDF). Proceeding with upload...', err);
      }
    }

    // Auto-create placeholder policy if none was provided
    if (!policyId) {
      if (!supabaseAdmin) {
        return NextResponse.json({ error: 'Supabase admin client not configured' }, { status: 500 });
      }

      // Upsert placeholder customer
      let { data: custData } = await supabaseAdmin
        .from('customers')
        .select('id')
        .eq('name', 'Pending OCR Customer')
        .limit(1)
        .maybeSingle();

      if (!custData) {
        const { data: newCust, error: newCustErr } = await supabaseAdmin
          .from('customers')
          .insert([{ name: 'Pending OCR Customer', email: 'pending@ocr.local', user_id: user.id }])
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

      // Upsert placeholder insurer
      let { data: insData } = await supabaseAdmin
        .from('insurers')
        .select('id')
        .eq('name', 'Pending OCR Insurer')
        .limit(1)
        .maybeSingle();

      if (!insData) {
        const { data: newIns, error: newInsErr } = await supabaseAdmin
          .from('insurers')
          .insert([{ name: 'Pending OCR Insurer' }])
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

      const timestamp = Date.now();
      const { data: polData, error: polErr } = await supabaseAdmin
        .from('policies')
        .insert([{
          user_id: user.id,
          customer_id: custData.id,
          insurer_id:  insData.id,
          policy_number: `PENDING_OCR_${timestamp}_${Math.floor(Math.random() * 1000)}`,
          policy_type:   'Pending Extraction',
          start_date:    new Date().toISOString(),
          expiry_date:   new Date(Date.now() + 31536000000).toISOString(),
          premium_amount: 1,
          status: 'active',
        }])
        .select('id')
        .single();

      if (polErr || !polData) {
        return NextResponse.json(
          { error: 'Failed to create placeholder policy: ' + (polErr?.message ?? '') },
          { status: 500 }
        );
      }

      policyId = polData.id;
    }

    const result = await uploadPolicyDocument(user.id, policyId, file, autoExtract, storeFile, storagePref);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[v0] Upload API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
