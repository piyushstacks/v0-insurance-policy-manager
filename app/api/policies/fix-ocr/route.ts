import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // 1. Find all policies where premium_amount is 0 or null
    // and which are not already flagged as pending or manual.
    const { data: policies, error: fetchError } = await supabaseAdmin!
      .from('policies')
      .select('id, policy_number, premium_amount, status')
      .or('premium_amount.eq.0,premium_amount.is.null')
      .not('policy_number', 'like', 'PENDING_OCR%');

    if (fetchError) {
      throw new Error(`Failed to fetch policies: ${fetchError.message}`);
    }

    if (!policies || policies.length === 0) {
      return NextResponse.json({ message: 'No existing policies found with missing premium amounts.' }, { status: 200 });
    }

    const updatedPolicies = [];
    const failedUpdates = [];

    // 2. Loop through and update them to require manual entry
    for (const policy of policies) {
      const newPolicyNumber = `PENDING_OCR_MANUAL_${Date.now()}_${policy.id.substring(0, 5)}`;
      
      const { error: updateError } = await supabaseAdmin!
        .from('policies')
        .update({
          policy_number: newPolicyNumber,
          agent_notes: `⚠️ SYSTEM FLAG: This policy was automatically flagged because it is missing a valid Premium Amount or Sum Assured. Manual entry is required to finalize it.\n\n(Original Policy Number: ${policy.policy_number})`
        })
        .eq('id', policy.id);

      if (updateError) {
        failedUpdates.push({ id: policy.id, error: updateError.message });
      } else {
        updatedPolicies.push(policy.id);
      }
    }

    return NextResponse.json({
      message: `Successfully flagged ${updatedPolicies.length} policies for manual entry.`,
      updated: updatedPolicies.length,
      failed: failedUpdates.length,
      failedDetails: failedUpdates
    }, { status: 200 });

  } catch (error: any) {
    console.error('[Fix-OCR] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
