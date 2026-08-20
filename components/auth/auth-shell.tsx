import Link from 'next/link';

import { OrbitIcon } from 'lucide-react';

export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <main className='flex min-h-svh flex-col lg:flex-row'>
      {/* Brand panel */}
      <section className='bg-primary text-primary-foreground xs:p-6 relative flex flex-col justify-between overflow-hidden p-4 lg:w-[40%]'>
        <Link href='/' className='flex items-center gap-2'>
          <OrbitIcon className='size-6' aria-hidden />
          <span className='text-lg font-semibold tracking-tight'>Orbit</span>
        </Link>

        <div className='xs:px-4 relative z-10 hidden max-w-md lg:block'>
          <h2 className='text-3xl leading-tight font-semibold tracking-tight text-balance'>
            Someone new is always one tap away.
          </h2>
          <p className='text-primary-foreground/80 mt-4 text-base leading-relaxed text-pretty'>
            Get matched with a stranger, drop into a group room, or start a
            private chat with a friend. Conversations happen in real time.
          </p>
        </div>

        <div
          aria-hidden
          className='bg-primary-foreground/10 pointer-events-none absolute -top-24 -right-24 size-112 rounded-full blur-2xl'
        />
        <div
          aria-hidden
          className='bg-primary-foreground/10 pointer-events-none absolute -bottom-32 -left-16 size-96 rounded-full blur-2xl'
        />

        <p className='relative z-10 hidden text-sm lg:block'>
          Real-time chat, powered by presence.
        </p>
      </section>

      {/* Form panel */}
      <section className='flex flex-1 items-center justify-center px-6 py-12'>
        <div className='flex w-full max-w-md flex-col gap-6 text-center'>
          <div className='flex flex-col gap-2'>
            <span className='text-foreground text-2xl font-semibold tracking-tight'>
              {title}
            </span>
            <p className='text-muted-foreground text-sm text-pretty'>
              {subtitle}
            </p>
          </div>
          <div>{children}</div>
        </div>
      </section>
    </main>
  );
}
