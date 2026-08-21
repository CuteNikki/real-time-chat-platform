import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { Reveal } from './motion';

const FAQS: { q: string; a: React.ReactNode }[] = [
  {
    q: 'How does random matching work?',
    a: (
      <>
        Hit &quot;Find a match&quot; and we pair you one-on-one with someone
        else looking to chat right now, prioritizing people who share your
        interests.
        <br />
        You can end the chat and find a new match anytime! Nothing from a random
        chat is saved once it ends.
      </>
    ),
  },
  {
    q: 'Is Orbit free to use?',
    a: 'Yes! Creating an account, matching with strangers, joining rooms and messaging friends are all completely free features.',
  },
  {
    q: 'Can I control which notifications I get?',
    a: "Yes. In 'Settings' > 'Preferences' you can turn popups and sounds on or off individually for friend requests, accepted requests, direct messages, room messages, and post likes. Plus set a master volume.",
  },
  {
    q: 'What happens if someone reports me or I report someone?',
    a: (
      <>
        Reports go to our moderation team for review. Accounts that violate our
        guidelines can be suspended for a set period or permanently.
        <br />
        If this happens to your account, you&apos;ll see the reason and
        duration.
        <br />
        If someone&apos;s made you uncomfortable, please use the report option!
      </>
    ),
  },
  {
    q: 'Can I delete my account and data?',
    a: "Yes, anytime! From 'Settings' > 'Account'. Deleting your account permanently removes your profile, posts, messages and friend connections - beware this can't be undone!",
  },
];

export function Faq() {
  return (
    <section className='mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-16 sm:py-20'>
      <Reveal className='flex flex-col items-center'>
        <span className='text-primary text-sm font-semibold tracking-wider uppercase'>
          Good to know
        </span>
        <h2 className='mt-3 text-center text-4xl font-semibold tracking-tight text-balance md:text-5xl'>
          Frequently asked questions
        </h2>
      </Reveal>
      <Reveal className='mt-8 w-full max-w-3xl' delay={0.1}>
        <Accordion type='multiple'>
          {FAQS.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className='text-base'>{f.q}</AccordionTrigger>
              <AccordionContent className='text-foreground/80 text-pretty'>
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
