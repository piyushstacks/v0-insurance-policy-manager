import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { policySchema, policyUpdateSchema } from '@/lib/schemas';
import { updatePolicy, deletePolicy, getPolicyWithDocuments } from '@/services/policies';
import { z } from 'zod';
import type { CookieOptions } from '@supabase/ssr';

export const runtime = 'nodejs';

/**
 * GET /api/policies/[id]
 * Get a single policy with documents
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
              // Ignore
            }
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

    const result = await getPolicyWithDocuments(id, user.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[v0] Policy GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch policy' },
      { status: error instanceof Error && error.message === 'Policy not found' ? 404 : 500 }
    );
  }
}

/**
 * PUT /api/policies/[id]
 * Update a policy
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
              // Ignore
            }
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

    const body = await request.json();
    // Allow partial updates using policyUpdateSchema (base object without ZodEffects wrapper)
    const validated = policyUpdateSchema.parse(body);

    const policy = await updatePolicy(id, user.id, validated);

    return NextResponse.json(policy, { status: 200 });
  } catch (error) {
    console.error('[v0] Policy PUT error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', errors: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update policy' },
      { status: error instanceof Error && error.message === 'Policy not found' ? 404 : 500 }
    );
  }
}

/**
 * DELETE /api/policies/[id]
 * Delete a policy
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
              // Ignore
            }
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

    const result = await deletePolicy(id, user.id);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('[v0] Policy DELETE error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete policy' },
      { status: error instanceof Error && error.message === 'Policy not found' ? 404 : 500 }
    );
  }
}
