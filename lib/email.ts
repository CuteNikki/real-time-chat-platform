import 'server-only';
import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? 'Orbit <onboarding@resend.dev>';

// Central place every transactional email goes through. Falls back to a
// console log in local/dev when no API key is configured, so `bun dev`
// keeps working without secrets — mirrors the previous sendResetPassword
// behavior instead of throwing.
export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.log(`[v0] (no RESEND_API_KEY) Would send "${subject}" to ${to}`);
    return;
  }
  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) {
    console.error('[v0] Email send failed:', error);
    throw new Error('Could not send email');
  }
}
