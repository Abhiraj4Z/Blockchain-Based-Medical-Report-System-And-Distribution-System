import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { otpStore } from '@/lib/otpStore';

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export async function POST(req: NextRequest) {
  try {
    const { email, doctorName } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpUser || !smtpPass || smtpUser === 'your-gmail@gmail.com') {
      return NextResponse.json(
        { error: 'SMTP_NOT_CONFIGURED' },
        { status: 503 }
      );
    }

    const otp = generateOTP();
    const expiresAt = Date.now() + 3 * 60 * 1000; // 3 minutes
    otpStore.set(email.toLowerCase(), { otp, expiresAt });

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `MediChain Emergency <${smtpUser}>`,
      to: email,
      subject: '🔐 MediChain Emergency Access OTP',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#fff;border:1px solid #e5e7eb;border-radius:12px;">
          <div style="color:#dc2626;font-size:13px;font-weight:700;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">⚠️ Emergency Access Verification</div>
          <h2 style="margin:0 0 12px;font-size:20px;color:#111827;">One-Time Password</h2>
          <p style="color:#6b7280;font-size:14px;margin-bottom:20px;">
            Dr. <strong>${doctorName || email}</strong> is requesting emergency patient record access on MediChain.
          </p>
          <div style="background:#fef2f2;border:2px solid #fca5a5;border-radius:10px;padding:24px;text-align:center;margin-bottom:20px;">
            <div style="font-family:monospace;font-size:40px;font-weight:800;letter-spacing:10px;color:#dc2626;">${otp}</div>
            <div style="color:#ef4444;font-size:12px;margin-top:8px;font-weight:500;">⏱ Expires in 3 minutes</div>
          </div>
          <p style="color:#9ca3af;font-size:12px;border-top:1px solid #f3f4f6;padding-top:16px;margin:0;">
            If you did not initiate this request, someone may be attempting unauthorized emergency access. Contact your security team immediately.
          </p>
        </div>
      `,
    });

    console.log(`[send-otp] OTP sent to ${email}`);
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[send-otp] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
