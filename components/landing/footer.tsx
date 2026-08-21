'use client';

import Link from 'next/link';

import { ArrowUpIcon, OrbitIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Separator } from '@/components/ui/separator';

const GROUPS: {
  titleKey: string;
  links: { labelKey: string; href: string }[];
}[] = [
  {
    titleKey: 'landing.footer.groups.company',
    links: [
      { labelKey: 'landing.footer.links.about', href: '/about' },
      { labelKey: 'landing.footer.links.careers', href: '/careers' },
    ],
  },
  {
    titleKey: 'landing.footer.groups.socials',
    links: [
      { labelKey: 'landing.footer.links.discord', href: '/discord' },
      { labelKey: 'landing.footer.links.instagram', href: '/instagram' },
      { labelKey: 'landing.footer.links.twitter', href: '/twitter' },
    ],
  },
  {
    titleKey: 'landing.footer.groups.legal',
    links: [
      { labelKey: 'landing.footer.links.privacy', href: '/privacy' },
      { labelKey: 'landing.footer.links.terms', href: '/terms' },
      { labelKey: 'landing.footer.links.imprint', href: '/imprint' },
    ],
  },
];

export function LandingFooter() {
  const { t } = useTranslation();

  return (
    <footer className='xs:p-6 mx-auto w-full max-w-7xl p-4'>
      <div className='flex flex-col gap-6 sm:flex-row sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <Link href='/' className='flex items-center gap-2'>
            <OrbitIcon className='text-primary size-6' aria-hidden />
            <span className='text-lg font-semibold tracking-tight'>Orbit</span>
          </Link>
          <span className='text-muted-foreground text-sm'>
            {t('landing.footer.tagline')}
          </span>
        </div>
        <div className='xs:flex-row flex flex-wrap gap-x-10 gap-y-4'>
          {GROUPS.map((g) => (
            <div key={g.titleKey} className='flex flex-col gap-2'>
              <span className='font-semibold tracking-tight'>
                {t(g.titleKey)}
              </span>
              <ul className='text-muted-foreground [&>li>a]:hover:text-foreground [&>li>a]:focus:text-foreground flex flex-col gap-1 text-sm [&>li>a]:transition-colors [&>li>a]:hover:underline'>
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{t(l.labelKey)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <Separator className='my-6' />
      <div className='flex justify-between gap-2'>
        <span className='text-muted-foreground text-xs'>
          {t('landing.footer.rights', { year: new Date().getFullYear() })}
        </span>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className='text-muted-foreground hover:text-foreground focus:text-foreground flex items-center gap-1 text-xs uppercase transition-colors'
        >
          {t('landing.footer.backToTop')}
          <ArrowUpIcon className='inline-block size-4' aria-hidden />
        </button>
      </div>
    </footer>
  );
}
