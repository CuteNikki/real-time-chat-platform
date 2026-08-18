'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Lock } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { updatePostsVisibility } from '@/app/actions/profile';

export function PrivacySettings({
  initialFriendsOnlyPosts,
}: {
  initialFriendsOnlyPosts: boolean;
}) {
  const [friendsOnly, setFriendsOnly] = useState(initialFriendsOnlyPosts);
  const [saving, setSaving] = useState(false);

  async function toggle(next: boolean) {
    setFriendsOnly(next);
    setSaving(true);
    try {
      await updatePostsVisibility(next);
      toast.success(
        next ? 'Only friends can see your posts now' : 'Your posts are public again',
      );
    } catch (err) {
      setFriendsOnly(!next);
      toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className='space-y-4'>
      <div className='flex items-center gap-2'>
        <Lock className='text-muted-foreground size-4' aria-hidden />
        <h2 className='text-lg font-semibold tracking-tight'>Posts</h2>
      </div>

      <div className='border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-4'>
        <div className='min-w-0'>
          <p className='text-sm font-medium'>Only friends can see your posts</p>
          <p className='text-muted-foreground text-sm'>
            When on, only accepted friends can view your profile posts.
            Everyone else sees a private notice instead.
          </p>
        </div>
        <Switch
          checked={friendsOnly}
          disabled={saving}
          onCheckedChange={toggle}
          aria-label='Only friends can see your posts'
        />
      </div>
    </div>
  );
}
