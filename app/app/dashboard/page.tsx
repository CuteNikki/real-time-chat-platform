import { redirect } from 'next/navigation';

import { listUsersForModeration } from '@/app/actions/moderation';
import { countPendingReports, listReports } from '@/app/actions/report';

import { atLeast } from '@/lib/roles';
import { getMyRole } from '@/lib/roles-server';

import { ModerationDashboard } from '@/components/moderation-dashboard';
import { PageHeader } from '@/components/ui/page-header';
import { getTranslation } from '@/lib/i18n/server';

export default async function DashboardPage() {
  const role = await getMyRole();

  if (!atLeast(role, 'MODERATOR')) redirect('/app');

  const [firstPage, initialReports, pendingReports] = await Promise.all([
    listUsersForModeration(),
    listReports('PENDING'),
    countPendingReports(),
  ]);
  const { t } = await getTranslation();

  return (
    <div className='xs:pt-20 h-full w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-14 md:pb-0'>
      <div className='mx-auto w-full max-w-3xl px-4 py-8'>
        <PageHeader
          title={t('moderation.title')}
          description={
            role === 'ADMIN'
              ? t('moderation.descAdmin')
              : t('moderation.descMod')
          }
          className='mb-6'
        />
        <ModerationDashboard
          initialUsers={firstPage.users}
          initialTotal={firstPage.total}
          pageSize={firstPage.pageSize}
          viewerRole={role}
          initialReports={initialReports}
          pendingReports={pendingReports}
        />
      </div>
    </div>
  );
}
