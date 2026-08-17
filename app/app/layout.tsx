import type React from "react"
import { redirect } from "next/navigation"
import { headers } from "next/headers"
import { auth } from "@/lib/auth"
import { getMyRole } from "@/lib/roles"
import { AppNav } from "@/components/app-nav"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) redirect("/sign-in")

  const u = session.user as typeof session.user & { username?: string | null }
  const role = await getMyRole()

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <AppNav
        user={{
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
          username: u.username ?? null,
          role,
        }}
      />
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </div>
  )
}
