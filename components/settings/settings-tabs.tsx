'use client';

import { useEffect, useState, type ReactNode } from 'react';

import { motion, useReducedMotion } from 'motion/react';

import {
  isSettingsTab,
  normalizeSettingsTab,
  type SettingsTab,
} from '@/lib/settings-tabs';

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
  const [active, setActive] = useState<SettingsTab>(tab);
  const reduce = useReducedMotion();

  // A real navigation (e.g. the nav's Settings link, or a shared ?tab= URL)
  // re-renders the server component with a new tab; client switches use
  // pushState below and leave this prop untouched, so they don't fight it.
  useEffect(() => setActive(tab), [tab]);

  // Browser back/forward: pushState URLs don't re-run the server component, so
  // read the active tab straight off the URL when the history entry changes.
  useEffect(() => {
    function sync() {
      setActive(
        normalizeSettingsTab(
          new URLSearchParams(window.location.search).get('tab'),
        ),
      );
    }
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  function selectTab(value: string) {
    if (!isSettingsTab(value) || value === active) return;
    setActive(value);
    // Sync the URL without a server round-trip, so switching stays instant and
    // animates entirely on the client.
    window.history.pushState(null, '', `/app/settings?tab=${value}`);
  }

  return (
    <Tabs value={active} onValueChange={selectTab} className='w-full'>
      <div className='relative pb-4 sm:mx-0'>
        <div className='scrollbar-none overflow-x-auto overflow-y-hidden px-4 sm:overflow-visible sm:px-0'>
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
          className='from-background pointer-events-none absolute inset-y-0 left-0 w-4 bg-linear-to-r to-transparent sm:hidden'
          aria-hidden
        />
        <div
          className='from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l to-transparent sm:hidden'
          aria-hidden
        />
      </div>

      <TabsContent value='profile'>
        <SettingsPanel reduce={reduce}>
          <ProfileSettings profile={profile} />
        </SettingsPanel>
      </TabsContent>
      <TabsContent value='account'>
        <SettingsPanel reduce={reduce}>
          <AccountSettings />
        </SettingsPanel>
      </TabsContent>
      <TabsContent value='privacy'>
        <SettingsPanel reduce={reduce}>
          <PrivacySettings initialFriendsOnlyPosts={profile.friendsOnlyPosts} />
        </SettingsPanel>
      </TabsContent>
      <TabsContent value='preferences'>
        <SettingsPanel reduce={reduce}>
          <PreferenceSettings />
        </SettingsPanel>
      </TabsContent>
    </Tabs>
  );
}

// Fades + lifts each tab panel in as it mounts. Radix unmounts inactive panels,
// so this replays on every switch. Inert under prefers-reduced-motion.
function SettingsPanel({
  children,
  reduce,
}: {
  children: ReactNode;
  reduce: boolean | null;
}) {
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
