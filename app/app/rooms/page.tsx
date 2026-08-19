import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { listRooms } from '@/app/actions/rooms';

import { auth } from '@/lib/auth';
import { canCreateGroups } from '@/lib/roles';
import { getMyRole } from '@/lib/roles-server';

import { RoomsWorkspace } from '@/components/rooms-workspace';

export default async function RoomsPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) redirect('/sign-in');

  const [rooms, role] = await Promise.all([listRooms(), getMyRole()]);

  return (
    <div className='xs:pt-20 h-full w-full overflow-y-auto pt-16 pb-14 md:pb-0'>
      <RoomsWorkspace
        initialRooms={rooms}
        me={{
          id: session.user.id,
          name: session.user.name,
          image: session.user.image ?? null,
        }}
        canCreate={canCreateGroups(role)}
        canDelete={canCreateGroups(role)}
      />
    </div>
  );
}
