import { redirect } from 'next/navigation';

import { listRooms } from '@/app/actions/rooms';

import { atLeast, canCreateGroups } from '@/lib/roles';
import { getMyRole } from '@/lib/roles-server';
import { getSession } from '@/lib/session';

import { RoomsWorkspace } from '@/components/chat/rooms-workspace';

export default async function RoomsPage() {
  const session = await getSession();

  if (!session?.user) redirect('/sign-in');

  const [rooms, role] = await Promise.all([listRooms(), getMyRole()]);

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <RoomsWorkspace
        initialRooms={rooms}
        me={{
          id: session.user.id,
          name: session.user.name,
          image: session.user.image ?? null,
        }}
        canCreate={canCreateGroups(role)}
        canDelete={canCreateGroups(role)}
        canModerate={atLeast(role, 'MODERATOR')}
      />
    </div>
  );
}
