import { redirect } from 'next/navigation';

import { getMyProfile } from '@/app/actions/profile';

import { getTranslation } from '@/lib/i18n/server';
import { normalizeSettingsTab } from '@/lib/settings-tabs';

import { SettingsTabs } from '@/components/settings/settings-tabs';
import { PageHeader } from '@/components/ui/page-header';

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await getMyProfile();
  if (!profile) redirect('/sign-in');

  const { tab } = await searchParams;
  const { t } = await getTranslation();

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto w-full max-w-2xl px-4 py-6'>
        <PageHeader title={t('settings.pageTitle')} className='pb-2' />
        <SettingsTabs profile={profile} tab={normalizeSettingsTab(tab)} />
      </div>
    </div>
  );
}
