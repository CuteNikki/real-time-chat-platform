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
      {/* On narrow screens, four equal-width tabs get too cramped to tap
          comfortably. Let the bar scroll horizontally at its natural size
          instead of squeezing labels — bleed to the page edges so it scrolls
          under the same padding the rest of the page uses. overflow-y-hidden
          is required alongside overflow-x-auto: CSS forces a "visible" y-axis
          to compute as "auto" once x is anything but visible, which is what
          was producing the stray vertical scrollbar. */}
      <div className='-mx-4 mb-6 overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:overflow-visible sm:px-0'>
        <TabsList className='w-max sm:w-fit'>
          <TabsTrigger value='profile' className='flex-none px-3'>
            Profile
          </TabsTrigger>
          <TabsTrigger value='account' className='flex-none px-3'>
            Account
          </TabsTrigger>
          <TabsTrigger value='privacy' className='flex-none px-3'>
            Privacy
          </TabsTrigger>
          <TabsTrigger value='preferences' className='flex-none px-3'>
            Preferences
          </TabsTrigger>
        </TabsList>
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
