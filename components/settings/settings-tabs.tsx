'use client';

import { useRouter } from 'next/navigation';

import type { SettingsTab } from '@/lib/settings-tabs';

import { AccountSettings } from '@/components/settings/account';
import { PreferenceSettings } from '@/components/settings/preferences';
import { PrivacySettings } from '@/components/settings/privacy';
import { ProfileSettings } from '@/components/settings/profile';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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
  tab: SettingsTab;
}) {
  const router = useRouter();

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => {
        router.push(`/app/settings/${v}`, { scroll: false });
      }}
      className='w-full'
    >
      <div className='relative sm:mx-0 pb-4'>
        <div className='overflow-x-auto overflow-y-hidden scrollbar-none px-4 sm:overflow-visible sm:px-0'>
          <TabsList className='w-max sm:w-fit'>
            <TabsTrigger value='profile' className='flex-none px-2'>
              Profile
            </TabsTrigger>
            <TabsTrigger value='account' className='flex-none px-2'>
              Account
            </TabsTrigger>
            <TabsTrigger value='privacy' className='flex-none px-2'>
              Privacy
            </TabsTrigger>
            <TabsTrigger value='preferences' className='flex-none px-2'>
              Preferences
            </TabsTrigger>
          </TabsList>
        </div>
        <div
          className='pointer-events-none absolute inset-y-0 left-0 w-4 bg-linear-to-r from-background to-transparent sm:hidden'
          aria-hidden
        />
        <div
          className='pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-background to-transparent sm:hidden'
          aria-hidden
        />
      </div>

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
