import type React from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { AppNav } from "@/components/app-nav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const u = session.user as typeof session.user & { username?: string | null }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <AppNav
        user={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
          username: u.username ?? null,
        }}
      />
      <div className="flex-1">{children}</div>
    </div>
  )
}
