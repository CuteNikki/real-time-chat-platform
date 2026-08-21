'use client';

import { redirect } from 'next/navigation';

import { useTranslation } from 'react-i18next';

import { useSession } from '@/lib/auth-client';

import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function SignInPage() {
  const { data: session, isPending } = useSession();
  const { t } = useTranslation();

  if (isPending) return null;

  if (session?.user) redirect('/app');

  return (
    <AuthShell
      title={t('auth.signInPage.title')}
      subtitle={t('auth.signInPage.subtitle')}
    >
      <AuthForm mode='sign-in' />
    </AuthShell>
  );
}
