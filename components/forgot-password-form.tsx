'use client';

import type React from 'react';

import { useState } from 'react';
import Link from 'next/link';
import { requestPasswordReset } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle2 } from 'lucide-react';

export function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // redirectTo is where the emailed link lands (our reset page).
      await requestPasswordReset({ email, redirectTo: '/reset-password' });
      // Always report success so we never reveal whether an email is registered.
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className='flex flex-col gap-5'>
        <div className='border-border bg-card flex items-start gap-3 rounded-lg border p-4'>
          <CheckCircle2
            className='text-primary mt-0.5 size-5 shrink-0'
            aria-hidden
          />
          <div className='text-sm leading-relaxed'>
            <p className='text-foreground font-medium'>Check your email</p>
            <p className='text-muted-foreground mt-1'>
              If an account exists for that address, a reset link is on its way.
            </p>
          </div>
        </div>
        <Link
          href='/sign-in'
          className='text-foreground text-center text-sm font-medium underline underline-offset-4'
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-5'>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='email'>Email</Label>
        <Input
          id='email'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='you@example.com'
          required
          autoComplete='email'
        />
      </div>

      {error && (
        <p className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      )}

      <Button type='submit' disabled={loading} className='mt-1 h-11 text-base'>
        {loading ? 'Sending…' : 'Send reset link'}
      </Button>

      <p className='text-muted-foreground text-center text-sm'>
        Remembered it?{' '}
        <Link
          href='/sign-in'
          className='text-foreground font-medium underline underline-offset-4'
        >
          Sign in
        </Link>
      </p>
    </form>
  );
}
