import type { Metadata } from 'next';

import { LegalShell, type LegalSection } from '@/components/legal/legal-shell';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description:
    'The rules and terms that govern your use of the Orbit platform.',
};

const sections: LegalSection[] = [
  {
    heading: 'Acceptance of terms',
    body: (
      <p>
        By accessing or using {LEGAL.siteName} (the &quot;service&quot;), you
        agree to be bound by these Terms &amp; Conditions and our Privacy
        Policy. If you do not agree with any part of these terms, please do not
        use the service.
      </p>
    ),
  },
  {
    heading: 'Eligibility',
    body: (
      <p>
        You must be at least 13 years old, or the minimum age required in your
        country, to use {LEGAL.siteName}. If you are under the age of legal
        majority where you live, you may only use the service with the consent
        and supervision of a parent or guardian.
      </p>
    ),
  },
  {
    heading: 'Your account',
    body: (
      <>
        <p>When you create an account, you agree to:</p>
        <ul>
          <li>Provide accurate information and keep it up to date.</li>
          <li>Keep your login credentials confidential and secure.</li>
          <li>
            Take responsibility for all activity that occurs under your account.
          </li>
          <li>Notify us promptly of any unauthorized use of your account.</li>
        </ul>
        <p>
          Accounts are personal to you. You may not share, sell, or transfer
          your account to anyone else.
        </p>
      </>
    ),
  },
  {
    heading: 'Acceptable use',
    body: (
      <>
        <p>
          {LEGAL.siteName} is a shared space, and we ask you to keep it safe and
          welcoming. You agree not to:
        </p>
        <ul>
          <li>
            Harass, threaten, bully, or harm others, or promote hate or
            violence.
          </li>
          <li>
            Post illegal content, or content that is sexually explicit or
            exploits minors in any way.
          </li>
          <li>
            Impersonate others or misrepresent your affiliation with anyone.
          </li>
          <li>
            Share other people&apos;s private information without their consent.
          </li>
          <li>Spam, scam, or send unsolicited advertising.</li>
          <li>
            Attempt to disrupt, scrape, reverse engineer, or exploit the service
            or its infrastructure.
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: 'User content',
    body: (
      <p>
        You retain ownership of the content you create. By posting or sharing
        content, you grant us a non-exclusive, worldwide license to host, store,
        and display it solely to operate and provide the service. You are
        responsible for the content you share and confirm that you have the
        right to share it.
      </p>
    ),
  },
  {
    heading: 'Real-time features',
    body: (
      <p>
        {LEGAL.siteName} connects you with other people through random matching,
        group rooms, and private chats. You interact with others at your own
        discretion and are responsible for your conduct. Random chats are
        ephemeral and are not stored after they end. If someone makes you
        uncomfortable, please use the built-in reporting tools.
      </p>
    ),
  },
  {
    heading: 'Moderation, suspensions, and bans',
    body: (
      <p>
        We review reports and may remove content, or suspend or ban accounts —
        temporarily or permanently — that violate these terms or our community
        standards. Where your account is restricted, you will be shown the
        reason and, if applicable, the duration. Enforcement decisions are made
        at our reasonable discretion to protect the community.
      </p>
    ),
  },
  {
    heading: 'Intellectual property',
    body: (
      <p>
        The {LEGAL.siteName} name, logo, software, and design are owned by us
        and protected by intellectual property laws. You may not copy, modify,
        distribute, or reverse engineer any part of the service except as
        expressly permitted.
      </p>
    ),
  },
  {
    heading: 'Third-party services',
    body: (
      <p>
        The service depends on third-party providers for hosting, messaging,
        email, storage, and analytics. We are not responsible for the
        availability, performance, or actions of those third parties.
      </p>
    ),
  },
  {
    heading: 'Termination',
    body: (
      <p>
        You may delete your account at any time from your settings. We may
        suspend or terminate your access if you violate these terms or if
        necessary to protect the service or its users. Upon termination, your
        right to use the service ends immediately.
      </p>
    ),
  },
  {
    heading: 'Disclaimers',
    body: (
      <p>
        The service is provided &quot;as is&quot; and &quot;as available&quot;
        without warranties of any kind, whether express or implied. We do not
        guarantee that the service will be uninterrupted, secure, or error-free.
      </p>
    ),
  },
  {
    heading: 'Limitation of liability',
    body: (
      <p>
        To the fullest extent permitted by law, {LEGAL.siteName} and its
        operators will not be liable for any indirect, incidental, special, or
        consequential damages arising from your use of, or inability to use, the
        service.
      </p>
    ),
  },
  {
    heading: 'Changes to the service and terms',
    body: (
      <p>
        We may modify or discontinue features of the service, and we may update
        these terms from time to time. When we make material changes, we will
        update the &quot;Last updated&quot; date above. Continuing to use the
        service after changes take effect means you accept the updated terms.
      </p>
    ),
  },
  {
    heading: 'Governing law',
    body: (
      <p>
        These terms are governed by the laws of {LEGAL.jurisdiction}, without
        regard to its conflict of law provisions.
      </p>
    ),
  },
  {
    heading: 'Contact us',
    body: (
      <p>
        If you have questions about these Terms &amp; Conditions, contact us at{' '}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalShell
      eyebrow='Legal'
      title='Terms & Conditions'
      intro='These terms set out the rules for using Orbit. Please read them carefully — using the service means you agree to them.'
      updated={LEGAL.effectiveDate}
      sections={sections}
    />
  );
}
