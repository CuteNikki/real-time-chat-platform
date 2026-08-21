import type { Metadata } from 'next';

import { LegalShell, type LegalSection } from '@/components/legal/legal-shell';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Orbit collects, uses, and protects your personal information.',
};

const sections: LegalSection[] = [
  {
    heading: 'Introduction',
    body: (
      <p>
        This Privacy Policy explains how {LEGAL.siteName} (&quot;we&quot;,
        &quot;us&quot;, or &quot;our&quot;) collects, uses, and safeguards your
        information when you use our real-time chat platform. By creating an
        account or using {LEGAL.siteName}, you agree to the practices described
        here.
      </p>
    ),
  },
  {
    heading: 'Information you provide',
    body: (
      <>
        <p>We collect the information you give us directly, including:</p>
        <ul>
          <li>
            <strong>Account details</strong> — your email address, username,
            display name, and password (which is always stored in a hashed,
            unreadable form).
          </li>
          <li>
            <strong>Profile information</strong> — anything you add to your
            profile, such as a bio, avatar image, or preferences.
          </li>
          <li>
            <strong>Content you create</strong> — posts, messages, room
            activity, images you upload, and any reports you submit.
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: 'Information we collect automatically',
    body: (
      <>
        <p>
          When you use {LEGAL.siteName}, we automatically collect limited
          technical information needed to run and secure the service:
        </p>
        <ul>
          <li>
            Device and connection data such as your IP address, browser type,
            and timestamps.
          </li>
          <li>
            Usage data about how you interact with features, used to keep the
            service reliable and safe.
          </li>
          <li>
            Cookies and local storage entries required for sign-in sessions and
            to remember preferences like your theme.
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: 'How we use your information',
    body: (
      <>
        <p>We use the information we collect to:</p>
        <ul>
          <li>Provide, operate, and maintain the service.</li>
          <li>Authenticate you and keep your account secure.</li>
          <li>
            Power real-time features such as matching, rooms, direct messages,
            and notifications.
          </li>
          <li>
            Detect abuse, enforce our rules, and keep the community safe through
            moderation.
          </li>
          <li>
            Send essential transactional emails, such as password resets and
            security notices.
          </li>
          <li>Understand usage and improve the product.</li>
        </ul>
      </>
    ),
  },
  {
    heading: 'Real-time chats and ephemeral data',
    body: (
      <p>
        Random one-on-one chats are ephemeral — once a match ends, that
        conversation is not retained. Messages in private chats and rooms are
        stored so that you and the people you talk to can see your history. You
        can delete your content or your entire account at any time from your
        settings.
      </p>
    ),
  },
  {
    heading: 'Legal bases for processing',
    body: (
      <p>
        Where applicable law (such as the GDPR) requires it, we rely on the
        following legal bases: performance of our contract with you (to provide
        the service), our legitimate interests (to keep the platform safe and
        improve it), your consent (where we ask for it), and compliance with
        legal obligations.
      </p>
    ),
  },
  {
    heading: 'How we share information',
    body: (
      <>
        <p>
          We do not sell your personal information. We share it only in these
          limited situations:
        </p>
        <ul>
          <li>
            <strong>With other users</strong> — your public profile, posts, and
            any messages you send are visible to the people you share them with.
          </li>
          <li>
            <strong>With service providers</strong> — trusted vendors who
            process data on our behalf to host, operate, and secure the service.
          </li>
          <li>
            <strong>For legal and safety reasons</strong> — when required by law
            or necessary to protect our users, the public, or the service.
          </li>
        </ul>
      </>
    ),
  },
  {
    heading: 'Third-party services',
    body: (
      <>
        <p>
          We rely on a small number of third-party providers who act as data
          processors on our behalf, including services for hosting and
          databases, email delivery, real-time messaging, file storage, and
          privacy-friendly analytics. Each processes data only as needed to
          deliver its part of the service.
        </p>
      </>
    ),
  },
  {
    heading: 'Cookies and local storage',
    body: (
      <p>
        We use essential cookies and local storage to keep you signed in and to
        remember preferences such as your theme. We do not use advertising or
        cross-site tracking cookies.
      </p>
    ),
  },
  {
    heading: 'Data retention',
    body: (
      <p>
        We keep your information for as long as your account is active. When you
        delete your account, we remove your profile, posts, messages, and
        connections. We may retain a limited amount of data where necessary to
        comply with legal obligations or to enforce safety measures, such as
        records of bans.
      </p>
    ),
  },
  {
    heading: 'Your rights',
    body: (
      <>
        <p>
          Depending on where you live, you may have the right to access,
          correct, export, or delete your personal information, and to object to
          or restrict certain processing. You can manage much of this directly
          from your settings, or contact us at{' '}
          <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a> to
          exercise your rights.
        </p>
      </>
    ),
  },
  {
    heading: 'Security',
    body: (
      <p>
        We protect your data with measures such as password hashing, encryption
        in transit, and access controls. No method of transmission or storage is
        ever completely secure, but we work to protect your information and
        continually improve our safeguards.
      </p>
    ),
  },
  {
    heading: "Children's privacy",
    body: (
      <p>
        {LEGAL.siteName} is not intended for children under 13, or under the
        minimum age required in your country. We do not knowingly collect
        personal information from children. If you believe a child has provided
        us with information, please contact us and we will remove it.
      </p>
    ),
  },
  {
    heading: 'International transfers',
    body: (
      <p>
        Your information may be processed in countries other than your own.
        Where we transfer data internationally, we take steps to ensure it
        remains protected in line with this policy and applicable law.
      </p>
    ),
  },
  {
    heading: 'Changes to this policy',
    body: (
      <p>
        We may update this Privacy Policy from time to time. When we do, we will
        revise the &quot;Last updated&quot; date above and, where appropriate,
        provide additional notice.
      </p>
    ),
  },
  {
    heading: 'Contact us',
    body: (
      <p>
        If you have any questions about this Privacy Policy or how we handle
        your data, contact us at{' '}
        <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalShell
      eyebrow='Legal'
      title='Privacy Policy'
      intro='Your privacy matters. This page explains what we collect, why we collect it, and the control you have over your information.'
      updated={LEGAL.effectiveDate}
      sections={sections}
    />
  );
}
