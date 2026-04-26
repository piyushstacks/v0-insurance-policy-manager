/**
 * Email Service — Nodemailer with Gmail SMTP
 * Configure SMTP_USER and SMTP_PASS (Gmail App Password) in .env.local
 */

import nodemailer from 'nodemailer';

// Create transporter — re-reads env vars every time (no stale singleton cache)
function getTransporter(): nodemailer.Transporter {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    console.warn('[Email] ⚠️  SMTP_USER or SMTP_PASS not configured — email will be skipped.');
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user, pass },
    tls: { rejectUnauthorized: false },
  });
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const transporter = getTransporter();
  const smtpUser = process.env.SMTP_USER;
  const from = process.env.SMTP_FROM || smtpUser || 'noreply@policyvault.ai';

  if (!smtpUser) {
    console.warn(`[Email] Skipping send to ${params.to} — SMTP not configured.`);
    return { success: false, error: 'SMTP not configured.' };
  }

  try {
    // Verify connection before sending
    await transporter.verify();
    const info = await transporter.sendMail({
      from,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    });
    console.log(`[Email] ✅ Sent to ${params.to} — MessageId: ${info.messageId}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[Email] ❌ Failed to send to ${params.to}:`, err.message);
    return { success: false, error: err.message };
  }
}

// ────────────── EMAIL TEMPLATES ──────────────────────────────────

export function teamInviteEmail(params: {
  teamName: string;
  inviterEmail: string;
  inviteUrl: string;
  expiresAt: string;
  recipientEmail: string;
}): SendEmailParams {
  const { teamName, inviterEmail, inviteUrl, expiresAt, recipientEmail } = params;
  const expiry = new Date(expiresAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

  return {
    to: recipientEmail,
    subject: `You're invited to join ${teamName} on PolicyVault`,
    html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Team Invitation</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:40px 40px 32px;text-align:center;">
            <div style="background:rgba(255,255,255,0.15);border-radius:16px;width:56px;height:56px;margin:0 auto 16px;display:flex;align-items:center;justify-content:center;">
              <span style="font-size:28px;">🛡️</span>
            </div>
            <h1 style="color:#ffffff;font-size:24px;font-weight:800;margin:0 0 6px;">PolicyVault</h1>
            <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:0;">AI-Powered Insurance Management</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h2 style="color:#0f172a;font-size:20px;font-weight:700;margin:0 0 12px;">You're invited to join a team 🎉</h2>
            <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 20px;">
              <strong>${inviterEmail}</strong> has invited you to collaborate on
              <strong>${teamName}</strong> on PolicyVault.
            </p>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:16px;padding:20px;margin:24px 0;">
              <p style="margin:0;color:#1e40af;font-size:14px;font-weight:600;">🏢 Team: ${teamName}</p>
              <p style="margin:8px 0 0;color:#3b82f6;font-size:13px;">Role: Member</p>
            </div>

            <a href="${inviteUrl}" style="display:block;background:linear-gradient(135deg,#1e40af,#3b82f6);color:#ffffff;text-align:center;padding:16px;border-radius:14px;font-size:16px;font-weight:700;text-decoration:none;margin:24px 0;">
              Accept Invitation →
            </a>

            <p style="color:#94a3b8;font-size:12px;text-align:center;margin:16px 0 0;">
              This link expires on <strong>${expiry}</strong>.<br/>
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f8fafc;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">PolicyVault — Apex Solutions · Secure Insurance Management Platform</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `You've been invited to join ${teamName} on PolicyVault.\n\nAccept here: ${inviteUrl}\n\nExpires: ${expiry}`,
  };
}

export function otpEmail(params: {
  otp: string;
  purpose: 'signup' | 'login' | 'email-change';
  recipientEmail: string;
}): SendEmailParams {
  const purposes = {
    signup: 'Verify your email',
    login: 'Login verification',
    'email-change': 'Confirm email change',
  };

  return {
    to: params.recipientEmail,
    subject: `${params.otp} — Your PolicyVault verification code`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);padding:32px;text-align:center;">
            <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;">PolicyVault</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;text-align:center;">
            <h2 style="color:#0f172a;font-size:18px;margin:0 0 8px;">${purposes[params.purpose]}</h2>
            <p style="color:#64748b;font-size:14px;margin:0 0 32px;">Enter this code in the app. Valid for 5 minutes.</p>

            <div style="background:#eff6ff;border:2px solid #3b82f6;border-radius:16px;padding:24px;display:inline-block;margin-bottom:24px;">
              <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#1e40af;">${params.otp}</span>
            </div>

            <p style="color:#94a3b8;font-size:12px;margin:0;">Max 3 attempts. Do not share this code.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">PolicyVault — If you didn't request this, ignore it.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Your PolicyVault verification code: ${params.otp}\nValid for 5 minutes. Max 3 attempts.`,
  };
}

export function reminderEmail(params: {
  customerName: string;
  policyNumber: string;
  policyCategory?: string;
  insurerName?: string;
  policyInsights?: string[];
  dueDate: string;
  reminderType: 'renewal' | 'premium';
  premiumAmount?: number;
  recipientEmail: string;
  agencyName?: string;
  agencyContact?: string;
}): SendEmailParams {
  const { 
    customerName, 
    policyNumber, 
    policyCategory = 'General',
    insurerName = '',
    policyInsights = [],
    dueDate, 
    reminderType, 
    premiumAmount, 
    recipientEmail,
    agencyName = 'PolicyVault',
    agencyContact = ''
  } = params;

  const typeLabel = reminderType === 'renewal' ? 'Policy Renewal' : 'Premium Payment';
  const due = new Date(dueDate).toLocaleDateString('en-IN', { dateStyle: 'long' });
  
  // Logic: Only show amount for Life Insurance. For others, hide it to prevent confusion with variable renewal rates.
  const isLifeInsurance = policyCategory.toLowerCase().includes('life');
  const showAmount = isLifeInsurance && premiumAmount && premiumAmount > 0;

  return {
    to: recipientEmail,
    subject: `Reminder: ${policyCategory} ${typeLabel} due on ${due} — Policy ${policyNumber}`,
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#f59e0b,#f97316);padding:32px;text-align:center;">
            <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0 0 4px;">${agencyName}</h1>
            <p style="color:rgba(255,255,255,0.85);font-size:13px;margin:0;">📅 ${policyCategory} ${typeLabel} Reminder</p>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <p style="font-size:16px;color:#0f172a;margin:0 0 20px;">Dear <strong>${customerName}</strong>,</p>
            <p style="font-size:15px;color:#475569;margin:0 0 16px;line-height:1.6;">
              This is a reminder that your <strong>${policyCategory} ${typeLabel.toLowerCase()}</strong> for policy
              <strong>${policyNumber}</strong> is due on <strong>${due}</strong>.
            </p>

            ${insurerName ? `
            <div style="background:#f1f5f9;border-left:4px solid #3b82f6;padding:12px 16px;margin-bottom:20px;">
              <p style="margin:0;font-size:13px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Insurer</p>
              <p style="margin:2px 0 0;font-size:16px;color:#1e40af;font-weight:800;">${insurerName}</p>
            </div>
            ` : ''}

            <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:20px;margin-bottom:24px;">
              ${showAmount ? `
                <p style="margin:0 0 4px;color:#c2410c;font-size:12px;text-transform:uppercase;font-weight:800;letter-spacing:1px;">Premium Amount</p>
                <p style="margin:0;color:#c2410c;font-weight:900;font-size:24px;">₹${premiumAmount?.toLocaleString('en-IN')}</p>
              ` : `
                <p style="margin:0 0 4px;color:#c2410c;font-size:12px;text-transform:uppercase;font-weight:800;letter-spacing:1px;">Renewal Quote</p>
                <p style="margin:0;color:#c2410c;font-weight:900;font-size:18px;">Contact Us for Exact Amount</p>
              `}
            </div>

            ${policyInsights && policyInsights.length > 0 ? `
            <div style="margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:11px;font-weight:800;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">Policy Highlights</p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">
                ${policyInsights.map(insight => `
                  <span style="background:#f8fafc;border:1px solid #e2e8f0;padding:6px 12px;border-radius:8px;font-size:12px;color:#475569;font-weight:700;display:inline-block;margin-bottom:6px;margin-right:6px;">${insight}</span>
                `).join('')}
              </div>
            </div>
            ` : ''}

            <div style="background:#f8fafc;border-radius:12px;padding:16px;margin-bottom:20px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;">Next Steps</p>
              <p style="margin:0;font-size:14px;color:#334155;line-height:1.5;">
                Please ensure timely action to avoid policy lapse. To renew or for any queries, please reach out to:
                <br/><br/>
                <strong>${agencyName}</strong><br/>
                ${agencyContact ? `<span style="color:#d97706;font-weight:700;">${agencyContact}</span>` : ''}
              </p>
            </div>
            
            <p style="color:#94a3b8;font-size:12px;margin:0;">Thank you for choosing ${agencyName} for your insurance needs.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:11px;margin:0;">${agencyName} — Powered by PolicyVault AI</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Hi ${customerName}, your ${insurerName} ${policyCategory} ${typeLabel} for policy ${policyNumber} is due on ${due}. ${showAmount ? `Amount: ₹${premiumAmount}` : 'Contact Us for exact renewal amount.'} — ${agencyName}`,
  };
}
