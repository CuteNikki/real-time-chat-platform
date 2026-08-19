'use client';

import { redirect } from 'next/navigation';

import { useSession } from '@/lib/auth-client';

import { AuthForm } from '@/components/auth-form';
import { AuthShell } from '@/components/auth-shell';

export default function SignInPage() {
  const { data: session, isPending } = useSession();

  if (isPending) return null;

  if (session?.user) redirect('/app');

  return (
    <AuthShell
      title='Welcome Back!'
      subtitle='Sign in to jump back into the conversation.'
    >
      <AuthForm mode='sign-in' />
    </AuthShell>
  );
}
