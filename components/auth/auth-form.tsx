'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { authClient } from '@/lib/auth-client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isSignUp = mode === 'sign-up';

  async function handleSubmit(e: React.SubmitEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await authClient.signUp.email({
          email,
          password,
          name,
        });
        if (error) throw new Error(error.message || t('auth.form.errCreate'));
      } else {
        const { error } = await authClient.signIn.email({ email, password });
        if (error) throw new Error(error.message || t('auth.form.errInvalid'));
      }
      router.push('/app');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.form.errGeneric'));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
      {isSignUp && (
        <div className='flex flex-col gap-2'>
          <Label htmlFor='name'>{t('auth.form.displayName')}</Label>
          <Input
            id='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('auth.form.displayNamePlaceholder')}
            required
            autoComplete='name'
          />
        </div>
      )}
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
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <Label htmlFor='password'>{t('auth.form.password')}</Label>
          {!isSignUp && (
            <Link
              href='/forgot-password'
              className='text-muted-foreground hover:text-foreground text-xs font-medium underline transition-colors'
            >
              {t('auth.form.forgotPassword')}
            </Link>
          )}
        </div>
        <Input
          id='password'
          type='password'
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('auth.form.passwordPlaceholder')}
          required
          minLength={8}
          maxLength={128}
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
        />
      </div>

      {error && (
        <p className='text-destructive text-center text-sm' role='alert'>
          {error}
        </p>
      )}

      <Button type='submit' disabled={loading} size='lg'>
        {loading && <Loader2Icon className='animate-spin' aria-hidden />}
        {loading
          ? t('auth.form.pleaseWait')
          : isSignUp
            ? t('auth.form.createAccount')
            : t('auth.form.signInButton')}
      </Button>

      <p className='text-muted-foreground text-center text-sm'>
        {isSignUp ? t('auth.form.haveAccount') : t('auth.form.newHere')}{' '}
        <Link
          href={isSignUp ? '/sign-in' : '/sign-up'}
          className='text-foreground font-medium underline'
        >
          {isSignUp ? t('auth.form.signInLink') : t('auth.form.createLink')}
        </Link>
      </p>
    </form>
  );
}
