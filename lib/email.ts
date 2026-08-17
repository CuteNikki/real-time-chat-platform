import 'server-only';

import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = process.env.EMAIL_FROM ?? 'Orbit <onboarding@resend.dev>';

const BRAND = '#7c3aed';
const BG = '#f4f4f7';
const CARD = '#ffffff';
const TEXT = '#18181b';
const MUTED = '#71717a';
const BORDER = '#e4e4e7';

function renderEmailShell({
  preheader,
  heading,
  bodyHtml,
  ctaLabel,
  ctaUrl,
}: {
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${heading}</title>
  </head>
  <body style="margin:0; padding:0; background-color:${BG}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <!-- Preheader: hidden preview text shown in inbox lists -->
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">
      ${preheader}
    </div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BG}; padding: 40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width: 480px; width: 100%;">
            <!-- Logo / wordmark -->
            <tr>
              <td style="padding-bottom: 24px; text-align: center;">
                <span style="font-size: 20px; font-weight: 700; letter-spacing: -0.02em; color: ${TEXT};">
                  ⟡ Orbit
                </span>
              </td>
            </tr>

            <!-- Card -->
            <tr>
              <td style="background-color:${CARD}; border:1px solid ${BORDER}; border-radius: 16px; padding: 36px 32px;">
                <h1 style="margin:0 0 12px; font-size: 20px; line-height: 1.3; font-weight: 600; color:${TEXT};">
                  ${heading}
                </h1>
                <div style="font-size: 14px; line-height: 1.6; color:${MUTED};">
                  ${bodyHtml}
                </div>

                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top: 28px;">
                  <tr>
                    <td style="border-radius: 10px; background-color: ${BRAND};">
                      
                        href="${ctaUrl}"
                        style="display:inline-block; padding: 11px 22px; font-size: 14px; font-weight: 600; color:#ffffff; text-decoration:none; border-radius: 10px;"
                      >
                        ${ctaLabel}
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin: 24px 0 0; font-size: 12px; line-height: 1.6; color:${MUTED};">
                  Or copy and paste this link into your browser:<br />
                  <a href="${ctaUrl}" style="color:${BRAND}; word-break: break-all;">${ctaUrl}</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding: 20px 8px 0; text-align: center;">
                <p style="margin:0; font-size: 12px; color: ${MUTED};">
                  You're receiving this because it's linked to your Orbit account.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

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

export async function sendResetPasswordEmail(to: string, url: string) {
  await sendEmail({
    to,
    subject: 'Reset your Orbit password',
    html: renderEmailShell({
      preheader: 'Reset your Orbit password',
      heading: 'Reset your password',
      bodyHtml: `<p style="margin:0;">We got a request to reset the password on your Orbit account. This link expires shortly — if you didn't ask for this, you can safely ignore it.</p>`,
      ctaLabel: 'Reset password',
      ctaUrl: url,
    }),
  });
}

export async function sendVerificationEmailMessage(to: string, url: string) {
  await sendEmail({
    to,
    subject: 'Verify your Orbit email',
    html: renderEmailShell({
      preheader: 'Confirm your email to finish setting up Orbit',
      heading: 'Verify your email',
      bodyHtml: `<p style="margin:0;">One last step — confirm this is your email address to finish setting up your Orbit account.</p>`,
      ctaLabel: 'Verify email',
      ctaUrl: url,
    }),
  });
}
