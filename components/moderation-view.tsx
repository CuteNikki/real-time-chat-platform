'use client';

import { VariantProps } from 'class-variance-authority';
import type { TFunction } from 'i18next';
import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  AlertCircleIcon,
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  EraserIcon,
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

import {
  banUser,
  deleteBanHistoryEntry,
  deleteUser,
  getBanHistory,
  liftIpBan,
  listUsersForModeration,
  resetUserProfile,
  setUserRole,
  unbanUser,
  type BanHistoryEntry,
  type ModerationUserRow,
  type ResetProfileFields,
} from '@/app/actions/moderation';

import { ROLES, type Role } from '@/lib/roles';
import { cn } from '@/lib/utils';

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
import { UserAvatar } from '@/components/user/user-avatar';

const ROLE_BADGE: Record<
  Role,
  NonNullable<VariantProps<typeof badgeVariants>['variant']>
> = {
  ADMIN: 'default',
  MODERATOR: 'secondary',
  MEMBER: 'outline',
};

const DURATIONS: { key: string; labelKey: string; days: number | null }[] = [
  { key: '1', labelKey: 'moderation.durations.d1', days: 1 },
  { key: '7', labelKey: 'moderation.durations.d7', days: 7 },
  { key: '30', labelKey: 'moderation.durations.d30', days: 30 },
  { key: 'perm', labelKey: 'moderation.durations.perm', days: null },
];

// Localized role label helper (replaces the static ROLE_LABEL map at render).
function roleLabel(t: TFunction, role: Role): string {
  return t(`moderation.roles.${role}`);
}

export function ModerationView({
  initialUsers,
  initialTotal,
  pageSize,
  viewerRole,
}: {
  initialUsers: ModerationUserRow[];
  initialTotal: number;
  pageSize: number;
  viewerRole: Role;
}) {
  const [users, setUsers] = useState<ModerationUserRow[]>(initialUsers);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [pending, startTransition] = useTransition();
  const [savingId, setSavingId] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { t } = useTranslation();

  // Dialog targets.
  const [banTarget, setBanTarget] = useState<ModerationUserRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ModerationUserRow | null>(
    null,
  );
  const [historyTarget, setHistoryTarget] = useState<ModerationUserRow | null>(
    null,
  );
  const [resetTarget, setResetTarget] = useState<ModerationUserRow | null>(
    null,
  );

  const canManageRoles = viewerRole === 'ADMIN';
  const canDelete = viewerRole === 'ADMIN';

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  // Whether the current viewer may ban/delete this target.
  function canModerate(u: ModerationUserRow): boolean {
    if (u.isSelf) return false;
    if (u.role === 'ADMIN') return false;
    // If the viewer is a moderator, they can only moderate members
    if (viewerRole === 'MODERATOR' && u.role !== 'MEMBER') return false;
    return true;
  }

  // Load a given page for the current query, replacing the visible rows.
  function fetchPage(nextQuery: string, nextPage: number) {
    startTransition(async () => {
      try {
        const res = await listUsersForModeration(nextQuery, nextPage);
        setUsers(res.users);
        setTotal(res.total);
        setPage(res.page);
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t('moderation.couldNotLoadUsers'),
        );
      }
    });
  }

  function onSearch(value: string) {
    setQuery(value);
    if (debounce.current) clearTimeout(debounce.current);

    // A new search always restarts at the first page.
    debounce.current = setTimeout(() => fetchPage(value, 1), 300);
  }

  // Drop a deleted user from the current page and keep the total honest. If the
  // page is now empty (and isn't the first), step back so we never sit on a
  // blank page.
  function handleDeleted(id: string) {
    const next = users.filter((u) => u.id !== id);
    setUsers(next);
    setTotal((t) => Math.max(0, t - 1));
    if (next.length === 0 && page > 1) fetchPage(query, page - 1);
  }

  // Reflect a profile reset in the visible row (name/username may have changed
  // to placeholders; avatar may have been cleared).
  function handleReset(
    id: string,
    changes: {
      name: string | null;
      username: string | null;
      clearedImage: boolean;
    },
  ) {
    setUsers((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              name: changes.name ?? u.name,
              username: changes.username ?? u.username,
              image: changes.clearedImage ? null : u.image,
            }
          : u,
      ),
    );
  }

  async function changeRole(target: ModerationUserRow, role: Role) {
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
        loading: t('moderation.updatingRole', { name: target.name }),
        success: t('moderation.roleUpdated', {
          name: target.name,
          role: roleLabel(t, role),
        }),
        error: (err) =>
          err instanceof Error
            ? err.message
            : t('moderation.couldNotChangeRole'),
        finally: () => setSavingId(null),
      },
    );
  }

  async function onUnban(target: ModerationUserRow) {
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
        loading: t('moderation.liftingBan', { name: target.name }),
        success: t('moderation.banLifted', { name: target.name }),
        error: (err) =>
          err instanceof Error ? err.message : t('moderation.couldNotLiftBan'),
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
          placeholder={t('moderation.searchUsersPlaceholder')}
          className='pl-8'
          aria-label={t('moderation.searchUsersAria')}
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
            {t('moderation.noUsers')}
          </li>
        ) : (
          users.map((u) => {
            const moderatable = canModerate(u);
            const showMenu = moderatable || canManageRoles;
            return (
              <li key={u.id} className='flex items-center gap-3 px-4 py-3'>
                {u.username ? (
                  <Link
                    href={`/app/u/${u.username}`}
                    className='group flex min-w-0 flex-1 items-center gap-3 rounded-md'
                  >
                    <UserAvatar
                      name={u.name}
                      image={u.image}
                      className='size-10 shrink-0'
                    />
                    <div className='min-w-0 flex-1 leading-tight'>
                      <p className='flex items-center gap-1.5 truncate font-medium'>
                        <span className='truncate group-hover:underline'>
                          {u.name}
                        </span>
                        {u.isSelf ? (
                          <span className='text-muted-foreground text-xs'>
                            {t('moderation.you')}
                          </span>
                        ) : null}
                      </p>
                      <p className='text-muted-foreground truncate text-xs'>
                        @{u.username}
                      </p>
                    </div>
                  </Link>
                ) : (
                  <div className='flex min-w-0 flex-1 items-center gap-3'>
                    <UserAvatar
                      name={u.name}
                      image={u.image}
                      className='size-10 shrink-0'
                    />
                    <div className='min-w-0 flex-1 leading-tight'>
                      <p className='flex items-center gap-1.5 truncate font-medium'>
                        <span className='truncate'>{u.name}</span>
                        {u.isSelf ? (
                          <span className='text-muted-foreground text-xs'>
                            {t('moderation.you')}
                          </span>
                        ) : null}
                      </p>
                      <p className='text-muted-foreground truncate text-xs'>
                        {u.email}
                      </p>
                    </div>
                  </div>
                )}

                {/* Right-side metadata & actions container */}
                <div className='xs:flex-row flex shrink-0 flex-col items-center gap-2'>
                  {u.isBanned && (
                    <Badge variant='destructive'>
                      <BanIcon aria-hidden />
                      {t('moderation.banned')}
                    </Badge>
                  )}
                  <Badge variant={ROLE_BADGE[u.role]}>
                    {roleLabel(t, u.role)}
                  </Badge>
                </div>

                {showMenu ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      disabled={savingId === u.id}
                      aria-label={t('moderation.manageUser', { name: u.name })}
                      className={cn(
                        buttonVariants({
                          variant: 'outline',
                          size: 'icon-sm',
                        }),
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
                              {t('moderation.liftBanItem')}
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => setBanTarget(u)}
                              variant='destructive'
                            >
                              <BanIcon aria-hidden />
                              {t('moderation.banUserItem')}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => setHistoryTarget(u)}>
                            <HistoryIcon aria-hidden />
                            {t('moderation.banHistoryItem')}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setResetTarget(u)}>
                            <EraserIcon aria-hidden />
                            {t('moderation.resetProfileItem')}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      )}

                      {canManageRoles && (
                        <DropdownMenuRadioGroup
                          value={u.role}
                          onValueChange={(r) => changeRole(u, r as Role)}
                        >
                          {moderatable && <DropdownMenuSeparator />}
                          <DropdownMenuLabel>
                            {t('moderation.changeRole')}
                          </DropdownMenuLabel>
                          {ROLES.map((r) => (
                            <DropdownMenuRadioItem value={r} key={r}>
                              {roleLabel(t, r)}
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
                            {t('moderation.deleteItem')}
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

      {/* Pager: range summary + prev/next. Hidden when everything fits one page
          and there's nothing to page through. */}
      {(total > pageSize || page > 1) && (
        <div className='flex items-center justify-between gap-2'>
          <p className='text-muted-foreground text-xs tabular-nums'>
            {total === 0
              ? t('moderation.noUsersPager')
              : t('moderation.range', {
                  start: rangeStart,
                  end: rangeEnd,
                  total,
                })}
          </p>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='sm'
              disabled={page <= 1 || pending}
              onClick={() => fetchPage(query, page - 1)}
            >
              <ChevronLeftIcon aria-hidden />
              {t('moderation.prev')}
            </Button>
            <span className='text-muted-foreground text-xs tabular-nums'>
              {t('moderation.pageOf', { page, total: totalPages })}
            </span>
            <Button
              variant='outline'
              size='sm'
              disabled={page >= totalPages || pending}
              onClick={() => fetchPage(query, page + 1)}
            >
              {t('moderation.next')}
              <ChevronRightIcon aria-hidden />
            </Button>
          </div>
        </div>
      )}

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
        onDeleted={handleDeleted}
      />
      <HistoryDialog
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
        viewerRole={viewerRole}
      />
      <ResetDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
        onReset={handleReset}
      />
    </div>
  );
}
function ResetDialog({
  target,
  onClose,
  onReset,
}: {
  target: ModerationUserRow | null;
  onClose: () => void;
  onReset: (
    id: string,
    changes: {
      name: string | null;
      username: string | null;
      clearedImage: boolean;
    },
  ) => void;
}) {
  // Which fields to blank. Default to everything, since a moderator opening this
  // is usually clearing inappropriate content wholesale.
  const [fields, setFields] = useState<Required<ResetProfileFields>>({
    name: true,
    username: true,
    image: true,
    bio: true,
    interests: true,
    posts: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

  const open = target !== null;
  const targetId = target?.id ?? null;

  useEffect(() => {
    if (!targetId) return;
    setFields({
      name: true,
      username: true,
      image: true,
      bio: true,
      interests: true,
      posts: true,
    });
    setSubmitting(false);
  }, [targetId]);

  const anySelected = Object.values(fields).some(Boolean);

  const TOGGLES: {
    key: keyof ResetProfileFields;
    labelKey: string;
    hintKey: string;
  }[] = [
    {
      key: 'name',
      labelKey: 'moderation.reset.name',
      hintKey: 'moderation.reset.nameHint',
    },
    {
      key: 'username',
      labelKey: 'moderation.reset.username',
      hintKey: 'moderation.reset.usernameHint',
    },
    {
      key: 'image',
      labelKey: 'moderation.reset.avatar',
      hintKey: 'moderation.reset.avatarHint',
    },
    {
      key: 'bio',
      labelKey: 'moderation.reset.bio',
      hintKey: 'moderation.reset.bioHint',
    },
    {
      key: 'interests',
      labelKey: 'moderation.reset.interests',
      hintKey: 'moderation.reset.interestsHint',
    },
    {
      key: 'posts',
      labelKey: 'moderation.reset.posts',
      hintKey: 'moderation.reset.postsHint',
    },
  ];

  async function submit() {
    if (!target || !anySelected) return;
    setSubmitting(true);

    const clearedImage = fields.image;
    toast.promise(
      (async () => {
        const res = await resetUserProfile(target.id, fields);
        onReset(target.id, {
          name: res.name,
          username: res.username,
          clearedImage,
        });
        onClose();
        return res.postsDeleted;
      })(),
      {
        loading: t('moderation.reset.resetting', { name: target.name }),
        success: (postsDeleted) =>
          postsDeleted > 0
            ? t('moderation.reset.resetPosts', { count: postsDeleted })
            : t('moderation.reset.resetDone'),
        error: (err) =>
          err instanceof Error
            ? err.message
            : t('moderation.reset.couldNotReset'),
        finally: () => setSubmitting(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('moderation.reset.title', { name: target?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>{t('moderation.reset.desc')}</DialogDescription>
        </DialogHeader>

        <div className='space-y-2'>
          {TOGGLES.map((toggle) => (
            <div
              key={toggle.key}
              className='border-border flex items-center justify-between gap-4 rounded-lg border p-3'
            >
              <div className='min-w-0'>
                <Label htmlFor={`reset-${toggle.key}`} className='block'>
                  {t(toggle.labelKey)}
                </Label>
                <p className='text-muted-foreground text-xs'>
                  {t(toggle.hintKey)}
                </p>
              </div>
              <Switch
                id={`reset-${toggle.key}`}
                checked={fields[toggle.key]}
                onCheckedChange={(v) =>
                  setFields((prev) => ({ ...prev, [toggle.key]: v }))
                }
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            {t('moderation.reset.cancel')}
          </Button>
          <Button
            variant='destructive'
            onClick={submit}
            disabled={submitting || !anySelected}
          >
            {submitting ? (
              <Loader2Icon className='animate-spin' aria-hidden />
            ) : (
              <EraserIcon aria-hidden />
            )}
            {t('moderation.reset.resetBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BanDialog({
  target,
  onClose,
  onBanned,
}: {
  target: ModerationUserRow | null;
  onClose: () => void;
  onBanned: (id: string, banExpiresAt: string | null) => void;
}) {
  const [reason, setReason] = useState('');
  const [durationKey, setDurationKey] = useState('7');
  const [banIp, setBanIp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useTranslation();

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
      toast.error(t('moderation.ban.reasonRequired'));
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
        loading: t('moderation.ban.banning', { name: target.name }),
        success: (ipBanned) =>
          ipBanned
            ? t('moderation.ban.bannedWithIp', { name: target.name })
            : t('moderation.ban.bannedUser', { name: target.name }),
        error: (err) =>
          err instanceof Error ? err.message : t('moderation.ban.couldNotBan'),
        finally: () => setSubmitting(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('moderation.ban.title', { name: target?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>{t('moderation.ban.desc')}</DialogDescription>
        </DialogHeader>

        <div className='min-w-0 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='ban-reason'>{t('moderation.ban.reason')}</Label>
            <Textarea
              id='ban-reason'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('moderation.ban.reasonPlaceholder')}
              className='resize-y wrap-break-word'
              rows={2}
            />
          </div>

          <div className='space-y-2'>
            <Label>{t('moderation.ban.duration')}</Label>
            <div className='flex flex-wrap gap-2'>
              {DURATIONS.map((d) => (
                <Button
                  key={d.key}
                  onClick={() => setDurationKey(d.key)}
                  variant={durationKey === d.key ? 'default' : 'outline'}
                >
                  {t(d.labelKey)}
                </Button>
              ))}
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='ban-ip' className='block'>
              {t('moderation.ban.alsoBanIp')}
            </Label>
            <div className='border-border xs:flex-row xs:items-center flex flex-col justify-between gap-4 rounded-lg border p-3'>
              <div className='min-w-0'>
                <p className='text-muted-foreground xs:whitespace-pre-wrap text-xs text-pretty'>
                  {t('moderation.ban.ipHint')}
                </p>
              </div>
              <Switch id='ban-ip' checked={banIp} onCheckedChange={setBanIp} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            {t('moderation.ban.cancel')}
          </Button>
          <Button variant='destructive' onClick={submit} disabled={submitting}>
            {submitting ? (
              <Loader2Icon className='animate-spin' aria-hidden />
            ) : (
              <BanIcon aria-hidden />
            )}
            {t('moderation.ban.banBtn')}
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
  target: ModerationUserRow | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const open = target !== null;
  const { t } = useTranslation();

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
        loading: t('moderation.deleteDialog.deleting', { name: target.name }),
        success: t('moderation.deleteDialog.deleted', { name: target.name }),
        error: (err) =>
          err instanceof Error
            ? err.message
            : t('moderation.deleteDialog.couldNotDelete'),
        finally: () => setSubmitting(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t('moderation.deleteDialog.title', { name: target?.name ?? '' })}
          </DialogTitle>
          <DialogDescription>
            {t('moderation.deleteDialog.desc')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant='outline' onClick={onClose} disabled={submitting}>
            {t('moderation.deleteDialog.cancel')}
          </Button>
          <Button variant='destructive' onClick={confirm} disabled={submitting}>
            {submitting ? (
              <Loader2Icon className='animate-spin' aria-hidden />
            ) : (
              <Trash2Icon aria-hidden />
            )}
            {t('moderation.deleteDialog.deleteBtn')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  target,
  onClose,
  viewerRole,
}: {
  target: ModerationUserRow | null;
  onClose: () => void;
  viewerRole: Role;
}) {
  const [entries, setEntries] = useState<BanHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [liftingId, setLiftingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
  const { t } = useTranslation();

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
            err instanceof Error
              ? err.message
              : t('moderation.history.couldNotLoad'),
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
        loading: t('moderation.history.liftingBan'),
        success: t('moderation.history.banLifted'),
        error: (err) =>
          err instanceof Error
            ? err.message
            : t('moderation.history.couldNotLift'),
        finally: () => {
          setLiftingId(null);
          setSubmittingLift(false);
        },
      },
    );
  }

  async function handleDeleteEntry(entry: BanHistoryEntry) {
    setDeletingId(entry.id);
    const previousEntries = [...entries];

    // Optimistic update
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));

    toast.promise(
      (async () => {
        try {
          await deleteBanHistoryEntry(entry.id, entry.scope);
        } catch (err) {
          setEntries(previousEntries);
          throw err;
        }
      })(),
      {
        loading: t('moderation.history.deletingEntry'),
        success: t('moderation.history.entryDeleted'),
        error: (err) =>
          err instanceof Error
            ? err.message
            : t('moderation.history.couldNotDeleteEntry'),
        finally: () => setDeletingId(null),
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
            <DialogTitle>
              {t('moderation.history.title', { name: target?.name ?? '' })}
            </DialogTitle>
            <DialogDescription>
              {t('moderation.history.desc')}
            </DialogDescription>
          </DialogHeader>

          <div className='flex items-center gap-2'>
            <Input
              placeholder={t('moderation.history.searchPlaceholder')}
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
                <SelectValue placeholder={t('moderation.history.sortBy')} />
              </SelectTrigger>
              <SelectContent position='popper' align='center' side='bottom'>
                <SelectItem value='newest'>
                  {t('moderation.history.newest')}
                </SelectItem>
                <SelectItem value='oldest'>
                  {t('moderation.history.oldest')}
                </SelectItem>
                <SelectItem value='issuer'>
                  {t('moderation.history.byIssuer')}
                </SelectItem>
                <SelectItem value='lifter'>
                  {t('moderation.history.byLifter')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className='relative min-w-0'>
            <div
              className='max-h-[60vh] min-w-0 space-y-6 overflow-y-auto p-1'
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
                    ? t('moderation.history.noMatching')
                    : t('moderation.history.noEntries')}
                </p>
              ) : (
                sortedEntries.map((e) => (
                  <div key={e.id} className='min-w-0 space-y-3'>
                    <div className='flex flex-wrap items-center justify-between gap-2 px-1'>
                      <div className='flex items-center gap-2'>
                        <Badge variant='secondary'>
                          {e.scope === 'IP'
                            ? t('moderation.history.ip')
                            : t('moderation.history.account')}
                        </Badge>
                        <Badge variant={e.active ? 'destructive' : 'secondary'}>
                          {e.active
                            ? t('moderation.history.active')
                            : t('moderation.history.lifted')}
                        </Badge>
                      </div>
                      <div className='flex items-center gap-2'>
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
                              <Loader2Icon
                                className='animate-spin'
                                aria-hidden
                              />
                            ) : null}
                            {t('moderation.history.unban')}
                          </Button>
                        )}
                        {viewerRole === 'ADMIN' && !e.active && (
                          <Button
                            size='xs'
                            variant='destructive'
                            onClick={() => handleDeleteEntry(e)}
                            disabled={deletingId === e.id}
                          >
                            {deletingId === e.id ? (
                              <Loader2Icon
                                className='animate-spin'
                                aria-hidden
                              />
                            ) : (
                              <Trash2Icon aria-hidden />
                            )}
                            {t('moderation.history.delete')}
                          </Button>
                        )}
                      </div>
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
                            {t('moderation.history.reason')}
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
                              {t('moderation.history.ipAddress')}
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
                            {t('moderation.history.duration')}
                          </div>
                          <div className='text-sm'>
                            {e.expiresAt ? (
                              <>
                                {t('moderation.history.expires')}{' '}
                                <LocalTime iso={e.expiresAt} />
                              </>
                            ) : (
                              t('moderation.history.permanent')
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
                            {t('moderation.history.issued')}
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
                              {t('moderation.history.liftedLabel')}
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
                                  {t('moderation.history.reasonPrefix', {
                                    reason: e.liftReason,
                                  })}
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
            <DialogTitle>{t('moderation.history.liftTitle')}</DialogTitle>
            <DialogDescription>
              {t('moderation.history.liftDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className='min-w-0 space-y-4'>
            <div className='min-w-0 space-y-2'>
              <Label htmlFor='lift-reason'>
                {t('moderation.history.liftReasonLabel')}
              </Label>
              <Textarea
                id='lift-reason'
                value={liftReason}
                onChange={(e) => setLiftReason(e.target.value)}
                placeholder={t('moderation.history.liftReasonPlaceholder')}
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
              {t('moderation.history.liftCancel')}
            </Button>
            <Button onClick={handleLiftSubmit} disabled={submittingLift}>
              {submittingLift ? (
                <Loader2Icon className='size-4 animate-spin' aria-hidden />
              ) : null}
              {t('moderation.history.confirmLift')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
