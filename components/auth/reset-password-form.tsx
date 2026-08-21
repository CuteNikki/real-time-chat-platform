'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { resetPassword } from '@/lib/auth-client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function ResetPasswordForm({
  token,
  tokenError,
}: {
  token: string | null;
  tokenError: string | null;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalidToken = !token || !!tokenError;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('auth.reset.mismatch'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await resetPassword({
        newPassword: password,
        token: token!,
      });
      if (error) throw new Error(error.message || t('auth.reset.errReset'));
      router.push('/sign-in');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.reset.errGeneric'));
      setLoading(false);
    }
  }

  if (invalidToken) {
    return (
      <div className='flex flex-col gap-2'>
        <p className='text-destructive text-sm' role='alert'>
          {t('auth.reset.invalidToken')}
        </p>
        <Link
          href='/forgot-password'
          className='text-foreground text-center text-sm font-medium underline'
        >
          {t('auth.reset.requestNew')}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='password'>{t('auth.reset.newPassword')}</Label>
        <Input
          id='password'
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.reset.passwordPlaceholder')}
          required
          minLength={8}
          autoComplete='new-password'
        />
      </div>
      <div className='flex flex-col gap-2'>
        <Label htmlFor='confirm'>{t('auth.reset.confirmPassword')}</Label>
        <Input
          id='confirm'
          type='password'
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={t('auth.reset.confirmPlaceholder')}
          required
          minLength={8}
          autoComplete='new-password'
        />
      </div>

      {error && (
        <p className='text-destructive text-center text-sm' role='alert'>
          {error}
        </p>
      )}

      <Button type='submit' disabled={loading} size='lg'>
        {loading && <Loader2Icon className='animate-spin' aria-hidden />}
        {loading ? t('auth.reset.saving') : t('auth.reset.submit')}
      </Button>
    </form>
  );
}
