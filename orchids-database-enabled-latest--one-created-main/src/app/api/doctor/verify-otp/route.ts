import { NextRequest, NextResponse } from 'next/server';
import { otpStore } from '@/lib/otpStore';

export async function POST(req: NextRequest) {
    try {
        const { email, otp } = await req.json();

        if (!email || !otp) {
            return NextResponse.json({ error: 'email and otp are required' }, { status: 400 });
        }

        const record = otpStore.get(email.toLowerCase());

        if (!record) {
            return NextResponse.json({ valid: false, error: 'No OTP found. Please request a new one.' });
        }

        if (Date.now() > record.expiresAt) {
            otpStore.delete(email.toLowerCase());
            return NextResponse.json({ valid: false, error: 'OTP has expired. Please request a new one.' });
        }

        if (record.otp !== otp.trim()) {
            return NextResponse.json({ valid: false, error: 'Invalid OTP. Please check your email and try again.' });
        }

        // OTP verified — remove it so it can't be reused
        otpStore.delete(email.toLowerCase());
        return NextResponse.json({ valid: true });
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error('[verify-otp] Error:', message);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
