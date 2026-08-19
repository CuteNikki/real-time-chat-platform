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

  // Build a title. For 1-on-1 (RANDOM/PRIVATE) show the other person's name.
  let title = c.name ?? 'Chat';
  let subtitle = '';
  let partnerId: string | null = null;
  let partnerImage: string | null = null;
  if (c.type === 'RANDOM' || c.type === 'PRIVATE') {
    const others = await db
      .select({ id: user.id, name: user.name, image: user.image })
      .from(chatParticipant)
      .innerJoin(user, eq(user.id, chatParticipant.userId))
      .where(
        and(
          eq(chatParticipant.chatId, chatId),
          ne(chatParticipant.userId, me.id),
        ),
      )
      .limit(1);
    title =
      others[0]?.name ?? (c.type === 'RANDOM' ? 'Anonymous' : 'Private chat');
    subtitle = c.type === 'RANDOM' ? 'Random match' : 'Private chat';
    partnerId = others[0]?.id ?? null;
    partnerImage = others[0]?.image ?? null;
  } else {
    subtitle = 'Group room';
  }

  return (
    <ChatView
      chatId={chatId}
      type={c.type as 'RANDOM' | 'GROUP' | 'PRIVATE'}
      title={title}
      subtitle={subtitle}
      partnerId={partnerId}
      partnerImage={partnerImage}
      ended={!!c.endedAt}
      currentUserId={me.id}
      currentUserName={me.name}
      currentUserImage={me.image ?? null}
      initialMessages={messages}
    />
  );
}
