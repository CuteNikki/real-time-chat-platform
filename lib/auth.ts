import { betterAuth } from "better-auth"
import { nextCookies } from "better-auth/next-js"
import { Pool } from "pg"

function getBaseURL() {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return process.env.V0_RUNTIME_URL
}

function getTrustedOrigins() {
  const origins: string[] = []
  if (process.env.NODE_ENV === "development") {
    if (process.env.V0_RUNTIME_URL) origins.push(process.env.V0_RUNTIME_URL)
    // The v0 preview iframe is served from rotating *.vercel.run / *.v0.build
    // hosts, so trust those wildcard origins in development only.
    origins.push("https://*.vercel.run", "https://*.v0.build")
  } else {
    if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`)
    if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
      origins.push(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`)
  }
  return origins
}

export const auth = betterAuth({
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  baseURL: getBaseURL(),
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
    // No email provider is connected yet, so we log the reset link to the
    // server console. Swap this for a real email send when one is added.
    sendResetPassword: async ({ user, url }) => {
      console.log(`[v0] Password reset link for ${user.email}: ${url}`)
    },
  },
  user: {
    additionalFields: {
      username: { type: "string", required: false, input: false },
      bio: { type: "string", required: false, input: false },
      role: { type: "string", required: false, input: false },
    },
    deleteUser: {
      enabled: true,
    },
  },
  ...(process.env.NODE_ENV === "development"
    ? {
        advanced: {
          // Required by the cross-site v0 preview iframe. Without these
          // attributes, login succeeds but the next request appears signed out.
          defaultCookieAttributes: {
            sameSite: "none" as const,
            secure: true,
          },
        },
      }
    : {}),
  plugins: [nextCookies()],
})
