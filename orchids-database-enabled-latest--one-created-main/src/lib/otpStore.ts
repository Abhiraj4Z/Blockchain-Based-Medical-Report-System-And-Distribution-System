// Shared in-memory OTP store — pinned to `global` so it survives Next.js hot reloads
// (plain module-level Maps get reset on every hot reload, causing false "OTP expired" errors)
declare global {
    // eslint-disable-next-line no-var
    var _otpStore: Map<string, { otp: string; expiresAt: number }> | undefined;
}

if (!global._otpStore) {
    global._otpStore = new Map();
}

export const otpStore = global._otpStore;

