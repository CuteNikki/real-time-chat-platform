import { and, eq, isNull, ne } from 'drizzle-orm';
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { getMessages } from '@/app/actions/chat';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { chat, chatParticipant, user } from '@/lib/db/schema';

import { ChatView } from '@/components/chat-view';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');
  const me = session.user;

  const [c] = await db.select().from(chat).where(eq(chat.id, chatId)).limit(1);
  if (!c) notFound();
  // This route hosts only ephemeral RANDOM matches (the match finder navigates
  // here). DMs live under /app/messages and rooms under /app/rooms, so anything
  // else reaching this URL is not a match and shouldn't render the match view.
  if (c.type !== 'RANDOM') notFound();

  // Must be an active participant.
  const [membership] = await db
    .select()
    .from(chatParticipant)
    .where(
      and(
        eq(chatParticipant.chatId, chatId),
        eq(chatParticipant.userId, me.id),
        isNull(chatParticipant.leftAt),
      ),
    )
    .limit(1);
  if (!membership) notFound();

  const messages = await getMessages(chatId);

  // A random match is always a 1-on-1, so show the other person's name.
  const [partner] = await db
    .select({ id: user.id, name: user.name, image: user.image })
    .from(chatParticipant)
    .innerJoin(user, eq(user.id, chatParticipant.userId))
    .where(
      and(eq(chatParticipant.chatId, chatId), ne(chatParticipant.userId, me.id)),
    )
    .limit(1);

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <ChatView
        chatId={chatId}
        title={partner?.name ?? 'Anonymous'}
        partnerId={partner?.id ?? null}
        partnerImage={partner?.image ?? null}
        ended={!!c.endedAt}
        currentUserId={me.id}
        currentUserName={me.name}
        currentUserImage={me.image ?? null}
        initialMessages={messages}
      />
    </div>
  );
}
