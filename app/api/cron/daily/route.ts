import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This is a single, lightweight endpoint meant to be hit once a day
// by a cron service (like cron-job.org, Upstash QStash, or Vercel Cron)
// Its primary purpose is to wake up the Supabase database and prevent the 7-day auto-pause.

export async function GET(request: Request) {
  try {
    // Optional: Add simple secret validation so random people can't spam it
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.QSTASH_TOKEN;
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      // If a secret is defined in env but not provided in request, reject
      // return new NextResponse('Unauthorized', { status: 401 });
      // We'll leave it open by default for easier setup with free cron services,
      // but you can uncomment the above for security.
    }

    // Initialize Supabase admin client (or anon) just to ping the DB
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Perform a tiny, fast read query to register activity in Supabase
    // Just checking the current time or a lightweight table
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      console.error('[CRON] Database ping failed:', error.message);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    console.log('[CRON] Daily keep-alive ping successful!');
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database keep-alive ping successful.',
      timestamp: new Date().toISOString()
    });
    
  } catch (err: any) {
    console.error('[CRON] Execution error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
