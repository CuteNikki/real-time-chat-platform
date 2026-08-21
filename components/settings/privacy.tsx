'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { updatePostsVisibility } from '@/app/actions/profile';

import { Switch } from '@/components/ui/switch';

export function PrivacySettings({
  initialFriendsOnlyPosts,
}: {
  initialFriendsOnlyPosts: boolean;
}) {
  const [friendsOnly, setFriendsOnly] = useState(initialFriendsOnlyPosts);
  const [saving, setSaving] = useState(false);
  const { t } = useTranslation();

  async function toggle(next: boolean) {
    setFriendsOnly(next);
    setSaving(true);
    try {
      await updatePostsVisibility(next);
      toast.success(
        next
          ? t('settings.privacy.friendsOnlyOn')
          : t('settings.privacy.friendsOnlyOff'),
      );
    } catch (err) {
      setFriendsOnly(!next);
      toast.error(
        err instanceof Error ? err.message : t('settings.privacy.couldNotSave'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='space-y-2'>
      <div className='flex items-center gap-2'>
        <Lock className='text-muted-foreground size-4' aria-hidden />
        <h2 className='text-lg font-semibold tracking-tight'>
          {t('settings.privacy.postsTitle')}
        </h2>
      </div>

      <div className='border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-4'>
        <div className='min-w-0'>
          <p className='text-sm font-medium'>
            {t('settings.privacy.onlyFriendsTitle')}
          </p>
          <p className='text-muted-foreground text-sm'>
            {t('settings.privacy.onlyFriendsDesc')}
          </p>
        </div>
        <Switch
          checked={friendsOnly}
          disabled={saving}
          onCheckedChange={toggle}
          aria-label={t('settings.privacy.onlyFriendsTitle')}
        />
      </div>
    </div>
  );
}
