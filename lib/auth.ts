import { db } from '@/lib/db';
import { user as userTable } from '@/lib/db/schema';
import {
  sendResetPasswordEmail,
  sendVerificationEmailMessage,
} from '@/lib/email';
import { generateUsername } from '@/lib/id';
import { isReservedName } from '@/lib/reserved-names';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { nextCookies } from 'better-auth/next-js';
import { eq } from 'drizzle-orm';
import { Pool } from 'pg';

// Generate a default username that isn't already taken. Retries a handful of
// times on the (astronomically unlikely) chance of a collision.
async function generateUniqueUsername(): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const candidate = generateUsername();
    const [existing] = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.username, candidate))
      .limit(1);
    if (!existing) return candidate;
  }
  // Extremely unlikely fallback: append extra entropy.
  return `${generateUsername()}${Date.now().toString(36).slice(-3)}`.slice(
    0,
    20,
  );
}

function getBaseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.V0_RUNTIME_URL;
}

function getTrustedOrigins() {
  const origins: string[] = [];
  if (process.env.NODE_ENV === 'development') {
    if (process.env.V0_RUNTIME_URL) origins.push(process.env.V0_RUNTIME_URL);
    // The v0 preview iframe is served from rotating *.vercel.run / *.v0.build
    // hosts, so trust those wildcard origins in development only.
    origins.push('https://*.vercel.run', 'https://*.v0.build');
  } else {
    if (process.env.VERCEL_URL)
      origins.push(`https://${process.env.VERCEL_URL}`);
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
      origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }
  return origins;
}

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  baseURL: getBaseURL(),
  trustedOrigins: getTrustedOrigins(),
  session: {
    // Skip the per-request DB session lookup via a signed cookie cache; safe
    // because roles (getMyRole) and bans (getEffectiveBan) are read fresh.
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmailMessage(user.email, url);
    },
    sendOnSignUp: true,
  },
  user: {
    additionalFields: {
      username: { type: 'string', required: false, input: false },
      bio: { type: 'string', required: false, input: false },
      role: { type: 'string', required: false, input: false },
    },
    deleteUser: {
      enabled: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        // Every user gets a unique, generated username by default. They can
        // change it later in settings, but it is always present. We also refuse
        // display names that impersonate Orbit or a staff identity right at
        // signup, before the row is written.
        before: async (data) => {
          const record = data as Record<string, unknown>;
          if (
            typeof record.name === 'string' &&
            isReservedName(record.name)
          ) {
            throw new APIError('BAD_REQUEST', {
              message:
                "That display name isn't allowed — it impersonates Orbit or our staff",
            });
          }
          if (!record.username) {
            return {
              data: { ...record, username: await generateUniqueUsername() },
            };
          }
          return { data: record };
        },
      },
    },
  },
  advanced: {
    // Capture the originating client IP into session.ipAddress so account bans
    // can optionally extend to an IP ban. Behind Vercel/proxies the real client
    // IP arrives in these headers.
    ipAddress: {
      ipAddressHeaders: ['x-forwarded-for', 'x-real-ip'],
    },
    ...(process.env.NODE_ENV === 'development'
      ? {
          // Required by the cross-site v0 preview iframe. Without these
          // attributes, login succeeds but the next request appears signed out.
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        }
      : {}),
  },
  plugins: [nextCookies()],
});
