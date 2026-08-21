import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

import { getTranslation } from '@/lib/i18n/server';

import { Reveal } from './motion';

const FAQ_IDS = ['matching', 'free', 'notifications', 'reports', 'delete'];

export async function Faq() {
  const { t } = await getTranslation();

  return (
    <section className='mx-auto flex w-full max-w-7xl flex-col items-center px-4 py-16 sm:py-20'>
      <Reveal className='flex flex-col items-center'>
        <span className='text-primary text-sm font-semibold tracking-wider uppercase'>
          {t('landing.faq.eyebrow')}
        </span>
        <h2 className='mt-3 text-center text-4xl font-semibold tracking-tight text-balance md:text-5xl'>
          {t('landing.faq.title')}
        </h2>
      </Reveal>
      <Reveal className='mt-8 w-full max-w-3xl' delay={0.1}>
        <Accordion type='multiple'>
          {FAQ_IDS.map((id) => (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger className='text-base'>
                {t(`landing.faq.${id}.q`)}
              </AccordionTrigger>
              <AccordionContent className='text-foreground/80 text-pretty whitespace-pre-line'>
                {t(`landing.faq.${id}.a`)}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </Reveal>
    </section>
  );
}
