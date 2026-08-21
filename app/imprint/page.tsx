import type { Metadata } from 'next';

import { LegalShell, type LegalSection } from '@/components/legal/legal-shell';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Imprint',
  description: 'Legal information and operator details for Orbit.',
};

const sections: LegalSection[] = [
  {
    heading: 'Operator',
    body: (
      <>
        <p>Information pursuant to § 5 DDG (German Digital Services Act):</p>
        <address className='text-foreground/80 flex flex-col gap-0.5 not-italic'>
          <span className='text-foreground font-medium'>
            {LEGAL.operatorName}
          </span>
          <span>{LEGAL.address.line1}</span>
          <span>{LEGAL.address.line2}</span>
          <span>{LEGAL.address.country}</span>
        </address>
      </>
    ),
  },
  {
    heading: 'Contact',
    body: (
      <div className='flex flex-col gap-0.5'>
        <p>
          Email:{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>
        </p>
        {LEGAL.phone ? <p>Phone: {LEGAL.phone}</p> : null}
      </div>
    ),
  },
  {
    heading: 'Responsible for content',
    body: (
      <>
        <p>Responsible for content pursuant to § 18 (2) MStV:</p>
        <address className='text-foreground/80 flex flex-col gap-0.5 not-italic'>
          <span className='text-foreground font-medium'>
            {LEGAL.operatorName}
          </span>
          <span>{LEGAL.address.line1}</span>
          <span>{LEGAL.address.line2}</span>
          <span>{LEGAL.address.country}</span>
        </address>
      </>
    ),
  },
  {
    heading: 'Liability for content',
    body: (
      <p>
        As a service provider, we are responsible for our own content on these
        pages in accordance with § 7 (1) DDG. However, pursuant to §§ 8 to 10
        DDG, we are not obligated to monitor transmitted or stored third-party
        information, or to investigate circumstances that indicate illegal
        activity. Obligations to remove or block the use of information under
        general law remain unaffected. Liability in this regard is only possible
        from the point at which we become aware of a specific legal violation.
        Upon becoming aware of such violations, we will remove this content
        promptly.
      </p>
    ),
  },
  {
    heading: 'Liability for links',
    body: (
      <p>
        Our service may contain links to external websites over which we have no
        control. We accept no liability for their content. The respective
        provider or operator of the linked pages is always responsible for their
        content. If we become aware of any legal violations, we will remove such
        links promptly.
      </p>
    ),
  },
  {
    heading: 'Copyright',
    body: (
      <p>
        The content and works created by the operator on this service are
        subject to copyright law. Contributions from third parties are marked as
        such. Reproduction, processing, distribution, or any form of
        commercialization beyond the scope of copyright law requires the prior
        written consent of the respective author or creator.
      </p>
    ),
  },
];

export default function ImprintPage() {
  return (
    <LegalShell
      eyebrow='Legal'
      title='Imprint'
      intro='Legal information about who operates Orbit and how to get in touch.'
      updated={LEGAL.effectiveDate}
      sections={sections}
    />
  );
}
