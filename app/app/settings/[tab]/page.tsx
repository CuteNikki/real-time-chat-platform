import { notFound, redirect } from 'next/navigation';
import { getMyProfile } from '@/app/actions/profile';
import { SETTINGS_TABS, SettingsTabs, type SettingsTab } from '@/components/settings-tabs';

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
    <div className='h-full w-full scrollbar-gutter-stable overflow-y-auto'>
      <div className='mx-auto w-full max-w-2xl px-4 py-8'>
        <h1 className='mb-6 text-2xl font-semibold tracking-tight'>Settings</h1>
        <SettingsTabs profile={profile} tab={tab} />
      </div>
    </div>
  );
}
