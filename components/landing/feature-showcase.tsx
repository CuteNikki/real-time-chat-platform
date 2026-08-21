'use client';

import { useEffect, useRef, useState } from 'react';

import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
} from 'motion/react';
import {
  ImageIcon,
  LockIcon,
  ShuffleIcon,
  Users2Icon,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { EASE, Reveal } from './motion';

const AUTOPLAY_MS = 6000;

// A gradient chip standing in for a user avatar in the mock visuals.
function MiniAvatar({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-xs font-semibold text-white',
        className,
      )}
    >
      {label}
    </span>
  );
}

function Bubble({
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
          'max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
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

// ---- Per-feature mock visuals -------------------------------------------

function MatchVisual() {
  return (
    <div className='flex h-full flex-col justify-center gap-5'>
      <div className='flex items-center justify-center gap-4'>
        <MiniAvatar
          label='You'
          className='size-14 from-violet-500 to-fuchsia-500 text-sm'
        />
        <div className='relative flex flex-col items-center'>
          <span className='bg-primary/15 text-primary rounded-full px-3 py-1 text-xs font-semibold'>
            matched
          </span>
          <div className='bg-border my-1 h-8 w-px' />
        </div>
        <MiniAvatar
          label='R'
          className='size-14 from-sky-500 to-emerald-500 text-sm'
        />
      </div>
      <div className='flex flex-col gap-3'>
        <Bubble side='start' name='Stranger'>
          hey! random question — cats or dogs 🐱🐶
        </Bubble>
        <Bubble side='end'>cats, obviously. this is a test</Bubble>
      </div>
    </div>
  );
}

function RoomsVisual() {
  return (
    <div className='flex h-full flex-col gap-4'>
      <div className='flex items-center justify-between'>
        <span className='font-semibold tracking-tight'># late-night-talks</span>
        <span className='bg-primary/15 text-primary flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold'>
          <Users2Icon className='size-3.5' aria-hidden />
          12 live
        </span>
      </div>
      <div className='flex -space-x-2'>
        {[
          'from-rose-500 to-orange-500',
          'from-sky-500 to-indigo-500',
          'from-emerald-500 to-teal-500',
          'from-violet-500 to-fuchsia-500',
        ].map((g, i) => (
          <MiniAvatar
            key={i}
            label=''
            className={cn('border-card size-7 border-2', g)}
          />
        ))}
        <span className='bg-secondary text-secondary-foreground border-card flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-semibold'>
          +8
        </span>
      </div>
      <div className='flex flex-col gap-3'>
        <Bubble side='start' name='Priya'>
          anyone up for a movie rec?
        </Bubble>
        <Bubble side='start' name='Leo'>
          the whole room is awake somehow 😅
        </Bubble>
        <Bubble side='end'>this is the best room fr</Bubble>
      </div>
    </div>
  );
}

function PrivateVisual() {
  return (
    <div className='flex h-full flex-col justify-center gap-3'>
      <div className='text-muted-foreground flex items-center gap-2 text-xs'>
        <LockIcon className='size-3.5' aria-hidden />
        Private · just the two of you
      </div>
      <Bubble side='start' name='Sam'>
        sending the sunset from earlier 🌇
      </Bubble>
      <div className='flex justify-start'>
        <div className='bg-secondary max-w-[85%] rounded-2xl rounded-bl-sm p-1.5'>
          <div className='flex h-24 w-40 items-center justify-center rounded-xl bg-linear-to-br from-amber-400 via-rose-400 to-purple-500'>
            <ImageIcon className='size-6 text-white/80' aria-hidden />
          </div>
        </div>
      </div>
      <Bubble side='end'>okay that&apos;s unreal 😍</Bubble>
    </div>
  );
}

type Feature = {
  icon: LucideIcon;
  title: string;
  blurb: string;
  Visual: () => React.ReactElement;
};

const FEATURES: Feature[] = [
  {
    icon: ShuffleIcon,
    title: 'Random match',
    blurb:
      "Tap once and get paired one-on-one with someone who's up to talk right now. Skip anytime — nothing's saved when a random chat ends.",
    Visual: MatchVisual,
  },
  {
    icon: Users2Icon,
    title: 'Group rooms',
    blurb:
      'Drop into open rooms and chat with everyone at once. Live presence shows exactly who is in the room as it happens.',
    Visual: RoomsVisual,
  },
  {
    icon: LockIcon,
    title: 'Private chats',
    blurb:
      'Message friends one-on-one, share images, and keep the conversation just between the two of you.',
    Visual: PrivateVisual,
  },
];

export function FeatureShowcase() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  // Progress is a motion value so the bar animates at 60fps without a React
  // re-render every frame. `active` only changes once per cycle.
  const progress = useMotionValue(0);
  const activeRef = useRef(0);
  const progressRef = useRef(0);
  const pausedRef = useRef(false);

  activeRef.current = active;

  const select = (i: number) => {
    progressRef.current = 0;
    progress.set(0);
    setActive(i);
  };

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        progressRef.current += dt / AUTOPLAY_MS;
        if (progressRef.current >= 1) {
          progressRef.current = 0;
          const next = (activeRef.current + 1) % FEATURES.length;
          activeRef.current = next;
          setActive(next);
        }
        progress.set(progressRef.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduce, progress]);

  const ActiveVisual = FEATURES[active].Visual;

  return (
    <section className='mx-auto w-full max-w-7xl px-4 py-20 lg:py-28'>
      <Reveal className='mb-12 flex flex-col items-center text-center'>
        <span className='text-primary text-sm font-semibold tracking-wider uppercase'>
          One app, three ways to talk
        </span>
        <h2 className='mt-3 max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl'>
          Every kind of conversation, in real time
        </h2>
      </Reveal>

      <div
        className='grid grid-cols-1 gap-6 lg:grid-cols-[0.85fr_1.15fr]'
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
      >
        {/* Tabs */}
        <div className='flex flex-col gap-3'>
          {FEATURES.map((f, i) => {
            const isActive = i === active;
            const Icon = f.icon;
            return (
              <button
                key={f.title}
                type='button'
                onClick={() => select(i)}
                className='group relative w-full rounded-2xl p-5 text-left'
              >
                {isActive && (
                  <motion.div
                    layoutId='feature-active'
                    className='border-border bg-card absolute inset-0 rounded-2xl border shadow-lg shadow-black/5'
                    transition={{ duration: 0.5, ease: EASE }}
                  />
                )}
                <div className='relative flex items-start gap-4'>
                  <div
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-xl transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-accent text-accent-foreground',
                    )}
                  >
                    <Icon className='size-5' aria-hidden />
                  </div>
                  <div className='min-w-0 flex-1'>
                    <span className='block font-semibold tracking-tight'>
                      {f.title}
                    </span>
                    <p
                      className={cn(
                        'text-muted-foreground mt-1 text-sm leading-relaxed text-pretty transition-all',
                        isActive
                          ? 'opacity-100'
                          : 'opacity-70 group-hover:opacity-100',
                      )}
                    >
                      {f.blurb}
                    </p>
                    {/* Progress track — only the active tab's bar fills. */}
                    <div className='bg-border mt-3 h-1 w-full overflow-hidden rounded-full'>
                      {isActive && (
                        <motion.div
                          className='bg-primary h-full w-full origin-left rounded-full'
                          style={
                            reduce ? { scaleX: 1 } : { scaleX: progress }
                          }
                        />
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Visual panel */}
        <div className='border-border bg-card/60 relative min-h-88 overflow-hidden rounded-3xl border p-6 backdrop-blur-sm sm:p-8'>
          <AnimatePresence mode='wait'>
            <motion.div
              key={active}
              initial={reduce ? false : { opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.45, ease: EASE }}
              className='relative h-full'
            >
              <ActiveVisual />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
