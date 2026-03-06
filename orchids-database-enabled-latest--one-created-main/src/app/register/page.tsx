'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, Shield, UserCircle, Stethoscope } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { connectMetaMask, isMetaMaskInstalled } from '@/lib/blockchain';
import { createUser, getUserByEmail, getUserByUsername } from '@/lib/supabase/storage';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
      confirmPassword: '',
      role: '' as 'patient' | 'doctor' | '',
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.username || !formData.email || !formData.password || !formData.role) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

    if (!strongPasswordRegex.test(formData.password)) {
      setError('Password must be at least 8 characters long and include uppercase, lowercase, number, and symbol');
      return;
    }

    // Check MetaMask
    if (!isMetaMaskInstalled()) {
      setError('MetaMask is not installed. Please install MetaMask extension to continue.');
      return;
    }

    setIsLoading(true);

    try {
      // Check for duplicate email or username
      const existingEmail = await getUserByEmail(formData.email);
      if (existingEmail) {
        setError('Email already exists');
        setIsLoading(false);
        return;
      }

      const existingUsername = await getUserByUsername(formData.username);
      if (existingUsername) {
        setError('Username already exists');
        setIsLoading(false);
        return;
      }

      // Connect to MetaMask and get blockchain address
      const blockchainAddress = await connectMetaMask();

      // Create user in Supabase
      const newUser = await createUser({
        email: formData.email,
        username: formData.username,
        password: formData.password,
        role: formData.role as 'patient' | 'doctor',
          blockchainAddress,
      });

      login(newUser);

      // Redirect to appropriate dashboard
      router.push(formData.role === 'patient' ? '/patient/dashboard' : '/doctor/dashboard');
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <Card className="border-border/50 shadow-2xl bg-card/80 backdrop-blur-xl hover:shadow-primary/10 transition-all duration-300">
          <CardHeader className="space-y-1 text-center">
            <motion.div 
              className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.2, type: 'spring' }}
              whileHover={{ rotate: 360, scale: 1.1 }}
            >
              <Shield className="h-6 w-6 text-primary" />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
              <CardDescription>Register with blockchain verification</CardDescription>
            </motion.div>
          </CardHeader>
          <CardContent>
            <motion.form 
              onSubmit={handleSubmit} 
              className="space-y-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
            >
              {error && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}

            <motion.div
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
              >
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Enter unique username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  disabled={isLoading}
                  className="transition-all focus:scale-[1.02]"
                />
              </motion.div>

              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
              >
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isLoading}
                  className="transition-all focus:scale-[1.02]"
                />
              </motion.div>

              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.7 }}
              >
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Min 8 chars, Upper, Lower, Number, Symbol"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    disabled={isLoading}
                    className="transition-all focus:scale-[1.02]"
                  />
                  <div className="text-[10px] text-muted-foreground mt-1 grid grid-cols-2 gap-1">
                    <span className={formData.password.length >= 8 ? 'text-primary' : ''}>• Min 8 characters</span>
                    <span className={/[A-Z]/.test(formData.password) ? 'text-primary' : ''}>• Uppercase letter</span>
                    <span className={/[a-z]/.test(formData.password) ? 'text-primary' : ''}>• Lowercase letter</span>
                    <span className={/\d/.test(formData.password) ? 'text-primary' : ''}>• Number</span>
                      <span className={/[^A-Za-z0-9\s]/.test(formData.password) ? 'text-primary' : ''}>• Special character</span>
                  </div>
              </motion.div>

              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.8 }}
              >
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter password"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  disabled={isLoading}
                  className="transition-all focus:scale-[1.02]"
                />
              </motion.div>

              <motion.div 
                className="space-y-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.9 }}
              >
                <Label>Select Role</Label>
                <div className="grid grid-cols-2 gap-3">
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'patient' })}
                      disabled={isLoading}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        formData.role === 'patient'
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <UserCircle className="h-8 w-8 mx-auto mb-2" />
                      <div className="font-medium">Patient</div>
                    </button>
                  </motion.div>
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, role: 'doctor' })}
                      disabled={isLoading}
                      className={`w-full p-4 rounded-lg border-2 transition-all ${
                        formData.role === 'doctor'
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Stethoscope className="h-8 w-8 mx-auto mb-2" />
                      <div className="font-medium">Doctor</div>
                    </button>
                  </motion.div>
                </div>
              </motion.div>

              <motion.div 
                className="pt-2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 1.0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Connecting to MetaMask...
                    </>
                  ) : (
                    'Register & Connect Wallet'
                  )}
                </Button>
              </motion.div>

              <motion.div 
                className="text-center text-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 1.1 }}
              >
                <span className="text-muted-foreground">Already have an account? </span>
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Login
                </Link>
              </motion.div>
            </motion.form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
