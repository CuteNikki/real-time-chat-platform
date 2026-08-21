'use client';

import Link from 'next/link';
import { useRef } from 'react';

import { ArrowRightIcon, ChevronDownIcon, SparklesIcon } from 'lucide-react';
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from 'motion/react';
import { useTranslation } from 'react-i18next';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useLandingScrollContainer } from './landing-scroll';
import { EASE } from './motion';

// Small live-chat mock that floats beside the hero copy — gives the page a
// concrete "this is the product" anchor with depth (glow + glass + float).
function HeroPreview() {
  const { t } = useTranslation();

  return (
    <div className='relative mx-auto w-full max-w-sm'>
      {/* Ambient glow behind the card. */}
      <div
        aria-hidden
        className='bg-primary/25 animate-aurora absolute -inset-6 -z-10 rounded-[2.5rem] blur-3xl'
      />
      <div className='animate-float-slow border-border/70 bg-card/80 rounded-3xl border p-4 shadow-2xl shadow-black/10 backdrop-blur-xl'>
        <div className='mb-4 flex items-center gap-2'>
          <span className='relative flex size-2.5'>
            <span className='bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75' />
            <span className='bg-primary relative inline-flex size-2.5 rounded-full' />
          </span>
          <span className='text-muted-foreground text-xs font-medium'>
            {t('landing.hero.preview.live')}
          </span>
        </div>
        <div className='flex flex-col gap-3'>
          <ChatBubble side='start' name='Maya'>
            {t('landing.hero.preview.msgMaya')}
          </ChatBubble>
          <ChatBubble side='end'>{t('landing.hero.preview.msgYou')}</ChatBubble>
          <ChatBubble side='start' name='Jon'>
            {t('landing.hero.preview.msgJon')}
          </ChatBubble>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({
  side,
  name,
  children,
}: {
  side: 'start' | 'end';
  name?: string;
  children: React.ReactNode;
}) {
  const mine = side === 'end';
  return (
    <div className={cn('flex flex-col gap-1', mine && 'items-end')}>
      {name && (
        <span className='text-muted-foreground px-1 text-[11px] font-medium'>
          {name}
        </span>
      )}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
          mine
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-secondary text-secondary-foreground rounded-bl-sm',
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { t } = useTranslation();
  const scrollContainer = useLandingScrollContainer();

  // Drive the hero's exit off its own scroll progress: 0 while pinned at the
  // top, 1 by the time it has scrolled fully out of view. The landing page
  // scrolls inside a container (so its scrollbar sits under the header), so we
  // track that container rather than the window.
  const { scrollYProgress } = useScroll({
    target: ref,
    container: scrollContainer ?? undefined,
    offset: ['start start', 'end start'],
  });

  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.92]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const blur = useTransform(
    scrollYProgress,
    [0, 0.8],
    ['blur(0px)', 'blur(10px)'],
  );
  const indicatorOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0]);

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
  };

  return (
    <section ref={ref} className='relative'>
      <motion.div
        style={reduce ? undefined : { opacity, scale, y, filter: blur }}
        className='mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-4 py-20 lg:grid-cols-[1.1fr_0.9fr] lg:py-28'
      >
        <motion.div
          variants={reduce ? undefined : container}
          initial={reduce ? undefined : 'hidden'}
          animate={reduce ? undefined : 'show'}
          className='flex flex-col items-center text-center lg:items-start lg:text-left'
        >
          <motion.span
            variants={reduce ? undefined : item}
            className='border-border bg-card/60 text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm backdrop-blur-sm'
          >
            <span className='relative flex size-2'>
              <span className='bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75' />
              <span className='bg-primary relative inline-flex size-2 rounded-full' />
            </span>
            {t('landing.hero.badge')}
          </motion.span>

          <motion.h1
            variants={reduce ? undefined : item}
            className='max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight text-balance lg:text-7xl'
          >
            {t('landing.hero.titleBefore')}
            <span className='text-primary'>
              {t('landing.hero.titleHighlight')}
            </span>
            {t('landing.hero.titleAfter')}
          </motion.h1>

          <motion.p
            variants={reduce ? undefined : item}
            className='text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed text-pretty'
          >
            {t('landing.hero.subtitle')}
          </motion.p>

          <motion.div
            variants={reduce ? undefined : item}
            className='mt-9 flex flex-col gap-3 sm:flex-row'
          >
            <Link
              href='/sign-up'
              className={buttonVariants({ size: 'lg', className: 'p-4!' })}
            >
              {t('landing.hero.primaryCta')}
              <ArrowRightIcon className='size-4' aria-hidden />
            </Link>
            <Link
              href='/sign-in'
              className={buttonVariants({
                variant: 'outline',
                size: 'lg',
                className: 'p-4!',
              })}
            >
              {t('landing.hero.secondaryCta')}
            </Link>
          </motion.div>

          <motion.div
            variants={reduce ? undefined : item}
            className='text-muted-foreground mt-6 inline-flex items-center gap-2 text-sm'
          >
            <SparklesIcon className='text-primary size-4' aria-hidden />
            {t('landing.hero.free')}
          </motion.div>
        </motion.div>

        <motion.div
          initial={reduce ? undefined : { opacity: 0, scale: 0.95, y: 24 }}
          animate={reduce ? undefined : { opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE, delay: 0.2 }}
          className='hidden lg:block'
        >
          <HeroPreview />
        </motion.div>
      </motion.div>

      {/* Scroll cue, fades away as soon as you start scrolling. */}
      <motion.div
        style={reduce ? undefined : { opacity: indicatorOpacity }}
        className='text-muted-foreground pointer-events-none absolute inset-x-0 bottom-4 flex justify-center'
        aria-hidden
      >
        <ChevronDownIcon className='size-5 animate-bounce' />
      </motion.div>
    </section>
  );
}
