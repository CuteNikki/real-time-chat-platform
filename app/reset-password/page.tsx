import { AuthShell } from '@/components/auth/auth-shell';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { getTranslation } from '@/lib/i18n/server';

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const { t } = await getTranslation();

  return (
    <AuthShell
      title={t('auth.resetPage.title')}
      subtitle={t('auth.resetPage.subtitle')}
    >
      <ResetPasswordForm token={token ?? null} tokenError={error ?? null} />
    </AuthShell>
  );
}
