import { redirect } from 'next/navigation';

import { listUsersForAdmin } from '@/app/actions/admin';

import { atLeast } from '@/lib/roles';
import { getMyRole } from '@/lib/roles-server';

import { AdminView } from '@/components/admin-view';

export default async function AdminPage() {
  const role = await getMyRole();

  if (!atLeast(role, 'MODERATOR')) redirect('/app');

  const users = await listUsersForAdmin();

  return (
    <div className='xs:pt-20 h-full w-full overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto w-full max-w-3xl px-4 py-8'>
        <header className='mb-6'>
          <h1 className='text-2xl font-semibold tracking-tight'>Admin</h1>
          <p className='text-muted-foreground text-sm text-pretty'>
            {role === 'ADMIN'
              ? 'Manage roles, ban or delete accounts, and review moderation history.'
              : 'Ban members and review moderation history.'}
          </p>
        </header>
        <AdminView initialUsers={users} viewerRole={role} />
      </div>
    </div>
  );
}
