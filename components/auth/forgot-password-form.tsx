'use client';

import Link from 'next/link';
import { useState } from 'react';

import { CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { requestPasswordReset } from '@/lib/auth-client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
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
      setError(err instanceof Error ? err.message : t('auth.forgot.error'));
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
            <p className='font-semibold'>{t('auth.forgot.checkTitle')}</p>
          </div>
          <p className='text-muted-foreground text-sm text-balance'>
            {t('auth.forgot.checkBody')}
          </p>
        </div>
        <Link
          href='/sign-in'
          className='text-foreground text-center text-sm font-medium underline'
        >
          {t('auth.forgot.backToSignIn')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='email'>{t('auth.form.email')}</Label>
        <Input
          id='email'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('auth.form.emailPlaceholder')}
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
        {loading ? t('auth.form.pleaseWait') : t('auth.forgot.submit')}
      </Button>

      <p className='text-muted-foreground text-center text-sm'>
        {t('auth.forgot.remembered')}{' '}
        <Link href='/sign-in' className='text-foreground font-medium underline'>
          {t('auth.forgot.signInLink')}
        </Link>
      </p>
    </form>
  );
}
