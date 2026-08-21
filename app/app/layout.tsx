import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type React from 'react';

import { getMyNotificationPreferences } from '@/app/actions/preferences';

import { auth } from '@/lib/auth';
import { getEffectiveBan } from '@/lib/ban';

import { AppNav, MobileBottomNav } from '@/components/app-nav';
import { CallProvider } from '@/components/call/call-provider';
import { NotificationPrefsProvider } from '@/components/notification-prefs-provider';
import { getMyRole } from '@/lib/roles-server';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  const [role, effectiveBan] = await Promise.all([
    getMyRole(),
    getEffectiveBan(session.user.id),
  ]);
  if (effectiveBan) redirect('/banned');

  const notificationPrefs = await getMyNotificationPreferences();

  return (
    <NotificationPrefsProvider initial={notificationPrefs}>
      <CallProvider
        user={{
          id: session.user.id,
          name: session.user.name,
          image: session.user.image ?? null,
        }}
      >
        <div className='bg-background relative flex h-svh flex-col overflow-hidden'>
          <AppNav user={{ ...session.user, role }} />

          <main className='relative flex min-h-0 w-full flex-1 flex-col'>
            {children}
          </main>

          <MobileBottomNav />
        </div>
      </CallProvider>
    </NotificationPrefsProvider>
  );
}
