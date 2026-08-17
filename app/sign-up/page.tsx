import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { AuthShell } from '@/components/auth-shell';
import { AuthForm } from '@/components/auth-form';

export default async function SignUpPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session?.user) redirect('/app');

  return (
    <AuthShell
      title='Create your account'
      subtitle='Set up a profile and start meeting people in seconds.'
    >
      <AuthForm mode='sign-up' />
    </AuthShell>
  );
}
