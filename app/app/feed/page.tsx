import Link from 'next/link';
import { redirect } from 'next/navigation';

import { UserPlus2Icon } from 'lucide-react';

import { getFeed } from '@/app/actions/posts';
import { getMyProfile } from '@/app/actions/profile';

import { Button } from '@/components/ui/button';
import { PostCard } from '@/components/user/post-card';
import { PostComposer } from '@/components/user/post-composer';

export default async function FeedPage() {
  const me = await getMyProfile();
  if (!me) redirect('/sign-in');

  const posts = await getFeed();

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto flex w-full max-w-xl flex-col gap-2 px-4 py-6'>
        <span className='text-2xl font-semibold tracking-tight'>Feed</span>
        <div className='mb-4'>
          <PostComposer userName={me.name} userImage={me.image} />
        </div>

        {posts.length === 0 ? (
          <div className='border-border bg-card rounded-xl border border-dashed px-6 py-16 text-center'>
            <p className='text-muted-foreground text-sm text-balance'>
              Your feed is quiet.
              <br />
              Add friends to see their posts here, or share your first post
              above.
            </p>
            <Button
              variant='ghost'
              asChild
              className='text-primary/90 hover:text-primary mt-2'
            >
              <Link href='/app/friends'>
                Find Friends
                <UserPlus2Icon className='shrink-0' />
              </Link>
            </Button>
          </div>
        ) : (
          <div className='flex flex-col gap-6'>
            {posts.map((p) => (
              <PostCard key={p.id} post={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
