import {
  BadgeCheckIcon,
  EyeOffIcon,
  RadioIcon,
  ZapIcon,
  type LucideIcon,
} from 'lucide-react';

import { getTranslation } from '@/lib/i18n/server';
import { cn } from '@/lib/utils';

import { Reveal } from './motion';

// Honest proof points — every claim here is true of the product (see the FAQ /
// data model), so nothing is fabricated. No invented metrics or testimonials.
const POINTS: {
  icon: LucideIcon;
  id: string;
  glow: string;
}[] = [
  {
    icon: ZapIcon,
    id: 'setup',
    glow: 'from-amber-400/30 to-orange-500/30',
  },
  {
    icon: EyeOffIcon,
    id: 'nothingSaved',
    glow: 'from-violet-500/30 to-fuchsia-500/30',
  },
  {
    icon: RadioIcon,
    id: 'live',
    glow: 'from-sky-500/30 to-emerald-500/30',
  },
  {
    icon: BadgeCheckIcon,
    id: 'free',
    glow: 'from-emerald-500/30 to-teal-500/30',
  },
];

export async function ProofPoints() {
  const { t } = await getTranslation();

  return (
    <section className='mx-auto w-full max-w-7xl px-4 py-20 lg:py-24'>
      <Reveal className='mb-12 max-w-2xl'>
        <span className='text-primary text-sm font-semibold tracking-wider uppercase'>
          {t('landing.proof.eyebrow')}
        </span>
        <h2 className='mt-3 text-4xl font-semibold tracking-tight text-balance md:text-5xl'>
          {t('landing.proof.title')}
        </h2>
      </Reveal>

      <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {POINTS.map((p, i) => {
          const Icon = p.icon;
          return (
            <Reveal key={p.id} delay={i * 0.08}>
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
                  {t(`landing.proof.${p.id}.title`)}
                </span>
                <p className='text-muted-foreground relative text-sm leading-relaxed text-pretty'>
                  {t(`landing.proof.${p.id}.body`)}
                </p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}
