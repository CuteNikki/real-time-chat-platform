import { notFound } from 'next/navigation';

import { getUserPosts } from '@/app/actions/posts';
import { getProfileByUsername } from '@/app/actions/profile';

import { ProfileView } from '@/components/user/profile-view';
import { getMyRole } from '@/lib/roles-server';

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const [role, posts] = await Promise.all([
    getMyRole(),
    getUserPosts(profile.id),
  ]);

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <ProfileView profile={profile} initialPosts={posts} role={role} />
    </div>
  );
}
