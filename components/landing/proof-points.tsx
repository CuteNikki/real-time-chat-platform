import {
  BadgeCheckIcon,
  EyeOffIcon,
  RadioIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

import { Reveal } from './motion';

// Honest proof points — every claim here is true of the product (see the FAQ /
// data model), so nothing is fabricated. No invented metrics or testimonials.
const POINTS: {
  icon: LucideIcon;
  title: string;
  body: string;
  glow: string;
}[] = [
  {
    icon: ZapIcon,
    title: 'Set up in seconds',
    body: 'No lengthy profile, no swiping. Make an account and you are talking to someone new almost immediately.',
    glow: 'from-amber-400/30 to-orange-500/30',
  },
  {
    icon: EyeOffIcon,
    title: 'Nothing saved',
    body: 'When a random chat ends, it is gone for good — nothing from it is stored or resurfaced later.',
    glow: 'from-violet-500/30 to-fuchsia-500/30',
  },
  {
    icon: RadioIcon,
    title: 'See who is live',
    body: 'Real presence, not stale counters. Every room shows exactly who is connected as it changes.',
    glow: 'from-sky-500/30 to-emerald-500/30',
  },
  {
    icon: BadgeCheckIcon,
    title: 'Free, no catch',
    body: 'Matching, rooms and private messaging are all completely free. No card, no trial, no paywall.',
    glow: 'from-emerald-500/30 to-teal-500/30',
  },
];

export function ProofPoints() {
  return (
    <section className='mx-auto w-full max-w-7xl px-4 py-20 lg:py-24'>
      <Reveal className='mb-12 max-w-2xl'>
        <span className='text-primary text-sm font-semibold tracking-wider uppercase'>
          Why Orbit
        </span>
        <h2 className='mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl'>
          Built to feel effortless
        </h2>
      </Reveal>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {POINTS.map((p, i) => {
          const Icon = p.icon;
          return (
            <Reveal key={p.title} delay={i * 0.08}>
              <div className='border-border bg-card relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border p-6'>
                {/* Soft corner glow for a touch of depth. */}
                <div
                  aria-hidden
                  className={cn(
                    'pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-linear-to-br opacity-50 blur-2xl',
                    p.glow,
                  )}
                />
                <div className='bg-accent text-accent-foreground relative flex size-11 items-center justify-center rounded-xl'>
                  <Icon className='size-5' aria-hidden />
                </div>
                <span className='relative font-semibold tracking-tight'>
                  {p.title}
                </span>
                <p className='text-muted-foreground relative text-sm leading-relaxed text-pretty'>
                  {p.body}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
