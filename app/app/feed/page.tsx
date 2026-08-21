import Link from 'next/link';
import { redirect } from 'next/navigation';

import { SearchXIcon, UserPlus2Icon } from 'lucide-react';

import { getFeed, searchPosts } from '@/app/actions/posts';
import { getMyProfile } from '@/app/actions/profile';

import { normalizeHashtag } from '@/lib/mentions';
import type { FeedScope } from '@/lib/types';

import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { FeedControls } from '@/components/feed/feed-controls';
import { PostCard } from '@/components/user/post-card';
import { PostComposer } from '@/components/user/post-composer';

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; query?: string; tags?: string }>;
}) {
  const me = await getMyProfile();
  if (!me) redirect('/sign-in');

  const raw = await searchParams;
  const scope: FeedScope = raw.tab === 'friends' ? 'friends' : 'for-you';
  const query = (raw.query ?? '').trim();
  // Normalize + dedupe the tag list the same way it's stored, dropping junk.
  const tags = [
    ...new Set(
      (raw.tags ?? '')
        .split(',')
        .map((t) => normalizeHashtag(t))
        .filter(Boolean),
    ),
  ];
  const searching = query.length > 0 || tags.length > 0;

  const posts = searching
    ? await searchPosts({ query, tags })
    : await getFeed(scope);

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto flex w-full max-w-xl flex-col gap-2 px-4 py-6'>
        <PageHeader title='Feed' />

        <div className='mt-1'>
          <FeedControls
            tab={scope}
            query={raw.query ?? ''}
            tags={tags}
          />
        </div>

        {searching ? (
          <div className='mt-3 flex flex-col gap-4'>
            <p className='text-muted-foreground text-sm'>
              {posts.length} {posts.length === 1 ? 'result' : 'results'}
              {query ? (
                <>
                  {' '}
                  for <span className='text-foreground font-medium'>“{query}”</span>
                </>
              ) : null}
              {tags.length > 0 ? (
                <>
                  {' '}
                  in{' '}
                  <span className='text-foreground font-medium'>
                    {tags.map((t) => `#${t}`).join(', ')}
                  </span>
                </>
              ) : null}
            </p>

            {posts.length === 0 ? (
              <EmptyState
                icon={SearchXIcon}
                title='No posts match your search'
                description='Try different words or remove a tag to widen the search.'
                className='border-border bg-card rounded-2xl border border-dashed'
              />
            ) : (
              <div className='flex flex-col gap-6'>
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            <div className='mt-3 mb-4'>
              <PostComposer userName={me.name} userImage={me.image} />
            </div>

            {posts.length === 0 ? (
              scope === 'friends' ? (
                <EmptyState
                  icon={UserPlus2Icon}
                  title='No posts from friends yet'
                  description='Add friends to see their posts here, or share your first post above.'
                  className='border-border bg-card rounded-2xl border border-dashed'
                  action={
                    <Button variant='secondary' asChild>
                      <Link href='/app/friends'>
                        Find Friends
                        <UserPlus2Icon className='shrink-0' />
                      </Link>
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={UserPlus2Icon}
                  title='Your feed is quiet'
                  description='No posts yet — be the first to share something above.'
                  className='border-border bg-card rounded-2xl border border-dashed'
                />
              )
            ) : (
              <div className='flex flex-col gap-6'>
                {posts.map((p) => (
                  <PostCard key={p.id} post={p} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
