'use client';

import { useState, useEffect } from 'react';
import { verifyDoctorPassword } from '@/lib/supabase/storage';

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Shield,
    Lock,
    Building2,
    Mail,
    CheckCircle,
    AlertTriangle,
    Loader2,
    RefreshCw,
} from 'lucide-react';

export interface MFAVerificationResult {
    verified: boolean;
    hospitalName: string;
    verifiedAt: string;
    doctorEmail: string;
}

interface EmergencyMFAModalProps {
    isOpen: boolean;
    onClose: () => void;
    onVerified: (result: MFAVerificationResult) => void;
    doctorId: string;           // used to verify password against DB
    doctorHospitalId: string;     // the doctor's registered hospital ID
    doctorHospitalName: string;   // hospital name from profile
    doctorEmail: string;          // email for OTP
}


type MFAStep = 'password' | 'hospitalId' | 'otp' | 'success';

export function EmergencyMFAModal({
    isOpen,
    onClose,
    onVerified,
    doctorId,
    doctorHospitalId,
    doctorHospitalName,
    doctorEmail,
}: EmergencyMFAModalProps) {
    const [step, setStep] = useState<MFAStep>('password');
    const [passwordInput, setPasswordInput] = useState('');
    const [hospitalIdInput, setHospitalIdInput] = useState('');
    const [otpInput, setOtpInput] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [otpExpiresIn, setOtpExpiresIn] = useState(0);
    const [otpTimerInterval, setOtpTimerInterval] = useState<NodeJS.Timeout | null>(null);

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setStep('password');
            setPasswordInput('');
            setHospitalIdInput('');
            setOtpInput('');
            setError('');
            setOtpSent(false);
            setOtpExpiresIn(0); // always reset timer on fresh open
        } else {
            if (otpTimerInterval) clearInterval(otpTimerInterval);
        }
    }, [isOpen]);

    const handlePasswordVerify = async () => {
        setError('');
        if (!passwordInput) {
            setError('Please enter your password');
            return;
        }
        setIsLoading(true);
        const isValid = await verifyDoctorPassword(doctorId, passwordInput);
        setIsLoading(false);
        if (!isValid) {
            setError('Incorrect password. Please try again.');
            return;
        }
        setStep('hospitalId');
        setPasswordInput('');
    };

    const handleHospitalIdVerify = () => {
        setError('');
        if (!hospitalIdInput) {
            setError('Please enter your Hospital ID');
            return;
        }
        // Check against stored hospital ID (case-insensitive)
        if (hospitalIdInput.trim().toLowerCase() !== doctorHospitalId.trim().toLowerCase()) {
            setError('Hospital ID does not match your registered ID. Access denied.');
            return;
        }
        setStep('otp');
        sendOTP();
    };

    const sendOTP = async () => {
        setIsLoading(true);
        setError('');
        try {
            const res = await fetch('/api/doctor/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: doctorEmail }),
            });
            const data = await res.json();

            if (!res.ok) {
                if (data.error === 'SMTP_NOT_CONFIGURED') {
                    setError('Email not configured. Check SMTP settings in .env then restart the server.');
                } else {
                    setError(`Failed to send OTP: ${data.error}`);
                }
                setIsLoading(false);
                return;
            }

            setOtpSent(true);
            setIsLoading(false);
            setOtpExpiresIn(180); // 3 minutes

            if (otpTimerInterval) clearInterval(otpTimerInterval);
            const interval = setInterval(() => {
                setOtpExpiresIn((prev) => {
                    if (prev <= 1) {
                        clearInterval(interval);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            setOtpTimerInterval(interval);
        } catch {
            setError('Failed to send OTP. Check your network connection.');
            setIsLoading(false);
        }
    };

    const handleOTPVerify = async () => {
        setError('');
        if (!otpInput) {
            setError('Please enter the OTP sent to your email');
            return;
        }
        if (otpExpiresIn === 0) {
            setError('OTP has expired. Please request a new one.');
            return;
        }
        setIsLoading(true);
        try {
            const res = await fetch('/api/doctor/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: doctorEmail, otp: otpInput }),
            });
            const data = await res.json();
            setIsLoading(false);
            if (!data.valid) {
                setError(data.error || 'Invalid OTP. Please try again.');
                return;
            }
        } catch {
            setIsLoading(false);
            setError('Verification failed. Check your network connection.');
            return;
        }
        // All 3 factors verified!
        if (otpTimerInterval) clearInterval(otpTimerInterval);
        setStep('success');
        setTimeout(() => {
            onVerified({
                verified: true,
                hospitalName: doctorHospitalName,
                verifiedAt: new Date().toISOString(),
                doctorEmail,
            });
        }, 1000);
    };

    const handleResendOTP = () => {
        setOtpInput('');
        setError('');
        sendOTP();
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60).toString().padStart(2, '0');
        const s = (seconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    const stepInfo = [
        { id: 'password', label: 'Password', icon: Lock },
        { id: 'hospitalId', label: 'Hospital ID', icon: Building2 },
        { id: 'otp', label: 'Email OTP', icon: Mail },
    ];

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-[480px] border-destructive/30">
                <DialogHeader>
                    <div className="flex items-center gap-3 text-destructive mb-1">
                        <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            <Shield className="h-5 w-5 animate-pulse" />
                        </div>
                        <div>
                            <DialogTitle className="text-destructive text-lg">
                                Emergency Access — Multi-Factor Verification
                            </DialogTitle>
                        </div>
                    </div>
                    <DialogDescription className="text-sm leading-relaxed">
                        To prevent unauthorized emergency access, you must complete{' '}
                        <strong>3 verification steps</strong>. This access will be permanently
                        logged and the patient will be notified.
                    </DialogDescription>
                </DialogHeader>

                {/* Step Indicator */}
                <div className="flex items-center gap-2 py-2">
                    {stepInfo.map((s, i) => {
                        const Icon = s.icon;
                        const isActive = s.id === step;
                        const isDone =
                            stepInfo.findIndex((x) => x.id === step) > i ||
                            step === 'success';
                        return (
                            <div key={s.id} className="flex items-center gap-2 flex-1">
                                <div
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${isDone
                                        ? 'bg-primary/20 text-primary'
                                        : isActive
                                            ? 'bg-destructive/20 text-destructive ring-1 ring-destructive/50'
                                            : 'bg-muted text-muted-foreground'
                                        }`}
                                >
                                    {isDone ? (
                                        <CheckCircle className="h-3 w-3" />
                                    ) : (
                                        <Icon className="h-3 w-3" />
                                    )}
                                    <span className="hidden sm:inline">{s.label}</span>
                                    <span className="sm:hidden">{i + 1}</span>
                                </div>
                                {i < stepInfo.length - 1 && (
                                    <div
                                        className={`h-px flex-1 transition-all ${isDone ? 'bg-primary/50' : 'bg-border'
                                            }`}
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Step Content */}
                <div className="space-y-4 py-2">
                    {error && (
                        <Alert variant="destructive" className="py-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertDescription className="text-xs">{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* Step 1: Password */}
                    {step === 'password' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <Lock className="h-4 w-4 text-destructive" />
                                Step 1: Re-enter Your Password
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Confirm your identity by entering your account password.
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="mfa-password">Password</Label>
                                <Input
                                    id="mfa-password"
                                    type="password"
                                    placeholder="Enter your password"
                                    value={passwordInput}
                                    onChange={(e) => setPasswordInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handlePasswordVerify()}
                                    className="border-destructive/30 focus-visible:ring-destructive/50"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Hospital ID */}
                    {step === 'hospitalId' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <Building2 className="h-4 w-4 text-destructive" />
                                Step 2: Hospital ID Verification
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Enter your registered Hospital ID to confirm you are authorized
                                to access emergency medical records at your hospital.
                            </p>
                            <div className="space-y-2">
                                <Label htmlFor="mfa-hospital-id">Hospital ID</Label>
                                <Input
                                    id="mfa-hospital-id"
                                    placeholder="Enter your Hospital ID"
                                    value={hospitalIdInput}
                                    onChange={(e) => setHospitalIdInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleHospitalIdVerify()}
                                    className="border-destructive/30 focus-visible:ring-destructive/50"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 3: OTP */}
                    {step === 'otp' && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold">
                                <Mail className="h-4 w-4 text-destructive" />
                                Step 3: Email OTP Verification
                            </div>
                            {isLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Sending OTP to {doctorEmail}...
                                </div>
                            ) : (
                                <>
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs">
                                        <p className="font-medium text-amber-600 dark:text-amber-400 mb-1">
                                            OTP sent to: {doctorEmail}
                                        </p>
                                        <p className="text-muted-foreground">
                                            Check your registered email for a 6-digit code.{' '}
                                            <span className="text-xs">(Check browser console for test OTP)</span>
                                        </p>
                                        {otpExpiresIn > 0 && (
                                            <p className="mt-1 font-mono text-destructive font-bold">
                                                Expires in: {formatTime(otpExpiresIn)}
                                            </p>
                                        )}
                                        {otpExpiresIn === 0 && (
                                            <p className="mt-1 text-destructive font-bold">OTP expired!</p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="mfa-otp">6-Digit OTP</Label>
                                        <Input
                                            id="mfa-otp"
                                            placeholder="Enter 6-digit OTP"
                                            value={otpInput}
                                            onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                            onKeyDown={(e) => e.key === 'Enter' && handleOTPVerify()}
                                            maxLength={6}
                                            className="font-mono text-lg tracking-widest text-center border-destructive/30 focus-visible:ring-destructive/50"
                                        />
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleResendOTP}
                                        className="text-xs gap-1"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Resend OTP
                                    </Button>
                                </>
                            )}
                        </div>
                    )}

                    {/* Success */}
                    {step === 'success' && (
                        <div className="flex flex-col items-center gap-3 py-4">
                            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-primary animate-in zoom-in duration-300" />
                            </div>
                            <p className="font-semibold text-primary">All 3 Factors Verified!</p>
                            <p className="text-xs text-muted-foreground text-center">
                                Multi-factor authentication successful. Granting emergency access...
                            </p>
                            <Badge variant="outline" className="border-primary/30 text-primary text-xs">
                                🔒 MFA Verified — Access Logged
                            </Badge>
                        </div>
                    )}
                </div>

                {step !== 'success' && (
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={onClose} size="sm">
                            Cancel
                        </Button>
                        {step === 'password' && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handlePasswordVerify}
                                disabled={!passwordInput || isLoading}
                            >
                                {isLoading ? (
                                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Verifying...</>
                                ) : (
                                    <><Lock className="h-3.5 w-3.5 mr-1.5" />Verify Password</>
                                )}
                            </Button>
                        )}
                        {step === 'hospitalId' && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleHospitalIdVerify}
                                disabled={!hospitalIdInput}
                            >
                                <Building2 className="h-3.5 w-3.5 mr-1.5" />
                                Verify Hospital ID
                            </Button>
                        )}
                        {step === 'otp' && !isLoading && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleOTPVerify}
                                disabled={otpInput.length !== 6 || otpExpiresIn === 0}
                            >
                                <Shield className="h-3.5 w-3.5 mr-1.5" />
                                Verify OTP & Access
                            </Button>
                        )}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
