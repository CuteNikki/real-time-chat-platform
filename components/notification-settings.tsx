'use client';

import {
  Bell,
  Volume2,
  VolumeX,
  Play,
  UserPlus,
  UserCheck,
  MessageCircle,
  Users,
  Heart,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useNotificationPrefs } from '@/components/notification-prefs-provider';
import { playNotificationSound } from '@/lib/notification-sound';
import type {
  NotificationCategory,
  NotificationPreferences,
} from '@/lib/types';

const CATEGORY_META: {
  key: NotificationCategory;
  label: string;
  description: string;
  icon: typeof Bell;
}[] = [
  {
    key: 'friendRequest',
    label: 'Friend requests',
    description: 'When someone sends you a request',
    icon: UserPlus,
  },
  {
    key: 'friendAccept',
    label: 'Request accepted',
    description: 'When someone accepts your request',
    icon: UserCheck,
  },
  {
    key: 'directMessage',
    label: 'Direct messages',
    description: 'New messages in a private chat',
    icon: MessageCircle,
  },
  {
    key: 'roomMessage',
    label: 'Room messages',
    description: 'New messages in a group room',
    icon: Users,
  },
  {
    key: 'like',
    label: 'Post likes',
    description: 'When someone likes your post',
    icon: Heart,
  },
];

export function NotificationSettings() {
  const { prefs, update } = useNotificationPrefs();

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
    <div className='space-y-8'>
      {/* Sound master controls */}
      <section className='space-y-4'>
        <div className='flex items-center gap-2'>
          <Volume2 className='text-muted-foreground size-4' aria-hidden />
          <h2 className='text-lg font-semibold tracking-tight'>Sound</h2>
        </div>

        <div className='border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-4'>
          <div className='min-w-0'>
            <p className='text-sm font-medium'>Play notification sounds</p>
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
          <div className='mb-3 flex items-center justify-between'>
            <label htmlFor='volume' className='text-sm font-medium'>
              Master volume
            </label>
            <span className='text-muted-foreground flex items-center gap-1.5 text-sm tabular-nums'>
              {volumePct === 0 ? (
                <VolumeX className='size-4' aria-hidden />
              ) : (
                <Volume2 className='size-4' aria-hidden />
              )}
              {volumePct}%
            </span>
          </div>
          <div className='flex items-center gap-3'>
            <Slider
              id='volume'
              value={prefs.volume}
              min={0}
              max={1}
              step={0.05}
              disabled={!prefs.soundEnabled}
              onValueChange={(v) =>
                setMaster({ volume: Array.isArray(v) ? v[0] : v })
              }
              className='data-[disabled]:opacity-50'
            />
            <Button
              type='button'
              variant='outline'
              size='sm'
              className='shrink-0 gap-1.5 bg-transparent'
              disabled={!prefs.soundEnabled}
              onClick={() =>
                playNotificationSound('directMessage', prefs.volume)
              }
            >
              <Play className='size-3.5' aria-hidden />
              Test
            </Button>
          </div>
        </div>
      </section>

      {/* Per-event controls */}
      <section className='space-y-4'>
        <div className='flex items-center gap-2'>
          <Bell className='text-muted-foreground size-4' aria-hidden />
          <h2 className='text-lg font-semibold tracking-tight'>Events</h2>
        </div>
        <p className='text-muted-foreground text-sm'>
          Choose which events show a popup and which play a sound.
        </p>

        <ul className='divide-border border-border bg-card divide-y overflow-hidden rounded-xl border'>
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
                    <Icon className='size-4' aria-hidden />
                  </span>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium'>{label}</p>
                    <p className='text-muted-foreground text-sm'>
                      {description}
                    </p>
                  </div>
                </div>
                <div className='flex items-center gap-4 pl-11 sm:pl-0'>
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
                    size='icon-sm'
                    className='shrink-0'
                    disabled={!soundOn}
                    onClick={() => playNotificationSound(key, prefs.volume)}
                    aria-label={`Preview ${label} sound`}
                  >
                    <Play className='size-4' aria-hidden />
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
