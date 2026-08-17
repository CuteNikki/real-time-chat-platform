import type React from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getMyRole } from '@/lib/roles-server';
import { getEffectiveBan } from '@/lib/ban';
import { AppNav, MobileBottomNav } from '@/components/app-nav';
import { NotificationPrefsProvider } from '@/components/notification-prefs-provider';
import { getMyNotificationPreferences } from '@/app/actions/preferences';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/sign-in');

  // Gate the entire app: any active account ban (or a ban on the request's IP)
  // bounces the user to the /banned page, which lives outside this layout.
  const effectiveBan = await getEffectiveBan(session.user.id);
  if (effectiveBan) redirect('/banned');

  const u = session.user as typeof session.user & { username?: string | null };
  const [role, notificationPrefs] = await Promise.all([
    getMyRole(),
    getMyNotificationPreferences(),
  ]);

  return (
    <NotificationPrefsProvider initial={notificationPrefs}>
      <div className='bg-background flex h-svh flex-col overflow-hidden'>
        <AppNav
          user={{
            id: session.user.id,
            name: session.user.name,
            email: session.user.email,
            image: session.user.image ?? null,
            username: u.username ?? null,
            role,
          }}
        />
        <div className='min-h-0 flex-1 overflow-hidden'>{children}</div>
        <MobileBottomNav />
      </div>
    </NotificationPrefsProvider>
  );
}
