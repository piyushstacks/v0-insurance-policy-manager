/**
 * GET    /api/team/requests          — List action requests (filtered by role)
 * POST   /api/team/requests          — Create action request (members)
 * PATCH  /api/team/requests          — Approve/Reject (admin only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  getUserTeam,
  createActionRequest,
  getActionRequests,
  reviewActionRequest,
  type ActionRequestType,
  type ActionRequestStatus,
} from '@/services/team';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

async function getUser(request: NextRequest) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { }
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function GET(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership) return NextResponse.json({ requests: [] });

  const statusFilter = request.nextUrl.searchParams.get('status') as ActionRequestStatus | null;
  const requests = await getActionRequests(membership.team_id, statusFilter || undefined);

  // Members only see their own requests; admins and sub-admins see all
  const filtered = (membership.role === 'ADMIN' || membership.role === 'SUB_ADMIN')
    ? requests
    : requests?.filter((r: any) => r.requested_by === user.id);

  return NextResponse.json({ requests: filtered });
}

export async function POST(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership) return NextResponse.json({ error: 'You must be in a team to request actions.' }, { status: 400 });

  const body = await request.json();
  const { type, entityId, entityType, reason, metadata } = body as {
    type: ActionRequestType;
    entityId: string;
    entityType: string;
    reason?: string;
    metadata?: Record<string, any>;
  };

  if (!type || !entityId || !entityType) {
    return NextResponse.json({ error: 'type, entityId, and entityType are required.' }, { status: 400 });
  }

  try {
    const req = await createActionRequest({
      teamId: membership.team_id,
      type,
      entityId,
      entityType,
      requestedBy: user.id,
      reason,
      metadata,
    });
    return NextResponse.json({ success: true, request: req });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const membership = await getUserTeam(user.id);
  if (!membership || (membership.role !== 'ADMIN' && membership.role !== 'SUB_ADMIN')) {
    return NextResponse.json({ error: 'Only admins or sub-admins can approve or reject requests.' }, { status: 403 });
  }

  const { requestId, decision, note } = await request.json() as {
    requestId: string;
    decision: 'APPROVED' | 'REJECTED';
    note?: string;
  };

  if (!requestId || !['APPROVED', 'REJECTED'].includes(decision)) {
    return NextResponse.json({ error: 'requestId and decision (APPROVED|REJECTED) required.' }, { status: 400 });
  }

  try {
    const reviewed = await reviewActionRequest(requestId, user.id, decision, note);

    // If approved, execute the actual action
    if (decision === 'APPROVED') {
      await executeApprovedAction(reviewed);
    }

    return NextResponse.json({ success: true, request: reviewed });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}

/** Execute the actual DB action when admin approves */
async function executeApprovedAction(req: any) {
  const { type, entity_id, metadata } = req;

  switch (type) {
    case 'DELETE_POLICY':
      // Delete extraction jobs first
      const { data: docs } = await supabaseAdmin!.from('policy_documents').select('id').eq('policy_id', entity_id);
      if (docs?.length) {
        await supabaseAdmin!.from('extraction_jobs').delete().in('document_id', docs.map((d: any) => d.id));
        await supabaseAdmin!.from('policy_documents').delete().eq('policy_id', entity_id);
      }
      await supabaseAdmin!.from('policies').delete().eq('id', entity_id);
      break;

    case 'DELETE_CUSTOMER':
      await supabaseAdmin!.from('customers').delete().eq('id', entity_id);
      break;

    case 'DELETE_DOCUMENT':
      await supabaseAdmin!.from('extraction_jobs').delete().eq('document_id', entity_id);
      await supabaseAdmin!.from('policy_documents').delete().eq('id', entity_id);
      break;

    case 'EDIT_POLICY':
      if (metadata?.updatePayload) {
        await supabaseAdmin!.from('policies').update(metadata.updatePayload).eq('id', entity_id);
      }
      break;

    case 'EDIT_CUSTOMER':
      if (metadata?.updatePayload) {
        await supabaseAdmin!.from('customers').update(metadata.updatePayload).eq('id', entity_id);
      }
      break;

    default:
      console.warn('[Approval] Unknown action type:', type);
  }
}
