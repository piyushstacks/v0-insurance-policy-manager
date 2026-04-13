import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { uploadPolicyDocument } from '@/services/upload';

export const runtime = 'nodejs';

/**
 * POST /api/upload
 * Upload a policy document and queue for extraction
 *
 * Expected multipart form data:
 * - file: File
 * - policyId: string
 * - autoExtract?: boolean (default: true)
 */
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
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore
            }
          },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const policyId = formData.get('policyId') as string;
    const autoExtract = formData.get('autoExtract') !== 'false';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!policyId) {
      return NextResponse.json(
        { error: 'No policy ID provided' },
        { status: 400 }
      );
    }

    // Upload document
    const result = await uploadPolicyDocument(user.id, policyId, file, autoExtract);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[v0] Upload API error:', error);

    const message = error instanceof Error ? error.message : 'Upload failed';

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
