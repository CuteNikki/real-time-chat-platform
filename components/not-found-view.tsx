'use client';

import Link from 'next/link';

import { ArrowLeftIcon, CompassIcon, OrbitIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';

import { AuthNav } from '@/components/auth/auth-nav';
import { EASE } from '@/components/landing/motion';
import { buttonVariants } from '@/components/ui/button';

// The "0" in 404, reimagined as a little orbit: a ring with a planet circling
// it. Purely decorative and fully still under prefers-reduced-motion.
function OrbitZero() {
  const reduce = useReducedMotion();

  return (
    <span className='relative inline-flex size-28 items-center justify-center sm:size-36'>
      <span
        aria-hidden
        className='bg-primary/25 animate-aurora absolute inset-0 rounded-full blur-2xl'
      />
      <span
        aria-hidden
        className='border-primary/40 relative size-full rounded-full border-[6px]'
      />
      <motion.span
        aria-hidden
        className='absolute inset-0'
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
      >
        <span className='bg-primary shadow-primary/50 absolute -top-2 left-1/2 size-5 -translate-x-1/2 rounded-full shadow-lg' />
      </motion.span>
    </span>
  );
}

export function NotFoundView() {
  const reduce = useReducedMotion();

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  return (
    <div className='bg-background relative flex h-svh flex-col overflow-hidden'>
      {/* Ambient background, matching the landing page. */}
      <div
        aria-hidden
        className='pointer-events-none fixed inset-0 -z-10 overflow-hidden'
      >
        <div className='bg-primary/10 absolute -top-40 -left-32 size-152 rounded-full blur-3xl' />
        <div className='bg-primary/6 absolute top-1/2 -right-40 size-136 rounded-full blur-3xl' />
        <div className='bg-grain absolute inset-0 opacity-[0.03] mix-blend-overlay dark:opacity-[0.04]' />
      </div>

      {/* Header */}
      <header className='bg-background/70 z-50 border-b backdrop-blur-md'>
        <div className='xs:p-6 mx-auto flex w-full max-w-7xl items-center justify-between p-4'>
          <Link href='/' className='flex items-center gap-2'>
            <OrbitIcon className='text-primary size-6' aria-hidden />
            <span className='text-lg font-semibold tracking-tight'>Orbit</span>
          </Link>
          <nav className='flex items-center gap-2'>
            <AuthNav />
          </nav>
        </div>
      </header>

      {/* Centered content — internal scroll reserves the scrollbar gutter so
          the page never shifts when the scrollbar appears. */}
      <main className='relative min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto'>
        <div className='flex min-h-full items-center justify-center px-4 py-16'>
          <motion.div
            variants={reduce ? undefined : container}
            initial={reduce ? undefined : 'hidden'}
            animate={reduce ? undefined : 'show'}
            className='flex flex-col items-center text-center'
          >
            <motion.div
              variants={reduce ? undefined : item}
              className='flex items-center justify-center gap-3 font-semibold tracking-tight sm:gap-5'
            >
              <span className='text-8xl sm:text-9xl'>4</span>
              <OrbitZero />
              <span className='text-8xl sm:text-9xl'>4</span>
            </motion.div>

            <motion.span
              variants={reduce ? undefined : item}
              className='border-border bg-card/60 text-muted-foreground mt-10 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm backdrop-blur-sm'
            >
              <CompassIcon className='text-primary size-4' aria-hidden />
              Lost in orbit
            </motion.span>

            <motion.h1
              variants={reduce ? undefined : item}
              className='mt-6 max-w-xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl'
            >
              This page drifted off course
            </motion.h1>

            <motion.p
              variants={reduce ? undefined : item}
              className='text-muted-foreground mt-4 max-w-md text-lg leading-relaxed text-pretty'
            >
              The page you&apos;re looking for doesn&apos;t exist, moved, or
              never made it into orbit. Let&apos;s get you back to something
              real.
            </motion.p>

            <motion.div
              variants={reduce ? undefined : item}
              className='mt-9 flex flex-col gap-3 sm:flex-row'
            >
              <Link
                href='/'
                className={buttonVariants({ size: 'lg', className: 'p-4!' })}
              >
                <ArrowLeftIcon className='size-4' aria-hidden />
                Back to home
              </Link>
              <Link
                href='/app'
                className={buttonVariants({
                  variant: 'outline',
                  size: 'lg',
                  className: 'p-4!',
                })}
              >
                Open Orbit
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
