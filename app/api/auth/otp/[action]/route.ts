/**
 * POST /api/auth/otp/send    — Send OTP
 * POST /api/auth/otp/verify  — Verify OTP
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendOTP, verifyOTP, type OTPPurpose } from '@/services/otp';
import { loginSchema } from '@/lib/schemas';

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const action = url.pathname.endsWith('/verify') ? 'verify' : 'send';

  try {
    const body = await request.json();
    const { email, otp, purpose = 'login' } = body;

    // Strict validation
    const emailResult = loginSchema.pick({ email: true }).safeParse({ email });
    if (!emailResult.success) {
      return NextResponse.json({ error: emailResult.error.errors[0].message }, { status: 400 });
    }


    if (action === 'verify') {
      if (!otp || otp.length !== 6) {
        return NextResponse.json({ error: '6-digit OTP required.' }, { status: 400 });
      }
      const result = await verifyOTP(email, otp, purpose);
      return NextResponse.json(result.valid ? { success: true } : { success: false, error: result.error }, {
        status: result.valid ? 200 : 400,
      });
    }

    // Send
    const result = await sendOTP(email, purpose);
    return NextResponse.json(
      result.success ? { success: true } : { success: false, error: result.error, cooldown: result.cooldown },
      { status: result.success ? 200 : 429 }
    );
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
