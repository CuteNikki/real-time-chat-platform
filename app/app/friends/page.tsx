import { redirect } from 'next/navigation';
import { getMyProfile } from '@/app/actions/profile';
import {
  getFriends,
  getPendingInvites,
  getSentInvites,
} from '@/app/actions/invites';
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
    <div className='h-full w-full [scrollbar-gutter:stable] overflow-y-auto'>
      <div className='mx-auto w-full max-w-2xl px-4 py-8'>
        <h1 className='mb-1 text-2xl font-semibold tracking-tight'>Friends</h1>
        <p className='text-muted-foreground mb-6 text-sm'>
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
