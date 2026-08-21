import { and, eq, isNull, ne } from 'drizzle-orm';
import { notFound, redirect } from 'next/navigation';

import { getMessages } from '@/app/actions/chat';

import { db } from '@/lib/db';
import { chat, chatParticipant, user } from '@/lib/db/schema';
import { getSession } from '@/lib/session';

import { ChatView } from '@/components/chat-view';

export default async function ChatPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;
  const session = await getSession();
  if (!session?.user) redirect('/sign-in');
  const me = session.user;

  // The chat row and this user's membership are independent lookups.
  const [[c], [membership]] = await Promise.all([
    db.select().from(chat).where(eq(chat.id, chatId)).limit(1),
    db
      .select()
      .from(chatParticipant)
      .where(
        and(
          eq(chatParticipant.chatId, chatId),
          eq(chatParticipant.userId, me.id),
          isNull(chatParticipant.leftAt),
        ),
      )
      .limit(1),
  ]);

  if (!c) notFound();
  // This route hosts only ephemeral RANDOM matches (the match finder navigates
  // here). DMs live under /app/messages and rooms under /app/rooms, so anything
  // else reaching this URL is not a match and shouldn't render the match view.
  if (c.type !== 'RANDOM') notFound();
  if (!membership) notFound();

  // A random match is always a 1-on-1, so show the other person's name. The
  // message history and partner lookup are independent.
  const [messages, [partner]] = await Promise.all([
    getMessages(chatId),
    db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(chatParticipant)
      .innerJoin(user, eq(user.id, chatParticipant.userId))
      .where(
        and(
          eq(chatParticipant.chatId, chatId),
          ne(chatParticipant.userId, me.id),
        ),
      )
      .limit(1),
  ]);

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
