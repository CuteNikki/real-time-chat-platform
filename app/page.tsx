'use client';

import Link from 'next/link';

import {
  ArrowRightIcon,
  ArrowUpIcon,
  LockIcon,
  OrbitIcon,
  ShuffleIcon,
  Users2Icon,
} from 'lucide-react';

import { AuthNav } from '@/components/auth/auth-nav';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { buttonVariants } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export default function HomePage() {
  return (
    <div className='bg-background relative flex h-svh flex-col overflow-hidden'>
      <header className='bg-background/70 fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md'>
        <div className='xs:p-6 mx-auto flex w-full max-w-7xl items-center justify-between p-4'>
          <div className='flex items-center gap-2'>
            <OrbitIcon className='text-primary size-6' aria-hidden />
            <span className='text-lg font-semibold tracking-tight'>Orbit</span>
          </div>
          <nav className='flex items-center gap-2'>
            <AuthNav />
          </nav>
        </div>
      </header>

      <main className='relative flex min-h-0 w-full flex-1 flex-col'>
        <div className='h-full w-full overflow-y-auto pt-16 sm:pt-20'>
          <div className='mx-auto w-full max-w-7xl px-4'>
            {/* Hero */}
            <section className='flex flex-col items-center py-20 text-center lg:py-28'>
              <span className='border-border bg-card text-muted-foreground mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm'>
                <span className='relative flex size-2'>
                  <span className='bg-primary absolute inline-flex size-full animate-ping rounded-full opacity-75' />
                  <span className='bg-primary relative inline-flex size-2 rounded-full' />
                </span>
                Live conversations, right now
              </span>
              <span className='max-w-3xl text-5xl leading-[1.05] font-semibold tracking-tight text-balance lg:text-7xl'>
                Talk to someone new in seconds
              </span>
              <p className='text-muted-foreground mt-6 max-w-xl text-lg leading-relaxed text-pretty'>
                Orbit matches you with strangers, spins up group rooms and lets
                you chat with friends in private chats - all in real time.
              </p>
              <div className='mt-9 flex flex-col gap-3 sm:flex-row'>
                <Link
                  href='/sign-up'
                  className={buttonVariants({
                    size: 'lg',
                    className: 'p-4!',
                  })}
                >
                  Start Now
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
                  I have an account
                </Link>
              </div>
            </section>

            {/* Feature grid */}
            <section className='grid gap-4 pb-24 md:grid-cols-3'>
              <FeatureCard
                icon={<ShuffleIcon className='size-5' aria-hidden />}
                title='Random match'
                body="Hit a button and get paired one-on-one with another person who's looking to talk. Skip anytime for a new match."
              />
              <FeatureCard
                icon={<Users2Icon className='size-5' aria-hidden />}
                title='Group rooms'
                body='Join open rooms and chat with everyone at once. See exactly how many people are live in each room.'
              />
              <FeatureCard
                icon={<LockIcon className='size-5' aria-hidden />}
                title='Private chats'
                body='Share images and keep the conversation just between the two of you.'
              />
            </section>

            {/* FAQ Section */}
            <section className='mx-auto flex w-full max-w-7xl flex-col items-center py-4 sm:py-12'>
              <span className='text-center text-2xl font-semibold tracking-tight text-balance md:text-4xl'>
                Frequently Asked Questions
              </span>
              <div className='mt-6 w-full max-w-5xl'>
                <Accordion>
                  <AccordionItem>
                    <AccordionTrigger>
                      How does random matching work?
                    </AccordionTrigger>
                    <AccordionContent className='text-foreground/80 max-w-4xl text-pretty'>
                      Hit &quot;Find a match&quot; and we pair you one-on-one
                      with someone else looking to chat right now, prioritizing
                      people who share your interests.
                      <br />
                      You can end the chat and find a new match anytime! Nothing
                      from a random chat is saved once it ends.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem>
                    <AccordionTrigger>Is Orbit free to use?</AccordionTrigger>
                    <AccordionContent className='text-foreground/80 max-w-4xl text-pretty'>
                      Yes! Creating an account, matching with strangers, joining
                      rooms and messaging friends are all completely free
                      features.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem>
                    <AccordionTrigger>
                      Can I control which notifications I get?
                    </AccordionTrigger>
                    <AccordionContent className='text-foreground/80 max-w-4xl text-pretty'>
                      Yes. In &apos;Settings&apos; &gt; &apos;Preferences&apos;
                      you can turn popups and sounds on or off individually for
                      friend requests, accepted requests, direct messages, room
                      messages, and post likes. Plus set a master volume.
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem>
                    <AccordionTrigger>
                      What happens if someone reports me or I report someone?
                    </AccordionTrigger>
                    <AccordionContent className='text-foreground/80 max-w-4xl text-pretty'>
                      Reports go to our moderation team for review. Accounts
                      that violate our guidelines can be suspended for a set
                      period or permanently.
                      <br />
                      If this happens to your account, you&apos;ll see the
                      reason and duration.
                      <br />
                      If someone&apos;s made you uncomfortable, please use the
                      report option!
                    </AccordionContent>
                  </AccordionItem>

                  <AccordionItem>
                    <AccordionTrigger>
                      Can I delete my account and data?
                    </AccordionTrigger>
                    <AccordionContent className='text-foreground/80 max-w-4xl text-pretty'>
                      Yes, anytime! From &apos;Settings&apos; &gt;
                      &apos;Account&apos;. Deleting your account permanently
                      removes your profile, posts, messages and friend
                      connections - beware this can&apos;t be undone!
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </section>

            {/* Call to Action */}
            <section className='py-12'>
              <div className='bg-primary text-primary-foreground xs:py-12 relative flex flex-col items-center gap-4 overflow-hidden rounded-3xl p-6 text-center'>
                <div
                  aria-hidden
                  className='bg-primary-foreground/10 pointer-events-none absolute -top-20 -right-20 size-72 rounded-full blur-2xl'
                />
                <div
                  aria-hidden
                  className='bg-primary-foreground/10 pointer-events-none absolute -bottom-24 -left-12 size-72 rounded-full blur-2xl'
                />
                <span className='relative text-2xl font-semibold tracking-tight text-balance md:text-4xl'>
                  Someone New is One Tap Away
                </span>
                <p className='text-primary-foreground/80 relative text-center text-pretty'>
                  No lengthy profile, no swiping.
                  <br />
                  Just real-time conversation whenever you want it.
                </p>
                <Link
                  href='/sign-up'
                  className={buttonVariants({
                    variant: 'secondary',
                    size: 'lg',
                  })}
                >
                  Start Now
                  <ArrowRightIcon aria-hidden />
                </Link>
              </div>
            </section>
          </div>

          {/* Footer */}
          <footer className='xs:p-6 mx-auto w-full max-w-7xl p-4'>
            <div className='flex flex-col gap-6 sm:flex-row sm:justify-between'>
              <div className='flex flex-col gap-2'>
                <Link href='/' className='flex items-center gap-2'>
                  <OrbitIcon className='text-primary size-6' aria-hidden />
                  <span className='text-lg font-semibold tracking-tight'>
                    Orbit
                  </span>
                </Link>
                <span className='text-muted-foreground text-sm'>
                  Real-time chat, powered by presence.
                </span>
              </div>
              <div className='xs:flex-row flex flex-wrap gap-x-10 gap-y-4'>
                <div className='flex flex-col gap-2'>
                  <span className='font-semibold tracking-tight'>Company</span>
                  <ul className='text-muted-foreground [&>li>a]:hover:text-foreground [&>li>a]:focus:text-foreground flex flex-col gap-1 text-sm [&>li>a]:transition-colors [&>li>a]:hover:underline'>
                    <li>
                      <Link href='/about'>About</Link>
                    </li>
                    <li>
                      <Link href='/careers'>Careers</Link>
                    </li>
                  </ul>
                </div>
                <div className='flex flex-col gap-2'>
                  <span className='font-semibold tracking-tight'>Socials</span>
                  <ul className='text-muted-foreground [&>li>a]:hover:text-foreground [&>li>a]:focus:text-foreground flex flex-col gap-1 text-sm [&>li>a]:transition-colors [&>li>a]:hover:underline'>
                    <li>
                      <Link href='/discord'>Discord</Link>
                    </li>
                    <li>
                      <Link href='/instagram'>Instagram</Link>
                    </li>
                    <li>
                      <Link href='/twitter'>Twitter</Link>
                    </li>
                  </ul>
                </div>
                <div className='flex flex-col gap-2'>
                  <span className='font-semibold tracking-tight'>Legal</span>
                  <ul className='text-muted-foreground [&>li>a]:hover:text-foreground [&>li>a]:focus:text-foreground flex flex-col gap-1 text-sm [&>li>a]:transition-colors [&>li>a]:hover:underline'>
                    <li>
                      <Link href='/privacy'>Privacy Policy</Link>
                    </li>
                    <li>
                      <Link href='/terms'>Terms & Conditions</Link>
                    </li>
                    <li>
                      <Link href='/imprint'>Imprint</Link>
                    </li>
                  </ul>
                </div>
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
        </div>
      </main>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className='border-border bg-card flex flex-col gap-2 rounded-xl border p-6'>
      <div className='flex items-center gap-2'>
        <div className='bg-accent text-accent-foreground flex size-10 items-center justify-center rounded-lg'>
          {icon}
        </div>
        <span className='text-lg font-semibold tracking-tight'>{title}</span>
      </div>
      <p className='text-muted-foreground text-sm leading-relaxed text-pretty'>
        {body}
      </p>
    </div>
  );
}
