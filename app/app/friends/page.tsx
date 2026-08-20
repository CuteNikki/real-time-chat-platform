import { redirect } from 'next/navigation';

import {
  getFriends,
  getPendingInvites,
  getSentInvites,
} from '@/app/actions/invites';
import { getMyProfile } from '@/app/actions/profile';

import { FriendsView } from '@/components/friends-view';

export default async function FriendsPage() {
  const me = await getMyProfile();
  if (!me) redirect('/sign-in');

  const [pending, sent, friends] = await Promise.all([
    getPendingInvites(),
    getSentInvites(),
    getFriends(),
  ]);

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto flex w-full max-w-2xl flex-col gap-2 px-4 py-6'>
        <span className='text-2xl font-semibold tracking-tight'>
          Friends
        </span>
        <p className='text-muted-foreground text-sm'>
          Find people by name, username, or shared interests, then send a
          request. Once accepted, you can DM each other.
        </p>
        <FriendsView
          initialIncoming={pending}
          initialOutgoing={sent}
          initialFriends={friends}
        />
      </div>
    </div>
  );
}
