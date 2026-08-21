'use client';

import { redirect } from 'next/navigation';

import { useTranslation } from 'react-i18next';

import { useSession } from '@/lib/auth-client';

import { AuthShell } from '@/components/auth/auth-shell';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

export default function ForgotPasswordPage() {
  const { data: session, isPending } = useSession();
  const { t } = useTranslation();

  if (isPending) return null;

  if (session?.user) redirect('/app');

  return (
    <AuthShell
      title={t('auth.forgotPage.title')}
      subtitle={t('auth.forgotPage.subtitle')}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
