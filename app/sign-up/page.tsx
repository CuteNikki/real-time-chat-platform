'use client';

import { redirect } from 'next/navigation';

import { useSession } from '@/lib/auth-client';

import { AuthForm } from '@/components/auth/auth-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function SignUpPage() {
  const { data: session, isPending } = useSession();

  if (isPending) return null;

  if (session?.user) redirect('/app');

  return (
    <AuthShell
      title='Create Your Account'
      subtitle='Set up a profile and start meeting people in seconds.'
    >
      <AuthForm mode='sign-up' />
    </AuthShell>
  );
}
