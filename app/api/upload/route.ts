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

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
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
          .insert([{ name: 'Pending OCR Customer', email: 'pending@ocr.local' }])
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

    const result = await uploadPolicyDocument(user.id, policyId, file, autoExtract);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[v0] Upload API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
