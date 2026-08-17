"use client"

import { useState, useRef, useTransition } from "react"
import { UserAvatar } from "@/components/user-avatar"
import { LocalTime } from "@/components/local-time"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  MoreHorizontal,
  Check,
  Search,
  Loader2,
  Ban,
  ShieldCheck,
  History,
  Trash2,
  UserCog,
} from "lucide-react"
import { toast } from "sonner"
import {
  listUsersForAdmin,
  setUserRole,
  banUser,
  unbanUser,
  deleteUser,
  liftIpBan,
  getBanHistory,
  type AdminUserRow,
  type BanHistoryEntry,
} from "@/app/actions/admin"
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles"

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-primary/15 text-primary",
  MODERATOR: "bg-chart-2/15 text-chart-2",
  MEMBER: "bg-muted text-muted-foreground",
}

const DURATIONS: { key: string; label: string; days: number | null }[] = [
  { key: "1", label: "1 day", days: 1 },
  { key: "7", label: "7 days", days: 7 },
  { key: "30", label: "30 days", days: 30 },
  { key: "perm", label: "Permanent", days: null },
]

export function AdminView({
  initialUsers,
  viewerRole,
}: {
  initialUsers: AdminUserRow[]
  viewerRole: Role
}) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers)
  const [query, setQuery] = useState("")
  const [pending, startTransition] = useTransition()
  const [savingId, setSavingId] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Dialog targets.
  const [banTarget, setBanTarget] = useState<AdminUserRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null)
  const [historyTarget, setHistoryTarget] = useState<AdminUserRow | null>(null)

  const canManageRoles = viewerRole === "ADMIN"
  const canDelete = viewerRole === "ADMIN"

  // Whether the current viewer may ban/delete this target.
  function canModerate(u: AdminUserRow): boolean {
    if (u.isSelf) return false
    if (u.role === "ADMIN") return false
    if (viewerRole !== "ADMIN" && u.role !== "MEMBER") return false
    return true
  }

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
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role } : u)))
    try {
      const res = await setUserRole(target.id, role)
      toast.success(`${target.name} is now ${ROLE_LABEL[role]}`)
      if (res.self) window.location.reload()
    } catch (err) {
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, role: target.role } : u)))
      toast.error(err instanceof Error ? err.message : "Could not change role")
    } finally {
      setSavingId(null)
    }
  }

  async function onUnban(target: AdminUserRow) {
    setSavingId(target.id)
    setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, isBanned: false, banExpiresAt: null } : u)))
    try {
      await unbanUser(target.id)
      toast.success(`${target.name}'s ban was lifted`)
    } catch (err) {
      setUsers((prev) => prev.map((u) => (u.id === target.id ? { ...u, isBanned: true } : u)))
      toast.error(err instanceof Error ? err.message : "Could not lift ban")
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
          users.map((u) => {
            const moderatable = canModerate(u)
            const showMenu = moderatable || canManageRoles
            return (
              <li key={u.id} className="flex items-center gap-3 px-4 py-3">
                <UserAvatar name={u.name} image={u.image} className="size-10" />
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="flex items-center gap-1.5 truncate font-medium">
                    <span className="truncate">{u.name}</span>
                    {u.isSelf ? <span className="text-xs text-muted-foreground">(you)</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.username ? `@${u.username}` : u.email}
                  </p>
                </div>

                {u.isBanned && (
                  <Badge className="shrink-0 gap-1 border-transparent bg-destructive/15 text-destructive">
                    <Ban className="size-3" aria-hidden />
                    Banned
                  </Badge>
                )}
                <Badge className={cn("shrink-0 border-transparent", ROLE_BADGE[u.role])}>
                  {ROLE_LABEL[u.role]}
                </Badge>

                {showMenu ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={savingId === u.id}
                      aria-label={`Manage ${u.name}`}
                      className={cn(buttonVariants({ variant: "outline", size: "icon-sm" }), "shrink-0")}
                    >
                      {savingId === u.id ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <MoreHorizontal className="size-4" aria-hidden />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {moderatable && (
                        <DropdownMenuGroup>
                          {u.isBanned ? (
                            <DropdownMenuItem onClick={() => onUnban(u)} className="gap-2">
                              <ShieldCheck className="size-4" aria-hidden />
                              Lift ban
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setBanTarget(u)}
                              className="gap-2 text-destructive focus:text-destructive"
                            >
                              <Ban className="size-4" aria-hidden />
                              Ban user
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setHistoryTarget(u)} className="gap-2">
                            <History className="size-4" aria-hidden />
                            Ban history
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      )}

                      {canManageRoles && (
                        <>
                          {moderatable && <DropdownMenuSeparator />}
                          <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
                            <UserCog className="size-3.5" aria-hidden />
                            Change role
                          </DropdownMenuLabel>
                          {ROLES.map((r) => (
                            <DropdownMenuItem key={r} onClick={() => changeRole(u, r)} className="gap-2">
                              <Check className={cn("size-4", u.role === r ? "opacity-100" : "opacity-0")} aria-hidden />
                              {ROLE_LABEL[r]}
                            </DropdownMenuItem>
                          ))}
                        </>
                      )}

                      {canDelete && moderatable && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(u)}
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="size-4" aria-hidden />
                            Delete account
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className="w-8 shrink-0" aria-hidden />
                )}
              </li>
            )
          })
        )}
      </ul>

      <BanDialog
        target={banTarget}
        onClose={() => setBanTarget(null)}
        onBanned={(id, banExpiresAt) =>
          setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, isBanned: true, banExpiresAt } : u)))
        }
      />
      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => setUsers((prev) => prev.filter((u) => u.id !== id))}
      />
      <HistoryDialog target={historyTarget} onClose={() => setHistoryTarget(null)} />
    </div>
  )
}

function BanDialog({
  target,
  onClose,
  onBanned,
}: {
  target: AdminUserRow | null
  onClose: () => void
  onBanned: (id: string, banExpiresAt: string | null) => void
}) {
  const [reason, setReason] = useState("")
  const [durationKey, setDurationKey] = useState("7")
  const [banIp, setBanIp] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Reset local state whenever a new target opens the dialog.
  const open = target !== null
  const openedFor = useRef<string | null>(null)
  if (open && openedFor.current !== target!.id) {
    openedFor.current = target!.id
    setReason("")
    setDurationKey("7")
    setBanIp(false)
    setSubmitting(false)
  }

  async function submit() {
    if (!target) return
    const trimmed = reason.trim()
    if (!trimmed) {
      toast.error("A ban reason is required")
      return
    }
    const duration = DURATIONS.find((d) => d.key === durationKey)!
    setSubmitting(true)
    try {
      const res = await banUser(target.id, { reason: trimmed, durationDays: duration.days, banIp })
      const banExpiresAt = duration.days != null ? new Date(Date.now() + duration.days * 86400000).toISOString() : null
      onBanned(target.id, banExpiresAt)
      toast.success(
        res.ipBanned ? `${target.name} and their IP were banned` : `${target.name} was banned`,
      )
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not ban user")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {target?.name}</DialogTitle>
          <DialogDescription>
            They will immediately lose access and be signed out. This action is recorded in their ban history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ban-reason">Reason</Label>
            <Textarea
              id="ban-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why this account is being banned"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDurationKey(d.key)}
                  className={cn(
                    buttonVariants({ variant: durationKey === d.key ? "default" : "outline", size: "sm" }),
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start justify-between gap-3 rounded-lg border border-border p-3">
            <div className="min-w-0">
              <Label htmlFor="ban-ip" className="block">
                Also ban their IP address
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground text-pretty">
                Blocks the last known IP from this account. IPs can be shared, so this may affect other users.
              </p>
            </div>
            <Switch id="ban-ip" checked={banIp} onCheckedChange={setBanIp} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Ban className="size-4" aria-hidden />}
            Ban user
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DeleteDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: AdminUserRow | null
  onClose: () => void
  onDeleted: (id: string) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const open = target !== null

  async function confirm() {
    if (!target) return
    setSubmitting(true)
    try {
      await deleteUser(target.id)
      onDeleted(target.id)
      toast.success(`${target.name}'s account was deleted`)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete account")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {target?.name}?</DialogTitle>
          <DialogDescription>
            This permanently removes the account and all of their posts, likes, messages, and other data. This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />}
            Delete permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function HistoryDialog({ target, onClose }: { target: AdminUserRow | null; onClose: () => void }) {
  const [entries, setEntries] = useState<BanHistoryEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [liftingId, setLiftingId] = useState<string | null>(null)
  const open = target !== null
  const loadedFor = useRef<string | null>(null)

  // Fetch history when a new target opens the dialog (on-demand, not on mount).
  if (open && loadedFor.current !== target!.id) {
    loadedFor.current = target!.id
    setLoading(true)
    setEntries([])
    getBanHistory(target!.id)
      .then(setEntries)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Could not load history"))
      .finally(() => setLoading(false))
  }
  if (!open && loadedFor.current !== null) loadedFor.current = null

  async function lift(id: string) {
    setLiftingId(id)
    try {
      await liftIpBan(id)
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, active: false, liftedAt: new Date().toISOString() } : e)))
      toast.success("IP ban lifted")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not lift IP ban")
    } finally {
      setLiftingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ban history — {target?.name}</DialogTitle>
          <DialogDescription>Every ban issued against this account, newest first.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" aria-hidden />
            </div>
          ) : entries.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No bans on record.</p>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="border-transparent bg-muted text-muted-foreground">
                      {e.scope === "IP" ? "IP" : "Account"}
                    </Badge>
                    <Badge
                      className={cn(
                        "border-transparent",
                        e.active ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {e.active ? "Active" : "Lifted"}
                    </Badge>
                  </div>
                  {e.scope === "IP" && e.active && (
                    <Button size="sm" variant="outline" onClick={() => lift(e.id)} disabled={liftingId === e.id}>
                      {liftingId === e.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
                      Lift
                    </Button>
                  )}
                </div>

                <p className="mt-2 text-sm text-pretty">{e.reason}</p>
                {e.ipAddress && (
                  <p className="mt-1 font-mono text-xs text-muted-foreground">IP: {e.ipAddress}</p>
                )}

                <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    Issued <LocalTime iso={e.createdAt} />
                    {e.bannedByName ? ` by ${e.bannedByName}` : ""}
                  </div>
                  <div>{e.expiresAt ? <>Expires <LocalTime iso={e.expiresAt} /></> : "Permanent"}</div>
                  {e.liftedAt && (
                    <div>
                      Lifted <LocalTime iso={e.liftedAt} />
                      {e.liftReason ? ` — ${e.liftReason}` : ""}
                    </div>
                  )}
                </dl>
              </div>
            ))
          )}
        </div>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
