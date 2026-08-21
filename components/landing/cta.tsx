'use client';

import Link from 'next/link';

import { ArrowRightIcon } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';

import { buttonVariants } from '@/components/ui/button';

import { EASE } from './motion';

export function Cta() {
  const reduce = useReducedMotion();
  const { t } = useTranslation();

  return (
    <section className='mx-auto w-full max-w-7xl px-4 py-16'>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 40, scale: 0.98 }}
        whileInView={reduce ? undefined : { opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.8, ease: EASE }}
        className='bg-primary text-primary-foreground relative flex flex-col items-center gap-4 overflow-hidden rounded-4xl p-8 text-center sm:p-14'
      >
        {/* Layered glows + grain for depth on the flat primary fill. */}
        <div
          aria-hidden
          className='bg-primary-foreground/10 animate-aurora pointer-events-none absolute -top-24 -right-16 size-80 rounded-full blur-3xl'
        />
        <div
          aria-hidden
          className='bg-primary-foreground/10 animate-float-slow pointer-events-none absolute -bottom-28 -left-16 size-80 rounded-full blur-3xl'
        />
        <div
          aria-hidden
          className='bg-grain pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-overlay'
        />

        <span className='relative text-3xl font-semibold tracking-tight text-balance md:text-5xl'>
          {t('landing.cta.title')}
        </span>
        <p className='text-primary-foreground/80 relative max-w-md text-pretty'>
          {t('landing.cta.subtitle')}
        </p>
        <Link
          href='/sign-up'
          className={buttonVariants({
            variant: 'secondary',
            size: 'lg',
            className: 'relative mt-2 p-4!',
          })}
        >
          {t('landing.cta.button')}
          <ArrowRightIcon className='size-4' aria-hidden />
        </Link>
      </motion.div>
    </section>
  );
}
