import { listRooms } from '@/app/actions/rooms';
import { RoomsWorkspace } from '@/components/rooms-workspace';
import { auth } from '@/lib/auth';
import { canCreateGroups } from '@/lib/roles';
import { getMyRole } from '@/lib/roles-server';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function RoomsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const rooms = await listRooms();
  const role = await getMyRole();
  return (
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
  );
}
