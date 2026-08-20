import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  return (
    <AuthShell
      title='Set Your Password'
      subtitle="Choose a strong password you don't use elsewhere."
    >
      <ResetPasswordForm token={token ?? null} tokenError={error ?? null} />
    </AuthShell>
  );
}
