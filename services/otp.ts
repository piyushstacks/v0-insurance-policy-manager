/**
 * OTP Service — 6-digit, 5-min expiry, max 3 attempts, 30s resend cooldown
 */

import crypto from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { sendEmail, otpEmail } from './email';

const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const RESEND_COOLDOWN_SECONDS = 30;

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function hashOTP(otp: string): string {
  return crypto.createHash('sha256').update(otp).digest('hex');
}

export type OTPPurpose = 'signup' | 'login' | 'email-change';

export async function sendOTP(
  email: string,
  purpose: OTPPurpose
): Promise<{ success: boolean; error?: string; cooldown?: number }> {
  // Check resend cooldown
  const { data: existing } = await supabaseAdmin!
    .from('otp_codes')
    .select('created_at, attempts')
    .eq('email', email)
    .eq('purpose', purpose)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const elapsed = (Date.now() - new Date(existing.created_at).getTime()) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed);
      return { success: false, error: `Please wait ${remaining}s before requesting a new code.`, cooldown: remaining };
    }
  }

  // Expire old OTPs
  await supabaseAdmin!
    .from('otp_codes')
    .update({ used: true })
    .eq('email', email)
    .eq('purpose', purpose)
    .eq('used', false);

  const otp = generateOTP();
  const hashed = hashOTP(otp);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await supabaseAdmin!.from('otp_codes').insert([{
    email,
    hashed_otp: hashed,
    purpose,
    expires_at: expiresAt,
    attempts: 0,
    used: false,
  }]);

  if (insertError) {
    console.error('[OTP] Insert error:', insertError);
    return { success: false, error: 'Failed to generate OTP.' };
  }

  const emailResult = await sendEmail(otpEmail({ otp, purpose, recipientEmail: email }));

  if (!emailResult.success) {
    console.error('[OTP] Email failed:', emailResult.error);
    return { success: false, error: 'Failed to send OTP email.' };
  }

  console.log(`[OTP] ✅ Sent to ${email} for ${purpose}`);
  return { success: true };
}

export async function verifyOTP(
  email: string,
  otp: string,
  purpose: OTPPurpose
): Promise<{ valid: boolean; error?: string }> {
  const { data: record } = await supabaseAdmin!
    .from('otp_codes')
    .select('*')
    .eq('email', email)
    .eq('purpose', purpose)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!record) return { valid: false, error: 'No active OTP found. Please request a new code.' };

  if (new Date(record.expires_at) < new Date()) {
    await supabaseAdmin!.from('otp_codes').update({ used: true }).eq('id', record.id);
    return { valid: false, error: 'OTP has expired. Please request a new code.' };
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    await supabaseAdmin!.from('otp_codes').update({ used: true }).eq('id', record.id);
    return { valid: false, error: 'Too many failed attempts. Please request a new code.' };
  }

  const hashed = hashOTP(otp);
  if (hashed !== record.hashed_otp) {
    await supabaseAdmin!.from('otp_codes').update({ attempts: record.attempts + 1 }).eq('id', record.id);
    const remaining = MAX_ATTEMPTS - record.attempts - 1;
    return { valid: false, error: `Invalid code. ${remaining} attempt(s) remaining.` };
  }

  // Mark used
  await supabaseAdmin!.from('otp_codes').update({ used: true }).eq('id', record.id);
  console.log(`[OTP] ✅ Verified for ${email} (${purpose})`);
  return { valid: true };
}
