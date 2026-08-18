'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CheckCircle2Icon, Loader2Icon } from 'lucide-react';

import { requestPasswordReset } from '@/lib/auth-client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      setSent(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className='flex flex-col gap-5'>
        <div className='border-border bg-card flex flex-col items-center gap-2 rounded-lg border p-4'>
          <div className='flex items-center gap-2'>
            <CheckCircle2Icon
              className='text-primary size-6 shrink-0'
              aria-hidden
            />
            <p className='font-semibold'>Check your email</p>
          </div>
          <p className='text-muted-foreground text-sm text-balance'>
            If an account exists for that address, a reset link is on its way.
          </p>
        </div>
        <Link
          href='/sign-in'
          className='text-foreground text-center text-sm font-medium underline'
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
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
        <p className='text-destructive text-center text-sm' role='alert'>
          {error}
        </p>
      )}

      <Button type='submit' disabled={loading} size='lg'>
        {loading && <Loader2Icon className='animate-spin' aria-hidden />}
        {loading ? 'Please wait…' : 'Reset Password'}
      </Button>

      <p className='text-muted-foreground text-center text-sm'>
        Remembered it?{' '}
        <Link href='/sign-in' className='text-foreground font-medium underline'>
          Sign in
        </Link>
      </p>
    </form>
  );
}
