'use client';

import { useRouter } from 'next/navigation';
import { AccountSettings } from '@/components/account-settings';
import { PreferenceSettings } from '@/components/preference-settings';
import { PrivacySettings } from '@/components/privacy-settings';
import { ProfileSettings } from '@/components/profile-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SettingsTab } from '@/lib/settings-tabs';

type SettingsProfile = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio: string | null;
  interests: string[];
  friendsOnlyPosts: boolean;
};

export function SettingsTabs({
  profile,
  tab,
}: {
  profile: SettingsProfile;
  // The active tab, resolved from the URL by the page. Defaults to "profile".
  tab: SettingsTab;
}) {
  const router = useRouter();

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        // Keep the URL in sync so /app/settings/<tab> is shareable and
        // browser back/forward works, without a full page reload.
        router.push(`/app/settings/${v}`, { scroll: false });
      }}
      className='w-full'
    >
      <TabsList className='mb-6 w-full justify-start'>
        <TabsTrigger value='profile'>Profile</TabsTrigger>
        <TabsTrigger value='account'>Account</TabsTrigger>
        <TabsTrigger value='privacy'>Privacy</TabsTrigger>
        <TabsTrigger value='preferences'>Preferences</TabsTrigger>
      </TabsList>

      <TabsContent value='profile'>
        <ProfileSettings profile={profile} />
      </TabsContent>
      <TabsContent value='account'>
        <AccountSettings />
      </TabsContent>
      <TabsContent value='privacy'>
        <PrivacySettings initialFriendsOnlyPosts={profile.friendsOnlyPosts} />
      </TabsContent>
      <TabsContent value='preferences'>
        <PreferenceSettings />
      </TabsContent>
    </Tabs>
  );
}
