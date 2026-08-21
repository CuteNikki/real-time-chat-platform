import { notFound, redirect } from 'next/navigation';

import { getMyProfile } from '@/app/actions/profile';

import { SETTINGS_TABS, type SettingsTab } from '@/lib/settings-tabs';

import { SettingsTabs } from '@/components/settings/settings-tabs';
import { PageHeader } from '@/components/ui/page-header';

function isSettingsTab(value: string): value is SettingsTab {
  return (SETTINGS_TABS as readonly string[]).includes(value);
}

export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  if (!isSettingsTab(tab)) notFound();

  const profile = await getMyProfile();
  if (!profile) redirect('/sign-in');

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto w-full max-w-2xl px-4 py-6'>
        <PageHeader title='Settings' className='pb-2' />
        <SettingsTabs profile={profile} tab={tab} />
      </div>
    </div>
  );
}
