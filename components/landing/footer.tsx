'use client';

import Link from 'next/link';

import { ArrowUpIcon, OrbitIcon } from 'lucide-react';

import { Separator } from '@/components/ui/separator';

const GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Careers', href: '/careers' },
    ],
  },
  {
    title: 'Socials',
    links: [
      { label: 'Discord', href: '/discord' },
      { label: 'Instagram', href: '/instagram' },
      { label: 'Twitter', href: '/twitter' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Imprint', href: '/imprint' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className='xs:p-6 mx-auto w-full max-w-7xl p-4'>
      <div className='flex flex-col gap-6 sm:flex-row sm:justify-between'>
        <div className='flex flex-col gap-2'>
          <Link href='/' className='flex items-center gap-2'>
            <OrbitIcon className='text-primary size-6' aria-hidden />
            <span className='text-lg font-semibold tracking-tight'>Orbit</span>
          </Link>
          <span className='text-muted-foreground text-sm'>
            Real-time chat, powered by presence.
          </span>
        </div>
        <div className='xs:flex-row flex flex-wrap gap-x-10 gap-y-4'>
          {GROUPS.map((g) => (
            <div key={g.title} className='flex flex-col gap-2'>
              <span className='font-semibold tracking-tight'>{g.title}</span>
              <ul className='text-muted-foreground [&>li>a]:hover:text-foreground [&>li>a]:focus:text-foreground flex flex-col gap-1 text-sm [&>li>a]:transition-colors [&>li>a]:hover:underline'>
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href}>{l.label}</Link>
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
          © {new Date().getFullYear()} Orbit · All rights reserved.
        </span>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className='text-muted-foreground hover:text-foreground focus:text-foreground flex items-center gap-1 text-xs uppercase transition-colors'
        >
          Back to top
          <ArrowUpIcon className='inline-block size-4' aria-hidden />
        </button>
      </div>
    </footer>
  );
}
