'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BlockchainTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  onSuccess?: () => void | Promise<void>;
  title: string;
  description: string;
}

export function BlockchainTransactionModal({
  isOpen,
  onClose,
  onConfirm,
  onSuccess,
  title,
  description,
}: BlockchainTransactionModalProps) {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setTxHash('');
      setError('');
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setStatus('processing');
    setError('');

    try {
      await onConfirm();
      // Simulate blockchain transaction hash
      const hash = '0x' + Math.random().toString(16).substring(2, 66);
      setTxHash(hash);
      setStatus('success');

      // Auto-close after success
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
      setStatus('error');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card/95 backdrop-blur-xl border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {status === 'idle' && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-lg bg-muted/50 border border-border/50">
                <p className="text-sm text-muted-foreground">
                  This action requires blockchain confirmation via MetaMask.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button onClick={handleConfirm} className="bg-primary hover:bg-primary/90">
                  Confirm Transaction
                </Button>
              </div>
            </div>
          )}

          {status === 'processing' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">Processing Transaction...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Please confirm in MetaMask
                </p>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="rounded-full bg-green-500/10 p-3">
                <CheckCircle2 className="h-12 w-12 text-green-500" />
              </div>
              <div className="text-center">
                <p className="font-medium text-green-500">Transaction Successful!</p>
                <p className="text-xs text-muted-foreground mt-2 font-mono break-all">
                  {txHash}
                </p>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="rounded-full bg-destructive/10 p-3">
                <XCircle className="h-12 w-12 text-destructive" />
              </div>
              <div className="text-center">
                <p className="font-medium text-destructive">Transaction Failed</p>
                <p className="text-sm text-muted-foreground mt-2">{error}</p>
              </div>
              <Button onClick={onClose} variant="outline" className="mt-2">
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
