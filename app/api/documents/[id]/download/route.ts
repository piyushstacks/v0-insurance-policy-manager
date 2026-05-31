import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export const runtime = 'nodejs';

/**
 * GET /api/documents/[id]/download
 * Securely fetch the document's file path and redirect to the correct public URL.
 * This ensures NEXT_PUBLIC_B2_PUBLIC_URL is evaluated at runtime dynamically.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    
    // Auth Check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only in GET routes
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch Document Metadata
    const { data: document, error } = await supabaseAdmin!
      .from('policy_documents')
      .select('file_path')
      .eq('id', id)
      .single();

    if (error || !document || !document.file_path) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Resolve base URL dynamically at runtime (Fixes Vercel edge caching missing env variables)
    const baseUrl = process.env.B2_PUBLIC_URL || process.env.NEXT_PUBLIC_B2_PUBLIC_URL;
    
    if (!baseUrl) {
      console.error('[v0] Missing B2_PUBLIC_URL environment variable');
      return NextResponse.json({ error: 'Storage configuration error' }, { status: 500 });
    }

    const downloadUrl = `${baseUrl.replace(/\/$/, '')}/${document.file_path}`;

    // Redirect the user to the actual file URL
    return NextResponse.redirect(downloadUrl);
  } catch (error) {
    console.error('[v0] Document Download Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
