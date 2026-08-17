"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import useSWR from "swr"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { UserAvatar } from "@/components/user-avatar"
import { NotificationBell } from "@/components/notification-bell"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Orbit, Home, Shuffle, Users, MessageCircle, UserPlus, User, Settings, Shield, LogOut } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const links = [
  { href: "/app/feed", label: "Feed", icon: Home, exact: false },
  { href: "/app", label: "Match", icon: Shuffle, exact: true },
  { href: "/app/rooms", label: "Rooms", icon: Users, exact: false },
  { href: "/app/messages", label: "Messages", icon: MessageCircle, exact: false },
  { href: "/app/friends", label: "Friends", icon: UserPlus, exact: false },
]

export function AppNav({
  user,
}: {
  user: {
    id: string
    name: string
    email: string
    image: string | null
    username: string | null
    role: "ADMIN" | "MODERATOR" | "MEMBER"
  }
}) {
  const pathname = usePathname()
  const router = useRouter()

  // Poll pending friend requests for the badge; realtime events also revalidate this.
  const { data } = useSWR<{ count: number }>("/api/invites/pending-count", fetcher, {
    refreshInterval: 15000,
  })
  const pendingInvites = data?.count ?? 0

  async function signOut() {
    await authClient.signOut()
    router.push("/")
    router.refresh()
  }

  const profileHref = user.username ? `/app/u/${user.username}` : "/app/settings"

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/app/feed" className="flex items-center gap-2">
          <Orbit className="size-6 text-primary" aria-hidden />
          <span className="hidden text-lg font-semibold tracking-tight sm:inline">Orbit</span>
        </Link>

        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href)
            const Icon = link.icon
            const showBadge = link.href === "/app/friends" && pendingInvites > 0
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
                <span className="hidden md:inline">{link.label}</span>
                {showBadge && (
                  <Badge className="ml-0.5 h-5 min-w-5 justify-center px-1 tabular-nums" variant="default">
                    {pendingInvites}
                  </Badge>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-1">
        <NotificationBell userId={user.id} />
        <DropdownMenu>
          <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost" }), "h-10 gap-2 px-2")}>
            <UserAvatar name={user.name} image={user.image} className="size-8 text-xs" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="flex flex-col">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.username ? `@${user.username}` : user.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href={profileHref} />}>
              <User className="size-4" aria-hidden />
              My profile
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href="/app/settings" />}>
              <Settings className="size-4" aria-hidden />
              Edit profile
            </DropdownMenuItem>
            {user.role === "ADMIN" && (
              <DropdownMenuItem render={<Link href="/app/admin" />}>
                <Shield className="size-4" aria-hidden />
                Admin
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-destructive focus:text-destructive">
              <LogOut className="size-4" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
