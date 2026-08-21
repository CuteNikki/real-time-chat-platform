'use client';

import { redirect } from 'next/navigation';

import { useTranslation } from 'react-i18next';

import { useSession } from '@/lib/auth-client';

import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function SignUpPage() {
  const { data: session, isPending } = useSession();
  const { t } = useTranslation();

  if (isPending) return null;

  if (session?.user) redirect('/app');

  return (
    <AuthShell
      title={t('auth.signUpPage.title')}
      subtitle={t('auth.signUpPage.subtitle')}
    >
      <AuthForm mode='sign-up' />
    </AuthShell>
  );
}
