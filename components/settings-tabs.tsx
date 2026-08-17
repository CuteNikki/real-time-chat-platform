'use client';

import { AccountSettings } from '@/components/account-settings';
import { PreferenceSettings } from '@/components/preference-settings';
import { ProfileSettings } from '@/components/profile-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SettingsProfile = {
  id: string;
  name: string;
  username: string;
  image: string | null;
  bio: string | null;
  interests: string[];
};

export function SettingsTabs({ profile }: { profile: SettingsProfile }) {
  return (
    <Tabs defaultValue='profile' className='w-full'>
      <TabsList className='mb-6 w-full justify-start'>
        <TabsTrigger value='profile'>Profile</TabsTrigger>
        <TabsTrigger value='account'>Account</TabsTrigger>
        <TabsTrigger value='preferences'>Preferences</TabsTrigger>
      </TabsList>

      <TabsContent value='profile'>
        <ProfileSettings profile={profile} />
      </TabsContent>
      <TabsContent value='account'>
        <AccountSettings />
      </TabsContent>
      <TabsContent value='preferences'>
        <PreferenceSettings />
      </TabsContent>
    </Tabs>
  );
}
