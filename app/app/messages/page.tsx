import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { getPrivateConversations } from '@/app/actions/invites';

import { auth } from '@/lib/auth';

import { MessagesWorkspace } from '@/components/messages-workspace';

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const { c } = await searchParams;

  const conversations = await getPrivateConversations();

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <MessagesWorkspace
        currentUserId={session.user.id}
        currentUserName={session.user.name}
        currentUserImage={session.user.image ?? null}
        conversations={conversations}
        initialChatId={c ?? null}
      />
    </div>
  );
}
