import { redirect } from 'next/navigation';

import {
  getFriends,
  getPendingInvites,
  getSentInvites,
} from '@/app/actions/invites';
import { getMyProfile } from '@/app/actions/profile';

import { getTranslation } from '@/lib/i18n/server';

import { FriendsView } from '@/components/friends-view';
import { PageHeader } from '@/components/ui/page-header';

export default async function FriendsPage() {
  const [me, pending, sent, friends] = await Promise.all([
    getMyProfile(),
    getPendingInvites(),
    getSentInvites(),
    getFriends(),
  ]);
  if (!me) redirect('/sign-in');

  const { t } = await getTranslation();

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6'>
        <PageHeader
          title={t('app.friends.title')}
          description={t('app.friends.description')}
        />
        <FriendsView
          initialIncoming={pending}
          initialOutgoing={sent}
          initialFriends={friends}
        />
      </div>
    </div>
  );
}
