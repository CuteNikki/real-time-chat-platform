'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ModerationUserRow } from '@/app/actions/moderation';

import type { Role } from '@/lib/roles';
import type { ReportListItem } from '@/lib/types';

import { ModerationView } from '@/components/moderation-view';
import { ReportsView } from '@/components/reports-view';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// The moderation dashboard's two surfaces — the user directory and the reports
// queue — behind a tab switch. Both are seeded with server-fetched data so the
// first paint is complete; each tab refetches on its own as the moderator acts.
export function ModerationDashboard({
  initialUsers,
  initialTotal,
  pageSize,
  viewerRole,
  initialReports,
  pendingReports,
}: {
  initialUsers: ModerationUserRow[];
  initialTotal: number;
  pageSize: number;
  viewerRole: Role;
  initialReports: ReportListItem[];
  pendingReports: number;
}) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'users' | 'reports'>('users');

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as 'users' | 'reports')}>
      <TabsList className='mb-4'>
        <TabsTrigger value='users'>{t('moderation.tabUsers')}</TabsTrigger>
        <TabsTrigger value='reports'>
          {t('moderation.tabReports')}
          {pendingReports > 0 ? (
            <Badge variant='destructive' className='ml-1.5 tabular-nums'>
              {pendingReports}
            </Badge>
          ) : null}
        </TabsTrigger>
      </TabsList>

      <TabsContent value='users'>
        <ModerationView
          initialUsers={initialUsers}
          initialTotal={initialTotal}
          pageSize={pageSize}
          viewerRole={viewerRole}
        />
      </TabsContent>

      <TabsContent value='reports'>
        <ReportsView initialReports={initialReports} />
      </TabsContent>
    </Tabs>
  );
}
