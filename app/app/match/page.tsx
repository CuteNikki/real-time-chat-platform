import { redirect } from 'next/navigation';

import { getSession } from '@/lib/session';

import { MatchFinder } from '@/components/match-finder';

export default async function MatchPage() {
  const session = await getSession();

  if (!session?.user) redirect('/sign-in');

  return (
    <div className='xs:pt-20 relative h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <MatchFinder userId={session.user.id} />
    </div>
  );
}
