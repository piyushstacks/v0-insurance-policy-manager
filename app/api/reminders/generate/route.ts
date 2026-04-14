import { NextRequest, NextResponse } from 'next/server';
import { generateAllReminders } from '@/services/reminders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/reminders/generate
 * Worker endpoint to generate reminders for all policies
 * 
 * Security: Protected by verifying CRON_SECRET header
 * Schedule: Run daily (e.g., at 2 AM UTC)
 *
 * Example curl:
 * curl -X POST https://app.com/api/reminders/generate \
 *   -H "Authorization: Bearer your-cron-secret"
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret for security
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[v0] Starting daily reminder generation');

    // Generate reminders for all users
    const result = await generateAllReminders();

    return NextResponse.json(
      {
        ...result,
        success: true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Reminder generation worker error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Reminder generation failed',
      },
      { status: 500 }
    );
  }
}
