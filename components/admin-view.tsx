'use client';

import {
  banUser,
  deleteUser,
  getBanHistory,
  liftIpBan,
  listUsersForAdmin,
  setUserRole,
  unbanUser,
  type AdminUserRow,
  type BanHistoryEntry,
} from '@/app/actions/admin';
import { LocalTime } from '@/components/local-time';
import { Badge, badgeVariants } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user-avatar';
import { ROLES, ROLE_LABEL, type Role } from '@/lib/roles';
import { cn } from '@/lib/utils';
import { VariantProps } from 'class-variance-authority';
import {
  AlertCircleIcon,
  BanIcon,
  ClockIcon,
  GlobeIcon,
  HistoryIcon,
  Loader2,
  Loader2Icon,
  MoreHorizontalIcon,
  SearchIcon,
  ShieldCheckIcon,
  Trash2Icon,
  UnlockIcon,
  UserIcon,
} from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

const ROLE_BADGE: Record<
  Role,
  NonNullable<VariantProps<typeof badgeVariants>['variant']>
> = {
  ADMIN: 'default',
  MODERATOR: 'secondary',
  MEMBER: 'outline',
};

const DURATIONS: { key: string; label: string; days: number | null }[] = [
  { key: '1', label: '1 day', days: 1 },
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: 'perm', label: 'Permanent', days: null },
];

export function AdminView({
  initialUsers,
  viewerRole,
}: {
  initialUsers: AdminUserRow[];
  viewerRole: Role;
}) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dialog targets.
  const [banTarget, setBanTarget] = useState<AdminUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserRow | null>(null);
  const [historyTarget, setHistoryTarget] = useState<AdminUserRow | null>(null);

  const canManageRoles = viewerRole === 'ADMIN';
  const canDelete = viewerRole === 'ADMIN';

  // Whether the current viewer may ban/delete this target.
  function canModerate(u: AdminUserRow): boolean {
    if (u.isSelf) return false;
    if (u.role === 'ADMIN') return false;
    if (viewerRole !== 'ADMIN' && u.role !== 'MEMBER') return false;
    return true;
  }

  function onSearch(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);

    debounce.current = setTimeout(() => {
      startTransition(async () => {
        try {
          setUsers(await listUsersForAdmin(value));
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Search failed');
        }
      });
    }, 300);
  }

  async function changeRole(target: AdminUserRow, role: Role) {
    if (target.role === role) return;
    setSavingId(target.id);

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) => (u.id === target.id ? { ...u, role } : u)),
    );

    toast.promise(
      (async () => {
        try {
          const res = await setUserRole(target.id, role);
          if (res.self) window.location.reload();
        } catch (err) {
          // Rollback on error
          setUsers((prev) =>
            prev.map((u) =>
              u.id === target.id ? { ...u, role: target.role } : u,
            ),
          );
          throw err;
        }
      })(),
      {
        loading: `Updating ${target.name}'s role...`,
        success: `${target.name} is now ${ROLE_LABEL[role]}`,
        error: (err) =>
          err instanceof Error ? err.message : 'Could not change role',
        finally: () => setSavingId(null),
      },
    );
  }

  async function onUnban(target: AdminUserRow) {
    setSavingId(target.id);

    // Optimistic update
    setUsers((prev) =>
      prev.map((u) =>
        u.id === target.id ? { ...u, isBanned: false, banExpiresAt: null } : u,
      ),
    );

    toast.promise(
      (async () => {
        try {
          await unbanUser(target.id);
        } catch (err) {
          // Rollback on error
          setUsers((prev) =>
            prev.map((u) =>
              u.id === target.id ? { ...u, isBanned: true } : u,
            ),
          );
          throw err;
        }
      })(),
      {
        loading: `Lifting ban for ${target.name}...`,
        success: `${target.name}'s ban was lifted`,
        error: (err) =>
          err instanceof Error ? err.message : 'Could not lift ban',
        finally: () => setSavingId(null),
      },
    );
  }

  return (
    <div className='space-y-4'>
      <div className='relative'>
        <SearchIcon
          className='text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2'
          aria-hidden
        />
        <Input
          value={query}
          onChange={(e) => onSearch(e.target.value)}
          placeholder='Search by name, username, or email'
          className='pl-8'
          aria-label='Search users'
        />
        {pending && (
          <Loader2
            className='text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin'
            aria-hidden
          />
        )}
      </div>

      <ul className='divide-border border-border divide-y overflow-hidden rounded-xl border'>
        {users.length === 0 ? (
          <li className='text-muted-foreground px-4 py-10 text-center text-sm'>
            No users found.
          </li>
        ) : (
          users.map((u) => {
            const moderatable = canModerate(u);
            const showMenu = moderatable || canManageRoles;
            return (
              <li key={u.id} className='flex items-center gap-3 px-4 py-3'>
                <UserAvatar name={u.name} image={u.image} className='size-10' />
                <div className='min-w-0 flex-1 leading-tight'>
                  <p className='flex items-center gap-1.5 truncate font-medium'>
                    <span className='truncate'>{u.name}</span>
                    {u.isSelf ? (
                      <span className='text-muted-foreground text-xs'>
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className='text-muted-foreground truncate text-xs'>
                    {u.username ? `@${u.username}` : u.email}
                  </p>
                </div>

                {u.isBanned && (
                  <Badge variant='destructive'>
                    <BanIcon aria-hidden />
                    Banned
                  </Badge>
                )}
                <Badge variant={ROLE_BADGE[u.role]}>{ROLE_LABEL[u.role]}</Badge>

                {showMenu ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={savingId === u.id}
                      aria-label={`Manage ${u.name}`}
                      className={cn(
                        buttonVariants({ variant: 'outline', size: 'icon-sm' }),
                        'shrink-0',
                      )}
                    >
                      {savingId === u.id ? (
                        <Loader2Icon
                          className='size-4 animate-spin'
                          aria-hidden
                        />
                      ) : (
                        <MoreHorizontalIcon aria-hidden />
                      )}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      {moderatable && (
                        <DropdownMenuGroup>
                          {u.isBanned ? (
                            <DropdownMenuItem onClick={() => onUnban(u)}>
                              <ShieldCheckIcon aria-hidden />
                              Lift ban
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setBanTarget(u)}
                              variant='destructive'
                            >
                              <BanIcon aria-hidden />
                              Ban user
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setHistoryTarget(u)}>
                            <HistoryIcon aria-hidden />
                            Ban history
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      )}

                      {canManageRoles && (
                        <DropdownMenuRadioGroup
                          value={u.role}
                          onValueChange={(r) => changeRole(u, r)}
                        >
                          {moderatable && <DropdownMenuSeparator />}
                          <DropdownMenuLabel>Change role</DropdownMenuLabel>
                          {ROLES.map((r) => (
                            <DropdownMenuRadioItem value={r} key={r}>
                              {ROLE_LABEL[r]}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      )}

                      {canDelete && moderatable && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => setDeleteTarget(u)}
                            variant='destructive'
                          >
                            <Trash2Icon aria-hidden />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <span className='w-8 shrink-0' aria-hidden />
                )}
              </li>
            );
          })
        )}
      </ul>

      <BanDialog
        target={banTarget}
        onClose={() => setBanTarget(null)}
        onBanned={(id, banExpiresAt) =>
          setUsers((prev) =>
            prev.map((u) =>
              u.id === id ? { ...u, isBanned: true, banExpiresAt } : u,
            ),
          )
        }
      />
      <DeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(id) => setUsers((prev) => prev.filter((u) => u.id !== id))}
      />
      <HistoryDialog
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
function BanDialog({
  target,
  onClose,
  onBanned,
}: {
  target: AdminUserRow | null;
  onClose: () => void;
  onBanned: (id: string, banExpiresAt: string | null) => void;
}) {
  const [reason, setReason] = useState('');
  const [durationKey, setDurationKey] = useState('7');
  const [banIp, setBanIp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset local state whenever a new target opens the dialog.
  const open = target !== null;
  const targetId = target?.id ?? null;

  useEffect(() => {
    if (!targetId) return;
    setReason('');
    setDurationKey('7');
    setBanIp(false);
    setSubmitting(false);
  }, [targetId]);

  async function submit() {
    if (!target) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      toast.error('A ban reason is required');
      return;
    }

    const duration = DURATIONS.find((d) => d.key === durationKey)!;
    setSubmitting(true);

    toast.promise(
      (async () => {
        const res = await banUser(target.id, {
          reason: trimmed,
          durationDays: duration.days,
          banIp,
        });

        const banExpiresAt =
          duration.days != null
            ? new Date(Date.now() + duration.days * 86400000).toISOString()
            : null;

        onBanned(target.id, banExpiresAt);
        onClose();

        return res.ipBanned;
      })(),
      {
        loading: `Banning ${target.name}...`,
        success: (ipBanned) =>
          ipBanned
            ? `${target.name} and their IP were banned`
            : `${target.name} was banned`,
        error: (err) =>
          err instanceof Error ? err.message : 'Could not ban user',
        finally: () => setSubmitting(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {target?.name}</DialogTitle>
          <DialogDescription>
            They will immediately lose access and be signed out. This action is
            recorded in their ban history.
          </DialogDescription>
        </DialogHeader>

        <div className='min-w-0 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='ban-reason'>Reason</Label>
            <Textarea
              id='ban-reason'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='Explain why this account is being banned'
              className='resize-y wrap-break-word'
              rows={2}
            />
          </div>

          <div className='space-y-2'>
            <Label>Duration</Label>
            <div className='flex flex-wrap gap-2'>
              {DURATIONS.map((d) => (
                <Button
                  key={d.key}
                  type='button'
                  onClick={() => setDurationKey(d.key)}
                  variant={durationKey === d.key ? 'default' : 'outline'}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='ban-ip' className='block'>
              Also ban their IP address
            </Label>
            <div className='border-border xs:flex-row xs:items-center flex flex-col justify-between gap-4 rounded-lg border p-3'>
              <div className='min-w-0'>
                <p className='text-muted-foreground xs:whitespace-pre-wrap text-xs text-pretty'>
                  Blocks the last known IP from this account.{'\n'}IPs can be
                  shared, so this may affect other users.
                </p>
              </div>
              <Switch id='ban-ip' checked={banIp} onCheckedChange={setBanIp} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant='destructive' onClick={submit} disabled={submitting}>
            {submitting ? (
              <Loader2Icon className='animate-spin' aria-hidden />
            ) : (
              <BanIcon aria-hidden />
            )}
            Ban User
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({
  target,
  onClose,
  onDeleted,
}: {
  target: AdminUserRow | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const open = target !== null;

  async function confirm() {
    if (!target) return;
    setSubmitting(true);

    toast.promise(
      (async () => {
        await deleteUser(target.id);
        onDeleted(target.id);
        onClose();
      })(),
      {
        loading: `Deleting ${target.name}...`,
        success: `${target.name}'s account was deleted`,
        error: (err) =>
          err instanceof Error ? err.message : 'Could not delete account',
        finally: () => setSubmitting(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {target?.name}?</DialogTitle>
          <DialogDescription>
            This permanently removes the account and all of their posts, likes,
            messages, and other data. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant='destructive' onClick={confirm} disabled={submitting}>
            {submitting ? (
              <Loader2Icon className='animate-spin' aria-hidden />
            ) : (
              <Trash2Icon aria-hidden />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  target,
  onClose,
}: {
  target: AdminUserRow | null;
  onClose: () => void;
}) {
  const [entries, setEntries] = useState<BanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [liftingId, setLiftingId] = useState<string | null>(null);
  // Search and sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<
    'newest' | 'oldest' | 'issuer' | 'lifter'
  >('newest');
  // State for the lift reason popup dialog
  const [liftTarget, setLiftTarget] = useState<BanHistoryEntry | null>(null);
  const [liftReason, setLiftReason] = useState('');
  const [submittingLift, setSubmittingLift] = useState(false);
  // States to track scroll overflow
  const [isScrollable, setIsScrollable] = useState(false);
  const [isScrolledTop, setIsScrolledTop] = useState(true);
  const [isScrolledBottom, setIsScrolledBottom] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  const open = target !== null;
  const targetId = target?.id ?? null;

  const checkScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollable = el.scrollHeight > el.clientHeight;
    setIsScrollable(scrollable);
    setIsScrolledTop(el.scrollTop <= 10);
    setIsScrolledBottom(el.scrollHeight - el.scrollTop - el.clientHeight <= 10);
  };

  useEffect(() => {
    if (!targetId) return;
    setSearchQuery('');
    setSortBy('newest');
    let cancelled = false;
    setLoading(true);
    setEntries([]);
    getBanHistory(targetId)
      .then((rows) => {
        if (!cancelled) setEntries(rows);
      })
      .catch((err) => {
        if (!cancelled)
          toast.error(
            err instanceof Error ? err.message : 'Could not load history',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [targetId]);

  useEffect(() => {
    checkScroll();
  }, [entries, loading]);

  async function handleLiftSubmit() {
    if (!liftTarget) return;
    const entry = liftTarget;
    const reasonTrimmed = liftReason.trim();

    setLiftingId(entry.id);
    setSubmittingLift(true);
    const previousEntries = [...entries];

    // Optimistic update
    setEntries((prev) =>
      prev.map((e) => {
        if (entry.scope === 'ACCOUNT' && e.active) {
          return {
            ...e,
            active: false,
            liftedAt: new Date().toISOString(),
            liftReason: reasonTrimmed,
          };
        }
        if (entry.scope === 'IP' && e.id === entry.id) {
          return {
            ...e,
            active: false,
            liftedAt: new Date().toISOString(),
            liftReason: reasonTrimmed,
          };
        }
        return e;
      }),
    );

    // Close the lift dialog immediately
    setLiftTarget(null);
    setLiftReason('');

    toast.promise(
      (async () => {
        try {
          if (entry.scope === 'IP') {
            await liftIpBan(entry.id, reasonTrimmed);
          } else {
            await unbanUser(targetId!, reasonTrimmed);
          }
        } catch (err) {
          setEntries(previousEntries);
          throw err;
        }
      })(),
      {
        loading: 'Lifting ban...',
        success: 'Ban lifted',
        error: (err) =>
          err instanceof Error ? err.message : 'Could not lift ban',
        finally: () => {
          setLiftingId(null);
          setSubmittingLift(false);
        },
      },
    );
  }

  const filteredEntries = entries.filter((e) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const expiresText = e.expiresAt
      ? new Date(e.expiresAt)
          .toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
          .toLowerCase()
      : 'permanent';

    return (
      e.reason.toLowerCase().includes(query) ||
      (e.ipAddress && e.ipAddress.toLowerCase().includes(query)) ||
      (e.bannedByName && e.bannedByName.toLowerCase().includes(query)) ||
      (e.liftedByName && e.liftedByName.toLowerCase().includes(query)) ||
      e.scope.toLowerCase().includes(query) ||
      (e.liftReason && e.liftReason.toLowerCase().includes(query)) ||
      expiresText.includes(query) ||
      (e.liftedAt &&
        new Date(e.liftedAt)
          .toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })
          .toLowerCase()
          .includes(query)) ||
      new Date(e.createdAt)
        .toLocaleString(undefined, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
        .toLowerCase()
        .includes(query)
    );
  });

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === 'issuer') {
      const nameA = (a.bannedByName || '').toLowerCase();
      const nameB = (b.bannedByName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }
    if (sortBy === 'lifter') {
      const nameA = (a.liftedByName || '').toLowerCase();
      const nameB = (b.liftedByName || '').toLowerCase();
      return nameA.localeCompare(nameB);
    }
    return 0;
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
        <DialogContent className='min-w-0 sm:max-w-xl'>
          <DialogHeader>
            <DialogTitle>{target?.name}'s Ban History</DialogTitle>
            <DialogDescription>
              Every ban issued against this account, newest first.
            </DialogDescription>
          </DialogHeader>

          <div className='flex items-center gap-2'>
            <Input
              placeholder='Search reason, IP, issuer...'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <Select
              value={sortBy}
              onValueChange={(v) =>
                setSortBy(v as 'newest' | 'oldest' | 'issuer' | 'lifter')
              }
            >
              <SelectTrigger>
                <SelectValue placeholder='Sort by' />
              </SelectTrigger>
              <SelectContent
                position='popper'
                align='center'
                side='bottom'
              >
                <SelectItem value='newest'>Newest first</SelectItem>
                <SelectItem value='oldest'>Oldest first</SelectItem>
                <SelectItem value='issuer'>Sort by Issuer</SelectItem>
                <SelectItem value='lifter'>Sort by Lifter</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='relative min-w-0'>
            <div
              className='custom-scrollbar scroll-fade-top-bottom max-h-[60vh] min-w-0 space-y-6 overflow-y-auto p-1'
              ref={scrollRef}
              onScroll={checkScroll}
            >
              {loading ? (
                <div className='flex justify-center py-8'>
                  <Loader2Icon
                    className='text-muted-foreground size-5 animate-spin'
                    aria-hidden
                  />
                </div>
              ) : sortedEntries.length === 0 ? (
                <p className='text-muted-foreground py-8 text-center text-sm'>
                  {searchQuery
                    ? 'No matching ban history entries found.'
                    : 'No ban history entries found.'}
                </p>
              ) : (
                sortedEntries.map((e) => (
                  <div key={e.id} className='min-w-0 space-y-3'>
                    {/* Badges & Actions Header */}
                    <div className='flex items-center justify-between gap-2 px-1'>
                      <div className='flex items-center gap-2'>
                        <Badge variant='secondary'>
                          {e.scope === 'IP' ? 'IP' : 'Account'}
                        </Badge>
                        <Badge variant={e.active ? 'destructive' : 'secondary'}>
                          {e.active ? 'Active' : 'Lifted'}
                        </Badge>
                      </div>
                      {e.active && (
                        <Button
                          size='xs'
                          variant='outline'
                          onClick={() => {
                            setLiftTarget(e);
                            setLiftReason('');
                          }}
                          disabled={liftingId === e.id}
                        >
                          {liftingId === e.id ? (
                            <Loader2Icon className='animate-spin' aria-hidden />
                          ) : null}
                          Unban
                        </Button>
                      )}
                    </div>

                    {/* Segmented Data Box */}
                    <div className='border-border divide-border min-w-0 divide-y overflow-hidden rounded-lg border'>
                      {/* Reason */}
                      <div className='flex min-w-0 items-start gap-3 p-3'>
                        <AlertCircleIcon
                          className='text-muted-foreground size-4 shrink-0'
                          aria-hidden
                        />
                        <div className='min-w-0 flex-1'>
                          <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                            Reason
                          </div>
                          <div className='text-sm wrap-break-word whitespace-pre-wrap'>
                            {e.reason}
                          </div>
                        </div>
                      </div>

                      {/* IP Address */}
                      {e.ipAddress && (
                        <div className='flex min-w-0 items-start gap-3 p-3'>
                          <GlobeIcon
                            className='text-muted-foreground size-4 shrink-0'
                            aria-hidden
                          />
                          <div className='min-w-0 flex-1'>
                            <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                              IP Address
                            </div>
                            <div className='font-mono text-xs break-all'>
                              {e.ipAddress}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Duration */}
                      <div className='flex min-w-0 items-start gap-3 p-3'>
                        <ClockIcon
                          className='text-muted-foreground size-4 shrink-0'
                          aria-hidden
                        />
                        <div className='min-w-0 flex-1'>
                          <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                            Duration
                          </div>
                          <div className='text-sm'>
                            {e.expiresAt ? (
                              <>
                                Expires <LocalTime iso={e.expiresAt} />
                              </>
                            ) : (
                              'Permanent'
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Issued */}
                      <div className='flex min-w-0 items-start gap-3 p-3'>
                        <UserIcon
                          className='text-muted-foreground size-4 shrink-0'
                          aria-hidden
                        />
                        <div className='min-w-0 flex-1'>
                          <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                            Issued
                          </div>
                          <div className='flex min-w-0 flex-col gap-1 text-sm'>
                            <LocalTime iso={e.createdAt} />
                            {e.bannedByName && (
                              <div className='flex min-w-0 items-center gap-2'>
                                {e.bannedByAvatar && (
                                  <UserAvatar
                                    name={e.bannedByName}
                                    image={e.bannedByAvatar}
                                    className='size-6 shrink-0'
                                  />
                                )}
                                <span className='truncate font-medium'>
                                  {e.bannedByName}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Lifted */}
                      {e.liftedAt && (
                        <div className='bg-muted/30 flex min-w-0 items-start gap-3 p-3'>
                          <UnlockIcon
                            className='text-muted-foreground size-4 shrink-0'
                            aria-hidden
                          />
                          <div className='min-w-0 flex-1'>
                            <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                              Lifted
                            </div>
                            <div className='flex min-w-0 flex-col gap-1 text-sm'>
                              <LocalTime iso={e.liftedAt} />
                              {e.liftedByName && (
                                <div className='flex min-w-0 items-center gap-2'>
                                  {e.liftedByAvatar && (
                                    <UserAvatar
                                      name={e.liftedByName}
                                      image={e.liftedByAvatar}
                                      className='size-6 shrink-0'
                                    />
                                  )}
                                  <span className='truncate font-medium'>
                                    {e.liftedByName}
                                  </span>
                                </div>
                              )}
                              {e.liftReason && (
                                <span className='text-muted-foreground wrap-break-word whitespace-pre-wrap'>
                                  Reason: {e.liftReason}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div
              className={`from-card pointer-events-none absolute inset-x-0 top-0 h-4 bg-linear-to-b to-transparent transition-opacity duration-200 ${
                isScrollable && !isScrolledTop ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden
            />

            <div
              className={`from-card pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-linear-to-t to-transparent transition-opacity duration-200 ${
                isScrollable && !isScrolledBottom ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden
            />
          </div>

          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>

      {/* Secondary Dialog for entering Lift Reason */}
      <Dialog
        open={liftTarget !== null}
        onOpenChange={(o) => (!o ? setLiftTarget(null) : undefined)}
      >
        <DialogContent className='min-w-0 sm:max-w-md'>
          <DialogHeader>
            <DialogTitle>Lift Ban</DialogTitle>
            <DialogDescription>
              Provide an optional reason for lifting this{' '}
              {liftTarget?.scope.toLowerCase()} ban.
            </DialogDescription>
          </DialogHeader>

          <div className='min-w-0 space-y-4'>
            <div className='min-w-0 space-y-2'>
              <Label htmlFor='lift-reason'>Reason</Label>
              <Textarea
                id='lift-reason'
                value={liftReason}
                onChange={(e) => setLiftReason(e.target.value)}
                placeholder='e.g., Appealed via support ticket, misunderstanding resolved'
                className='resize-y wrap-break-word'
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant='outline'
              onClick={() => setLiftTarget(null)}
              disabled={submittingLift}
            >
              Cancel
            </Button>
            <Button onClick={handleLiftSubmit} disabled={submittingLift}>
              {submittingLift ? (
                <Loader2Icon className='size-4 animate-spin' aria-hidden />
              ) : null}
              Confirm Lift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
