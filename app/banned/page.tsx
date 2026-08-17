import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { getEffectiveBan } from '@/lib/ban';
import { LocalTime } from '@/components/local-time';
import { SignOutButton } from '@/components/sign-out-button';
import { Ban, Clock, ShieldAlert, User } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Account suspended',
  description: 'Your access to this app has been restricted.',
};

export default async function BannedPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const ban = await getEffectiveBan(session?.user?.id ?? null);

  // Not actually banned — don't let this page be viewed by anyone else.
  if (!ban) {
    redirect(session?.user ? '/app' : '/sign-in');
  }

  const permanent = ban.expiresAt == null;

  return (
    <main className='bg-background flex min-h-svh items-center justify-center px-4 py-10'>
      <div className='w-full max-w-md'>
        <div className='mb-6 flex flex-col items-center text-center'>
          <div className='bg-destructive/10 text-destructive mb-4 flex size-14 items-center justify-center rounded-full'>
            <Ban className='size-7' aria-hidden />
          </div>
          <h1 className='text-2xl font-semibold tracking-tight text-balance'>
            {ban.scope === 'IP'
              ? 'Access blocked'
              : 'Your account is suspended'}
          </h1>
          <p className='text-muted-foreground mt-2 text-sm text-pretty'>
            {permanent
              ? 'This restriction is permanent.'
              : 'Access will be restored automatically when the suspension ends.'}
          </p>
        </div>

        <dl className='divide-border border-border bg-card divide-y overflow-hidden rounded-xl border'>
          <div className='flex items-start gap-3 p-4'>
            <ShieldAlert
              className='text-muted-foreground mt-0.5 size-4 shrink-0'
              aria-hidden
            />
            <div className='min-w-0'>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Reason
              </dt>
              <dd className='mt-0.5 text-sm text-pretty'>{ban.reason}</dd>
            </div>
          </div>

          <div className='flex items-start gap-3 p-4'>
            <Clock
              className='text-muted-foreground mt-0.5 size-4 shrink-0'
              aria-hidden
            />
            <div className='min-w-0'>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                {permanent ? 'Duration' : 'Suspended until'}
              </dt>
              <dd className='mt-0.5 text-sm'>
                {permanent ? (
                  'Permanent'
                ) : (
                  <LocalTime iso={ban.expiresAt as string} />
                )}
              </dd>
            </div>
          </div>

          <div className='flex items-start gap-3 p-4'>
            <User
              className='text-muted-foreground mt-0.5 size-4 shrink-0'
              aria-hidden
            />
            <div className='min-w-0'>
              <dt className='text-muted-foreground text-xs font-medium tracking-wide uppercase'>
                Issued
              </dt>
              <dd className='mt-0.5 text-sm'>
                <LocalTime iso={ban.createdAt} />
                {ban.bannedByName ? (
                  <span className='text-muted-foreground'>
                    {' '}
                    by {ban.bannedByName}
                  </span>
                ) : null}
              </dd>
            </div>
          </div>
        </dl>

        <p className='text-muted-foreground mt-6 text-center text-xs text-pretty'>
          If you believe this is a mistake, please contact support to appeal.
        </p>

        <div className='mt-4 flex justify-center'>
          <SignOutButton>Return to sign in</SignOutButton>
        </div>
      </div>
    </main>
  );
}
