import { OrbitIcon } from 'lucide-react';

import { AuthNav } from '@/components/auth/auth-nav';
import { Cta } from '@/components/landing/cta';
import { Faq } from '@/components/landing/faq';
import { FeatureShowcase } from '@/components/landing/feature-showcase';
import { LandingFooter } from '@/components/landing/footer';
import { Hero } from '@/components/landing/hero';
import { LandingScroll } from '@/components/landing/landing-scroll';
import { ProofPoints } from '@/components/landing/proof-points';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className='bg-background relative flex h-svh flex-col overflow-hidden'>
      <div
        aria-hidden
        className='pointer-events-none fixed inset-0 -z-10 overflow-hidden'
      >
        <div className='bg-primary/10 absolute -top-40 -left-32 size-152 rounded-full blur-3xl' />
        <div className='bg-primary/6 absolute top-1/2 -right-40 size-136 rounded-full blur-3xl' />
        <div className='bg-grain absolute inset-0 opacity-[0.03] mix-blend-overlay dark:opacity-[0.04]' />
      </div>

      {/* Header */}
      <header className='bg-background/70 fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md'>
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

      {/* Scroll inside this container (not the window) so the scrollbar sits
          under the fixed header, like the app shell. Hero reads it for its
          scroll-driven exit. */}
      <LandingScroll className='relative min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto sm:px-4'>
        {/* Hero owns its own scroll-driven exit; padded for the fixed header. */}
        <div className='pt-16 sm:pt-20'>
          <Hero />
        </div>

        {/* Everything below scrolls up over the hero as it fades + recedes. */}
        <div className='bg-background relative z-10'>
          <FeatureShowcase />
          <ProofPoints />
          <Faq />
          <Cta />
          <LandingFooter />
        </div>
      </LandingScroll>
    </div>
  );
}
