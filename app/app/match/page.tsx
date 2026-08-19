import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';

import { MatchFinder } from '@/components/match-finder';

export default async function MatchPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect('/sign-in');

  return (
    <div className='xs:pt-20 relative h-full w-full overflow-y-auto pt-16'>
      <MatchFinder userId={session.user.id} />
    </div>
  );
}
