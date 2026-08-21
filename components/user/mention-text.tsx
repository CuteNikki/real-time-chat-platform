'use client';

import { useState } from 'react';

import Link from 'next/link';
import { Loader2Icon } from 'lucide-react';

import { getProfileByUsername } from '@/app/actions/profile';

import { normalizeHashtag, parseRichText } from '@/lib/mentions';
import type { UserProfile } from '@/lib/types';

import {
  PreviewCard,
  PreviewCardContent,
  PreviewCardTrigger,
} from '@/components/ui/preview-card';
import { FriendshipButtons } from '@/components/user/friendship-buttons';
import { InterestTags } from '@/components/user/interest-tags';
import { UserAvatar } from '@/components/user/user-avatar';

// Render caption/bio text with @username mentions and #hashtags highlighted in
// the primary color. Mentions are hover-previewed and link to the profile;
// hashtags link to that tag's post search. Non-token runs render verbatim; the
// caller keeps them inside a `whitespace-pre-wrap` element so newlines/spacing
// are preserved.
export function MentionText({ text }: { text: string }) {
  const tokens = parseRichText(text);
  return (
    <>
      {tokens.map((t, i) =>
        t.type === 'mention' ? (
          <UserMention key={i} username={t.username} />
        ) : t.type === 'hashtag' ? (
          <HashtagLink key={i} tag={t.tag} />
        ) : (
          <span key={i}>{t.value}</span>
        ),
      )}
    </>
  );
}

// A #hashtag, linking to the feed pre-filtered by that tag. The tag is
// displayed with the casing the author typed, but the link/lookup uses the
// normalized form so it lands on the same results regardless of case.
function HashtagLink({ tag }: { tag: string }) {
  const slug = normalizeHashtag(tag);
  if (!slug) return <span>#{tag}</span>;
  return (
    <Link
      href={`/app/feed?tags=${slug}`}
      className='text-primary font-medium hover:underline'
    >
      #{tag}
    </Link>
  );
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'missing' | 'error';

function UserMention({ username }: { username: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [state, setState] = useState<LoadState>('idle');

  // Lazily fetch the profile the first time the card opens, so a caption full
  // of mentions doesn't fan out into a request per mention on render.
  function load() {
    if (state !== 'idle') return;
    setState('loading');
    getProfileByUsername(username)
      .then((p) => {
        if (!p) {
          setState('missing');
          return;
        }
        setProfile(p);
        setState('loaded');
      })
      .catch(() => setState('error'));
  }

  return (
    <PreviewCard
      onOpenChange={(open) => {
        if (open) load();
      }}
    >
      <PreviewCardTrigger
        render={<Link href={`/app/u/${username}`} />}
        className='text-primary font-medium hover:underline'
      >
        @{username}
      </PreviewCardTrigger>
      <PreviewCardContent className='w-64 p-4'>
        {state === 'loaded' && profile ? (
          <div className='flex flex-col items-center gap-2 text-center'>
            <UserAvatar
              name={profile.name}
              image={profile.image}
              className='size-16'
            />
            <div className='flex flex-col'>
              <Link
                href={`/app/u/${profile.username}`}
                className='text-base font-semibold text-balance hover:underline'
              >
                {profile.name}
              </Link>
              <span className='text-muted-foreground text-sm'>
                @{profile.username}
              </span>
            </div>
            {profile.bio ? (
              <p className='text-muted-foreground line-clamp-3 text-sm whitespace-pre-wrap'>
                {profile.bio}
              </p>
            ) : null}
            <InterestTags
              interests={profile.interests}
              className='justify-center'
              max={3}
            />
            <div className='flex items-center gap-5 py-1 text-sm'>
              <span>
                <strong className='font-semibold tabular-nums'>
                  {profile.postCount}
                </strong>{' '}
                <span className='text-muted-foreground'>post(s)</span>
              </span>
              <span>
                <strong className='font-semibold tabular-nums'>
                  {profile.friendCount}
                </strong>{' '}
                <span className='text-muted-foreground'>friend(s)</span>
              </span>
            </div>
            <FriendshipButtons initialProfile={profile} showFullProfileButton />
          </div>
        ) : state === 'missing' ? (
          <p className='text-muted-foreground py-2 text-center text-sm'>
            @{username} isn&apos;t a user.
          </p>
        ) : state === 'error' ? (
          <p className='text-muted-foreground py-2 text-center text-sm'>
            Couldn&apos;t load this profile.
          </p>
        ) : (
          <div className='flex h-32 items-center justify-center'>
            <Loader2Icon
              className='text-muted-foreground size-5 animate-spin'
              aria-hidden
            />
          </div>
        )}
      </PreviewCardContent>
    </PreviewCard>
  );
}
