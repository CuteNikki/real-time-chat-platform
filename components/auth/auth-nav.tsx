'use client';

import Link from 'next/link';

import { Loader2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useSession } from '@/lib/auth-client';

import { Button, buttonVariants } from '@/components/ui/button';

export function AuthNav() {
  const { data: session, isPending } = useSession();
  const { t } = useTranslation();

  if (isPending) {
    return (
      <Button disabled>
        <Loader2Icon className='animate-spin' />
        {t('authNav.loading')}
      </Button>
    );
  }

  if (session?.user) {
    return (
      <Link href='/app' className={buttonVariants()}>
        {t('authNav.openApp')}
      </Link>
    );
  }

  return (
    <>
      <Link href='/sign-in' className={buttonVariants({ variant: 'ghost' })}>
        {t('authNav.signIn')}
      </Link>
      <Link href='/sign-up' className={buttonVariants()}>
        {t('authNav.getStarted')}
      </Link>
    </>
  );
}
