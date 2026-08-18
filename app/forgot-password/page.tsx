'use client';

import { redirect } from 'next/navigation';

import { useSession } from '@/lib/auth-client';

import { AuthShell } from '@/components/auth-shell';
import { ForgotPasswordForm } from '@/components/forgot-password-form';

export default function ForgotPasswordPage() {
  const { data: session, isPending } = useSession();

  if (isPending) return null;

  if (session?.user) redirect('/app');

  return (
    <AuthShell
      title='Reset Your Password'
      subtitle="Enter your email and we'll send you a link to set a new password."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
