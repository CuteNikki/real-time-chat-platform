import { getMyProfile } from '@/app/actions/profile';
import { SettingsTabs } from '@/components/settings-tabs';
import { SETTINGS_TABS, type SettingsTab } from '@/lib/settings-tabs';
import { notFound, redirect } from 'next/navigation';

function isSettingsTab(value: string): value is SettingsTab {
  return (SETTINGS_TABS as readonly string[]).includes(value);
}

export default async function SettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  // Unknown tab segments 404 instead of silently falling back, so a stale or
  // mistyped link is obvious rather than quietly showing the wrong tab.
  if (!isSettingsTab(tab)) notFound();

  const profile = await getMyProfile();
  if (!profile) redirect('/sign-in');

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto w-full max-w-2xl px-4 py-8'>
        <h1 className='mb-6 text-2xl font-semibold tracking-tight'>Settings</h1>
        <SettingsTabs profile={profile} tab={tab} />
      </div>
    </div>
  );
}
