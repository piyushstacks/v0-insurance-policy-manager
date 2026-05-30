import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params;
    const body = await request.json();

    const authHeader = request.headers.get('authorization');
    // Simple mock auth validation for internal patch
    // Note: Use actual session in production
    
    // The JSON expected from frontend
    // { enabled: boolean, email: boolean, timing_days: number[], types: string[] }

    // Validate structure briefly
    if (typeof body.enabled !== 'boolean') throw new Error("Invalid enabled flag");

    const { error } = await supabaseAdmin!
      .from('policies')
      .update({ reminder_preferences: body })
      .eq('id', id);

    if (error) {
      console.error("DB update error:", error);
      throw error;
    }

    return NextResponse.json({ success: true, updated: body });
  } catch (error: any) {
    console.error("Reminder config error:", error);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
