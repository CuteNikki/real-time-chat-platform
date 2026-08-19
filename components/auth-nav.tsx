'use client';

import Link from 'next/link';

import { Loader2Icon } from 'lucide-react';

import { useSession } from '@/lib/auth-client';

import { Button, buttonVariants } from '@/components/ui/button';

export function AuthNav() {
  const { data: session, isPending } = useSession();

  if (isPending) {
    return (
      <Button disabled>
        <Loader2Icon className='animate-spin' />
        Loading...
      </Button>
    );
  }

  if (session?.user) {
    return (
      <Link href='/app' className={buttonVariants()}>
        Open app
      </Link>
    );
  }

  return (
    <>
      <Link href='/sign-in' className={buttonVariants({ variant: 'ghost' })}>
        Sign in
      </Link>
      <Link href='/sign-up' className={buttonVariants()}>
        Get Started
      </Link>
    </>
  );
}
