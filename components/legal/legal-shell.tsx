import Link from 'next/link';

import { OrbitIcon } from 'lucide-react';

import { AuthNav } from '@/components/auth/auth-nav';
import { LandingFooter } from '@/components/landing/footer';
import { Reveal } from '@/components/landing/motion';

export type LegalSection = {
  heading: string;
  body: React.ReactNode;
};

// Turn a heading into a stable anchor id so individual clauses can be linked
// to directly (e.g. /terms#your-account).
function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// Shared shell for the static legal pages (Privacy, Terms, Imprint). Mirrors the
// landing page's look — ambient glow, film grain, the same header and footer —
// and reveals its title and each section on scroll.
export function LegalShell({
  eyebrow,
  title,
  intro,
  updated,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
}) {
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

      <main className='relative min-h-0 flex-1 scrollbar-gutter-stable overflow-y-auto'>
        <div className='mx-auto w-full max-w-3xl px-4 py-16 sm:py-24'>
          <Reveal className='flex flex-col gap-3'>
            <span className='text-primary text-sm font-semibold tracking-wider uppercase'>
              {eyebrow}
            </span>
            <h1 className='text-4xl font-semibold tracking-tight text-balance md:text-5xl'>
              {title}
            </h1>
            <p className='text-muted-foreground text-lg leading-relaxed text-pretty'>
              {intro}
            </p>
            <p className='text-muted-foreground text-sm'>
              Last updated: {updated}
            </p>
          </Reveal>

          <div className='mt-14 flex flex-col gap-10'>
            {sections.map((section, index) => (
              <Reveal
                key={section.heading}
                delay={Math.min(index * 0.04, 0.16)}
                amount={0.15}
                className='scroll-mt-24'
              >
                <section
                  id={slugify(section.heading)}
                  className='flex flex-col gap-3'
                >
                  <h2 className='text-xl font-semibold tracking-tight'>
                    <span className='text-primary mr-2 tabular-nums'>
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    {section.heading}
                  </h2>
                  <div className='text-foreground/80 [&_a]:text-primary flex flex-col gap-3 leading-relaxed text-pretty [&_a]:underline [&_a]:underline-offset-2 [&_li]:ml-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5'>
                    {section.body}
                  </div>
                </section>
              </Reveal>
            ))}
          </div>
        </div>

        <LandingFooter />
      </main>
    </div>
  );
}
