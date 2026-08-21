'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import {
  AtSignIcon,
  Bell,
  HeartIcon,
  LaptopIcon,
  Loader2Icon,
  MessageCircleIcon,
  MoonIcon,
  Play,
  SunIcon,
  UserCheck2Icon,
  UserPlus2Icon,
  Users2Icon,
  Volume1Icon,
  Volume2,
  Volume2Icon,
  VolumeIcon,
  VolumeXIcon,
} from 'lucide-react';

import { playNotificationSound } from '@/lib/notification-sound';
import type {
  NotificationCategory,
  NotificationPreferences,
} from '@/lib/types';

import { useNotificationPrefs } from '@/components/notification-prefs-provider';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

const CATEGORY_META: {
  key: NotificationCategory;
  label: string;
  description: string;
  icon: typeof Bell;
}[] = [
  {
    key: 'friendRequest',
    label: 'Friend Requests',
    description: 'When someone sends you a request',
    icon: UserPlus2Icon,
  },
  {
    key: 'friendAccept',
    label: 'Request Accepted',
    description: 'When someone accepts your request',
    icon: UserCheck2Icon,
  },
  {
    key: 'directMessage',
    label: 'Direct Messages',
    description: 'New messages in a private chat',
    icon: MessageCircleIcon,
  },
  {
    key: 'roomMessage',
    label: 'Room Messages',
    description: 'New messages in a group room',
    icon: Users2Icon,
  },
  {
    key: 'like',
    label: 'Post Likes',
    description: 'When someone likes your post',
    icon: HeartIcon,
  },
  {
    key: 'mention',
    label: 'Mentions',
    description: 'When someone @tags you in a post or bio',
    icon: AtSignIcon,
  },
];

export function PreferenceSettings() {
  const { prefs, update } = useNotificationPrefs();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function setMaster(
    patch: Partial<Pick<NotificationPreferences, 'soundEnabled' | 'volume'>>,
  ) {
    update({ ...prefs, ...patch });
  }

  function setCategory(
    key: NotificationCategory,
    patch: Partial<{ popup: boolean; sound: boolean }>,
  ) {
    update({
      ...prefs,
      categories: {
        ...prefs.categories,
        [key]: { ...prefs.categories[key], ...patch },
      },
    });
  }

  const volumePct = Math.round(prefs.volume * 100);

  return (
    <div className='space-y-4'>
      {/* Theme Appearance controls */}
      <section className='space-y-2'>
        <div className='flex items-center gap-2'>
          <SunIcon className='text-muted-foreground size-4' aria-hidden />
          <h2 className='text-lg font-semibold tracking-tight'>Appearance</h2>
        </div>

        <div className='border-border bg-card flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between'>
          <div className='min-w-0'>
            <p className='text-sm font-medium'>Theme Preference</p>
            <p className='text-muted-foreground text-sm'>
              Select how Orbit appears to you
            </p>
          </div>

          <div className='bg-muted flex w-fit items-center gap-1 rounded-lg p-1'>
            {!mounted ? (
              <>
                <Button variant='secondary' size='sm' disabled>
                  <Loader2Icon
                    className='size-4 shrink-0 animate-spin'
                    aria-hidden
                  />
                  Loading...  
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant={mounted && theme === 'light' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setTheme('light')}
                >
                  <SunIcon className='shrink-0' aria-hidden />
                  Light
                </Button>
                <Button
                  variant={mounted && theme === 'dark' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setTheme('dark')}
                >
                  <MoonIcon className='shrink-0' aria-hidden />
                  Dark
                </Button>
                <Button
                  variant={mounted && theme === 'system' ? 'default' : 'ghost'}
                  size='sm'
                  onClick={() => setTheme('system')}
                >
                  <LaptopIcon className='shrink-0' aria-hidden />
                  System
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Sound master controls */}
      <section className='space-y-2'>
        <div className='flex items-center gap-2'>
          <Volume2
            className='text-muted-foreground size-4 shrink-0'
            aria-hidden
          />
          <h2 className='text-lg font-semibold tracking-tight'>Sound</h2>
        </div>

        <div className='border-border bg-card flex items-center justify-between gap-2 rounded-xl border p-4'>
          <div className='min-w-0'>
            <p className='text-sm font-medium'>Play Notification Sounds</p>
            <p className='text-muted-foreground text-sm'>
              A short chime plays for enabled events
            </p>
          </div>
          <Switch
            checked={prefs.soundEnabled}
            onCheckedChange={(v) => setMaster({ soundEnabled: v })}
            aria-label='Play notification sounds'
          />
        </div>

        <div className='border-border bg-card rounded-xl border p-4'>
          <div className='flex items-center justify-between pb-2'>
            <label htmlFor='volume' className='text-sm font-medium'>
              Master Volume
            </label>
            <span className='text-muted-foreground flex items-center gap-2 text-sm tabular-nums'>
              {volumePct === 0 ? (
                <VolumeXIcon className='size-4 shrink-0' aria-hidden />
              ) : volumePct < 33 ? (
                <VolumeIcon className='size-4 shrink-0' aria-hidden />
              ) : volumePct < 66 ? (
                <Volume1Icon className='size-4 shrink-0' aria-hidden />
              ) : (
                <Volume2Icon className='size-4 shrink-0' aria-hidden />
              )}
              {volumePct}%
            </span>
          </div>
          <div className='flex items-center gap-6'>
            <Slider
              id='volume'
              value={prefs.volume}
              min={0}
              max={1}
              step={0.01}
              disabled={!prefs.soundEnabled}
              onValueChange={(v) =>
                setMaster({ volume: Array.isArray(v) ? v[0] : v })
              }
              className='data-disabled:opacity-50'
            />
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='shrink-0'
              disabled={!prefs.soundEnabled}
              onClick={() =>
                playNotificationSound('directMessage', prefs.volume)
              }
            >
              <Play className='shrink-0' aria-hidden />
              Test
            </Button>
          </div>
        </div>
      </section>

      {/* Per-event controls */}
      <section className='space-y-2'>
        <div className='flex items-center gap-2'>
          <Bell className='text-muted-foreground size-4 shrink-0' aria-hidden />
          <h2 className='text-lg font-semibold tracking-tight'>Events</h2>
        </div>
        <ul className='divide-border border-border bg-card divide-y overflow-hidden rounded-xl border'>
          <li className='p-4'>
            <div className='min-w-0'>
              <p className='text-sm font-medium'>
                Configure Notification Settings
              </p>
              <p className='text-muted-foreground text-sm'>
                Choose which events show a popup and which play a sound
              </p>
            </div>
          </li>
          {CATEGORY_META.map(({ key, label, description, icon: Icon }) => {
            const cat = prefs.categories[key];
            const soundOn = prefs.soundEnabled && cat.sound;
            return (
              <li
                key={key}
                className='flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'
              >
                <div className='flex min-w-0 items-start gap-3'>
                  <span className='bg-secondary text-secondary-foreground mt-0.5 grid size-8 shrink-0 place-items-center rounded-full'>
                    <Icon className='size-4 shrink-0' aria-hidden />
                  </span>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium'>{label}</p>
                    <p className='text-muted-foreground text-sm'>
                      {description}
                    </p>
                  </div>
                </div>
                <div className='flex items-center gap-6 sm:pl-0'>
                  <label className='flex items-center gap-2 text-sm'>
                    <span className='text-muted-foreground'>Popup</span>
                    <Switch
                      checked={cat.popup}
                      onCheckedChange={(v) => setCategory(key, { popup: v })}
                      aria-label={`${label} popup`}
                    />
                  </label>
                  <label className='flex items-center gap-2 text-sm'>
                    <span className='text-muted-foreground'>Sound</span>
                    <Switch
                      checked={cat.sound}
                      onCheckedChange={(v) => setCategory(key, { sound: v })}
                      aria-label={`${label} sound`}
                    />
                  </label>
                  <Button
                    type='button'
                    variant='ghost'
                    size='icon'
                    disabled={!soundOn}
                    onClick={() => playNotificationSound(key, prefs.volume)}
                    aria-label={`Preview ${label} sound`}
                  >
                    <Play className='shrink-0' aria-hidden />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
