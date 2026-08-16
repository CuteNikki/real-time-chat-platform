"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import useSWR from "swr"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Orbit, Shuffle, Users, Lock, LogOut } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const links = [
  { href: "/app", label: "Match", icon: Shuffle, exact: true },
  { href: "/app/rooms", label: "Rooms", icon: Users, exact: false },
  { href: "/app/private", label: "Private", icon: Lock, exact: false },
]

export function AppNav({
  user,
}: {
  user: { name: string; email: string; image: string | null }
}) {
  const pathname = usePathname()
  const router = useRouter()

  // Poll pending invites for the badge; realtime events also revalidate this.
  const { data } = useSWR<{ count: number }>("/api/invites/pending-count", fetcher, {
    refreshInterval: 15000,
  })
  const pendingInvites = data?.count ?? 0

  const initials = user.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user.email[0]?.toUpperCase()

  async function signOut() {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/app" className="flex items-center gap-2">
          <Orbit className="size-6 text-primary" aria-hidden />
          <span className="hidden text-lg font-semibold tracking-tight sm:inline">Orbit</span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
            const Icon = link.icon
            const showBadge = link.href === "/app/private" && pendingInvites > 0
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-secondary text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                <span className="hidden sm:inline">{link.label}</span>
                {showBadge && (
                  <Badge className="ml-0.5 h-5 min-w-5 justify-center px-1 tabular-nums" variant="default">
                    {pendingInvites}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-2">
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="flex flex-col">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="size-4" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
