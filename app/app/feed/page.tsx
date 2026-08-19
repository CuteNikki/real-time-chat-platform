import Link from 'next/link';
import { redirect } from 'next/navigation';

import { getFeed } from '@/app/actions/posts';
import { getMyProfile } from '@/app/actions/profile';

import { PostCard } from '@/components/post-card';
import { PostComposer } from '@/components/post-composer';

export default async function FeedPage() {
  const me = await getMyProfile();
  if (!me) redirect('/sign-in');

  const posts = await getFeed();

  return (
    <div className='xs:pt-20 h-full w-full overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto w-full max-w-xl px-4 py-6'>
        <h1 className='mb-4 text-2xl font-semibold tracking-tight'>Feed</h1>
        <div className='mb-6'>
          <PostComposer userName={me.name} userImage={me.image} />
        </div>

        {posts.length === 0 ? (
          <div className='border-border rounded-xl border border-dashed px-6 py-16 text-center'>
            <p className='text-muted-foreground text-sm text-balance'>
              Your feed is quiet. Add friends to see their posts here, or share
              your first post above.
            </p>
            <Link
              href='/app/friends'
              className='text-primary mt-3 inline-block text-sm font-medium hover:underline'
            >
              Find friends
            </Link>
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
