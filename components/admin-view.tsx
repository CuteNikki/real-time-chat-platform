"use client"

import { useState, useRef, useTransition } from "react"
import { UserAvatar } from "@/components/user-avatar"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ChevronDown, Check, Search, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { listUsersForAdmin, setUserRole, type AdminUserRow } from "@/app/actions/admin"
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles"

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-primary/15 text-primary",
  MODERATOR: "bg-chart-2/15 text-chart-2",
  MEMBER: "bg-muted text-muted-foreground",
}

export function AdminView({ initialUsers }: { initialUsers: AdminUserRow[] }) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers)
  const [query, setQuery] = useState("")
  const [pending, startTransition] = useTransition()
  const [savingId, setSavingId] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  function onSearch(value: string) {
    setQuery(value)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(() => {
      startTransition(async () => {
        try {
          setUsers(await listUsersForAdmin(value))
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Search failed")
        }
      })
    }, 300)
  }

  async function changeRole(target: AdminUserRow, role: Role) {
    if (target.role === role) return
    setSavingId(target.id)
    // Optimistic update.
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role } : u)))
    try {
      const res = await setUserRole(target.id, role)
      toast.success(`${target.name} is now ${ROLE_LABEL[role]}`)
      if (res.self) {
        // Our own role changed; refresh so nav/permissions update.
        window.location.reload()
      }
    } catch (err) {
      // Roll back on failure.
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: target.role } : u)))
      toast.error(err instanceof Error ? err.message : "Could not change role")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by name, username, or email"
          className="pl-9"
          aria-label="Search users"
        />
        {pending && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />
        )}
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {users.length === 0 ? (
          <li className="px-4 py-10 text-center text-sm text-muted-foreground">No users found.</li>
        ) : (
          users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <UserAvatar name={u.name} image={u.image} className="size-10" />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate font-medium">
                  {u.name}
                  {u.isSelf ? <span className="ml-1.5 text-xs text-muted-foreground">(you)</span> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.username ? `@${u.username}` : u.email}
                </p>
              </div>
              <Badge className={cn("shrink-0 border-transparent", ROLE_BADGE[u.role])}>
                {ROLE_LABEL[u.role]}
              </Badge>
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={savingId === u.id}
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 gap-1")}
                >
                  {savingId === u.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <>
                      Change
                      <ChevronDown className="size-3.5" aria-hidden />
                    </>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {ROLES.map((r) => (
                    <DropdownMenuItem key={r} onClick={() => changeRole(u, r)} className="gap-2">
                      <Check className={cn("size-4", u.role === r ? "opacity-100" : "opacity-0")} aria-hidden />
                      {ROLE_LABEL[r]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))
        )}
      </ul>
    </div>
  )
}
