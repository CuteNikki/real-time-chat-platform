'use client';

import Link from 'next/link';
import { useEffect, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';

import {
  BanIcon,
  FileTextIcon,
  FlagIcon,
  HistoryIcon,
  ImageIcon,
  Loader2Icon,
  MessagesSquareIcon,
  MessageSquareIcon,
  ShieldCheckIcon,
  ShieldXIcon,
  Trash2Icon,
  UserIcon,
} from 'lucide-react';

import {
  getBanHistory,
  moderatorDeleteMessage,
  moderatorDeletePost,
  type BanHistoryEntry,
} from '@/app/actions/moderation';
import {
  getReportedMessageContext,
  listReports,
  listReportsAgainstUser,
  resolveReport,
  type ReportHistoryItem,
} from '@/app/actions/report';

import type {
  ReportedMessageContextItem,
  ReportListItem,
  ReportStatus,
  ReportVerdict,
} from '@/lib/types';

import { ImageLightbox } from '@/components/chat/image-lightbox';
import { LocalTime } from '@/components/local-time';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { UserAvatar } from '@/components/user/user-avatar';

type Filter = ReportStatus | 'ALL';

// Ban durations offered when confirming a guilty verdict. Mirrors the set in
// the moderation panel so enforcement feels consistent across both surfaces.
const DURATIONS: { key: string; label: string; days: number | null }[] = [
  { key: '1', label: '1 day', days: 1 },
  { key: '7', label: '7 days', days: 7 },
  { key: '30', label: '30 days', days: 30 },
  { key: 'perm', label: 'Permanent', days: null },
];

const TARGET_LABEL: Record<ReportListItem['target'], string> = {
  USER: 'User',
  POST: 'Post',
  MESSAGE: 'Message',
};

const TARGET_ICON: Record<
  ReportListItem['target'],
  typeof UserIcon
> = {
  USER: UserIcon,
  POST: ImageIcon,
  MESSAGE: MessageSquareIcon,
};

export function ReportsView({
  initialReports,
  initialFilter = 'PENDING',
}: {
  initialReports: ReportListItem[];
  initialFilter?: Filter;
}) {
  const [reports, setReports] = useState<ReportListItem[]>(initialReports);
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [pending, startTransition] = useTransition();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  // The report awaiting a guilty verdict — a guilty ruling must be backed by an
  // actual ban, so it routes through this dialog rather than resolving inline.
  const [banTarget, setBanTarget] = useState<ReportListItem | null>(null);
  // Reported image opened full-screen so a moderator can actually inspect it.
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  // The reported message whose surrounding conversation is being inspected.
  const [contextTarget, setContextTarget] = useState<ReportListItem | null>(
    null,
  );
  // The report whose reported user's ban + report history is being inspected.
  const [historyTarget, setHistoryTarget] = useState<ReportListItem | null>(
    null,
  );

  function changeFilter(next: Filter) {
    setFilter(next);
    startTransition(async () => {
      try {
        const rows = await listReports(next);
        setReports(rows);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not load reports',
        );
      }
    });
  }

  // Reflect a ruling locally. On the Pending tab the row leaves the list;
  // elsewhere it flips to its resolved state in place.
  function markResolved(reportId: string, verdict: ReportVerdict) {
    setReports((prev) =>
      filter === 'PENDING'
        ? prev.filter((r) => r.id !== reportId)
        : prev.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  status: 'RESOLVED',
                  verdict,
                  reviewedAt: new Date().toISOString(),
                }
              : r,
          ),
    );
  }

  // Not-guilty resolves inline — no enforcement action to collect.
  function resolveNotGuilty(report: ReportListItem) {
    setResolvingId(report.id);
    toast.promise(
      (async () => {
        await resolveReport(report.id, 'NOT_GUILTY');
        markResolved(report.id, 'NOT_GUILTY');
      })(),
      {
        loading: 'Recording verdict...',
        success: 'Marked not guilty — the reporter was notified',
        error: (err) =>
          err instanceof Error ? err.message : 'Could not resolve report',
        finally: () => setResolvingId(null),
      },
    );
  }

  // Mark the reported content deleted in place after a moderator removes it, so
  // the "removed" indicator shows without a refetch.
  function markContentDeleted(reportId: string, kind: 'post' | 'message') {
    setReports((prev) =>
      prev.map((r) => {
        if (r.id !== reportId) return r;
        if (kind === 'post' && r.post) {
          return { ...r, post: { ...r.post, deleted: true } };
        }
        if (kind === 'message' && r.message) {
          return { ...r, message: { ...r.message, deleted: true } };
        }
        return r;
      }),
    );
  }

  return (
    <div className='space-y-4'>
      <Tabs value={filter} onValueChange={(v) => changeFilter(v as Filter)}>
        <TabsList>
          <TabsTrigger value='PENDING'>Pending</TabsTrigger>
          <TabsTrigger value='RESOLVED'>Resolved</TabsTrigger>
          <TabsTrigger value='ALL'>All</TabsTrigger>
        </TabsList>
      </Tabs>

      {pending ? (
        <div className='flex justify-center py-16'>
          <Loader2Icon
            className='text-muted-foreground size-5 animate-spin'
            aria-hidden
          />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={FlagIcon}
          title='No reports'
          description={
            filter === 'PENDING'
              ? 'There are no reports waiting for review.'
              : 'No reports match this filter.'
          }
        />
      ) : (
        <ul className='space-y-3'>
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              resolving={resolvingId === r.id}
              onNotGuilty={resolveNotGuilty}
              onRequestGuilty={setBanTarget}
              onViewImage={setLightboxSrc}
              onViewContext={setContextTarget}
              onViewHistory={setHistoryTarget}
              onContentDeleted={markContentDeleted}
            />
          ))}
        </ul>
      )}

      <ReportBanDialog
        target={banTarget}
        onClose={() => setBanTarget(null)}
        onResolved={(id) => markResolved(id, 'GUILTY')}
      />

      <ImageLightbox
        open={!!lightboxSrc}
        src={lightboxSrc ?? ''}
        alt='Reported image'
        onClose={() => setLightboxSrc(null)}
      />

      <MessageContextDialog
        target={contextTarget}
        onClose={() => setContextTarget(null)}
        onViewImage={setLightboxSrc}
      />

      <UserHistoryDialog
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}

function ReportCard({
  report,
  resolving,
  onNotGuilty,
  onRequestGuilty,
  onViewImage,
  onViewContext,
  onViewHistory,
  onContentDeleted,
}: {
  report: ReportListItem;
  resolving: boolean;
  onNotGuilty: (report: ReportListItem) => void;
  onRequestGuilty: (report: ReportListItem) => void;
  onViewImage: (src: string) => void;
  onViewContext: (report: ReportListItem) => void;
  onViewHistory: (report: ReportListItem) => void;
  onContentDeleted: (reportId: string, kind: 'post' | 'message') => void;
}) {
  const TargetIcon = TARGET_ICON[report.target];
  const isPending = report.status === 'PENDING';
  const [deleting, setDeleting] = useState(false);

  async function removePost() {
    if (!report.post || deleting) return;
    setDeleting(true);
    toast.promise(
      (async () => {
        await moderatorDeletePost(report.post!.id);
        onContentDeleted(report.id, 'post');
      })(),
      {
        loading: 'Removing post...',
        success: 'Post removed — the author was notified',
        error: (err) =>
          err instanceof Error ? err.message : 'Could not remove post',
        finally: () => setDeleting(false),
      },
    );
  }

  async function removeMessage() {
    if (!report.message || deleting) return;
    setDeleting(true);
    toast.promise(
      (async () => {
        await moderatorDeleteMessage(report.message!.id);
        onContentDeleted(report.id, 'message');
      })(),
      {
        loading: 'Removing message...',
        success: 'Message removed — the author was notified',
        error: (err) =>
          err instanceof Error ? err.message : 'Could not remove message',
        finally: () => setDeleting(false),
      },
    );
  }

  return (
    <li className='border-border bg-card space-y-3 rounded-xl border p-4'>
      {/* Header: reference + status/target badges */}
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <span className='font-mono text-xs font-medium tracking-wide'>
            {report.reference}
          </span>
          <Badge variant='outline' className='gap-1'>
            <TargetIcon className='size-3' aria-hidden />
            {TARGET_LABEL[report.target]}
          </Badge>
        </div>
        {isPending ? (
          <Badge variant='secondary'>Pending</Badge>
        ) : report.verdict === 'GUILTY' ? (
          <Badge variant='destructive' className='gap-1'>
            <ShieldXIcon className='size-3' aria-hidden />
            Guilty
          </Badge>
        ) : (
          <Badge variant='secondary' className='gap-1'>
            <ShieldCheckIcon className='size-3' aria-hidden />
            Not guilty
          </Badge>
        )}
      </div>

      {/* Parties */}
      <div className='grid gap-3 sm:grid-cols-2'>
        <ReportParty
          label='Reported'
          user={report.reportedUser}
          emphasize
          action={
            report.reportedUser ? (
              <Button
                size='xs'
                variant='ghost'
                className='text-muted-foreground -my-1'
                onClick={() => onViewHistory(report)}
              >
                <HistoryIcon aria-hidden />
                History
              </Button>
            ) : null
          }
        />
        <ReportParty label='Reporter' user={report.reporter} />
      </div>

      {/* Reason */}
      {report.reason ? (
        <div className='border-border rounded-lg border p-3'>
          <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
            Reason
          </div>
          <p className='mt-1 text-sm wrap-break-word whitespace-pre-wrap'>
            {report.reason}
          </p>
        </div>
      ) : null}

      {/* Reported content snapshot. Content is retained for 30 days after
          removal so a report stays verifiable — a removed item still shows here
          with a "removed" tag, and only vanishes once purged past the window. */}
      {report.post ? (
        <div className='border-border flex items-start gap-3 rounded-lg border p-3'>
          {report.post.imageUrl ? (
            <button
              type='button'
              onClick={() => onViewImage(report.post!.imageUrl!)}
              className='ring-ring shrink-0 cursor-zoom-in rounded-md outline-none focus-visible:ring-2'
              aria-label='View reported image'
            >
              {/* Blob image; unoptimized to match the rest of the app. */}
              <img
                src={report.post.imageUrl}
                alt='Reported post'
                className='size-16 rounded-md object-cover'
              />
            </button>
          ) : (
            <FileTextIcon
              className='text-muted-foreground mt-0.5 size-4 shrink-0'
              aria-hidden
            />
          )}
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <span className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                Reported post
              </span>
              {report.post.deleted ? <RemovedTag /> : null}
            </div>
            <p className='mt-1 line-clamp-3 text-sm wrap-break-word whitespace-pre-wrap'>
              {report.post.caption || (
                <span className='text-muted-foreground italic'>No caption</span>
              )}
            </p>
            {isPending && !report.post.deleted ? (
              <Button
                size='xs'
                variant='outline'
                className='mt-2'
                disabled={deleting}
                onClick={removePost}
              >
                {deleting ? (
                  <Loader2Icon className='animate-spin' aria-hidden />
                ) : (
                  <Trash2Icon aria-hidden />
                )}
                Remove post
              </Button>
            ) : null}
          </div>
        </div>
      ) : report.message ? (
        <div className='border-border flex items-start gap-3 rounded-lg border p-3'>
          <MessageSquareIcon
            className='text-muted-foreground mt-0.5 size-4 shrink-0'
            aria-hidden
          />
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              <span className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                Reported message
              </span>
              {report.message.deleted ? <RemovedTag /> : null}
            </div>
            {report.message.imageUrl ? (
              <button
                type='button'
                onClick={() => onViewImage(report.message!.imageUrl!)}
                className='ring-ring mt-2 block shrink-0 cursor-zoom-in rounded-md outline-none focus-visible:ring-2'
                aria-label='View reported image'
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={report.message.imageUrl}
                  alt='Reported message attachment'
                  className='max-h-40 rounded-md object-cover'
                />
              </button>
            ) : null}
            {report.message.content ? (
              <p className='mt-1 line-clamp-4 text-sm wrap-break-word whitespace-pre-wrap'>
                {report.message.content}
              </p>
            ) : !report.message.imageUrl ? (
              <p className='text-muted-foreground mt-1 text-sm italic'>
                No text content
              </p>
            ) : null}
            <div className='mt-2 flex flex-wrap items-center gap-2'>
              {/* Surrounding conversation, so a reported line can be judged in
                  context rather than in isolation. */}
              <Button
                size='xs'
                variant='outline'
                onClick={() => onViewContext(report)}
              >
                <MessagesSquareIcon aria-hidden />
                View conversation
              </Button>
              {isPending && !report.message.deleted ? (
                <Button
                  size='xs'
                  variant='outline'
                  disabled={deleting}
                  onClick={removeMessage}
                >
                  {deleting ? (
                    <Loader2Icon className='animate-spin' aria-hidden />
                  ) : (
                    <Trash2Icon aria-hidden />
                  )}
                  Remove message
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : report.target === 'MESSAGE' || report.target === 'POST' ? (
        <p className='text-muted-foreground text-xs italic'>
          The reported {report.target === 'POST' ? 'post' : 'message'} is no
          longer available — it was purged past the 30-day retention window.
        </p>
      ) : null}

      {/* Footer: timestamp + actions */}
      <div className='flex flex-wrap items-center justify-between gap-2 pt-1'>
        <p className='text-muted-foreground text-xs'>
          Filed <LocalTime iso={report.createdAt} />
          {!isPending && report.reviewedAt ? (
            <>
              {' · reviewed '}
              <LocalTime iso={report.reviewedAt} />
              {report.reviewedBy ? (
                <>
                  {' by '}
                  {report.reviewedBy.username ? (
                    <Link
                      href={`/app/u/${report.reviewedBy.username}`}
                      className='text-foreground font-medium hover:underline'
                    >
                      {report.reviewedBy.name}
                    </Link>
                  ) : (
                    <span className='text-foreground font-medium'>
                      {report.reviewedBy.name}
                    </span>
                  )}
                </>
              ) : null}
            </>
          ) : null}
        </p>
        {isPending ? (
          <div className='flex items-center gap-2'>
            <Button
              size='sm'
              variant='outline'
              disabled={resolving}
              onClick={() => onNotGuilty(report)}
            >
              {resolving ? (
                <Loader2Icon className='animate-spin' aria-hidden />
              ) : (
                <ShieldCheckIcon aria-hidden />
              )}
              Not guilty
            </Button>
            <Button
              size='sm'
              variant='destructive'
              disabled={resolving || !report.reportedUser}
              onClick={() => onRequestGuilty(report)}
              title={
                report.reportedUser
                  ? undefined
                  : 'The reported account no longer exists'
              }
            >
              <ShieldXIcon aria-hidden />
              Guilty &amp; ban
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

// A small "Removed" pill on reported content that's been deleted but is still
// retained for moderation review.
function RemovedTag() {
  return (
    <Badge variant='outline' className='gap-1 text-[10px]'>
      <Trash2Icon className='size-2.5' aria-hidden />
      Removed · retained
    </Badge>
  );
}

// Shows the conversation around a reported message so a moderator can read it in
// context. Fetches the window (reported line ± a few messages) when opened, with
// the reported message highlighted and the reported user's messages tinted.
function MessageContextDialog({
  target,
  onClose,
  onViewImage,
}: {
  target: ReportListItem | null;
  onClose: () => void;
  onViewImage: (src: string) => void;
}) {
  const [items, setItems] = useState<ReportedMessageContextItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const open = target !== null;
  const targetId = target?.id ?? null;

  useEffect(() => {
    if (!targetId) {
      setItems(null);
      return;
    }
    let active = true;
    setLoading(true);
    setItems(null);
    getReportedMessageContext(targetId)
      .then((rows) => {
        if (active) setItems(rows);
      })
      .catch((err) => {
        if (active) {
          toast.error(
            err instanceof Error ? err.message : 'Could not load conversation',
          );
          onClose();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [targetId, onClose]);

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className='max-h-[80vh] gap-0 overflow-hidden p-0 sm:max-w-lg'>
        <DialogHeader className='border-border border-b p-4'>
          <DialogTitle>Conversation context</DialogTitle>
          <DialogDescription>
            The reported message, highlighted, with the surrounding exchange for
            context.
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[60vh] space-y-2 overflow-y-auto p-4'>
          {loading ? (
            <div className='flex justify-center py-10'>
              <Loader2Icon
                className='text-muted-foreground size-5 animate-spin'
                aria-hidden
              />
            </div>
          ) : !items || items.length === 0 ? (
            <p className='text-muted-foreground py-8 text-center text-sm'>
              No surrounding messages are available — the conversation may have
              been purged past the 30-day retention window.
            </p>
          ) : (
            items.map((m) => (
              <ContextMessage key={m.id} message={m} onViewImage={onViewImage} />
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// One message row inside the conversation-context dialog.
function ContextMessage({
  message,
  onViewImage,
}: {
  message: ReportedMessageContextItem;
  onViewImage: (src: string) => void;
}) {
  if (message.system) {
    return (
      <p className='text-muted-foreground py-1 text-center text-xs'>
        {message.content || 'System notice'}
      </p>
    );
  }

  return (
    <div
      className={`flex gap-2 rounded-lg p-2 ${
        message.isReported
          ? 'bg-destructive/10 ring-destructive/40 ring-1'
          : ''
      }`}
    >
      <UserAvatar
        name={message.senderName}
        image={message.senderImage}
        className='size-7 shrink-0'
      />
      <div className='min-w-0 flex-1'>
        <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5'>
          <span className='text-sm font-medium'>{message.senderName}</span>
          {message.isReportedUser ? (
            <Badge variant='outline' className='text-[10px]'>
              Reported user
            </Badge>
          ) : null}
          {message.isReported ? (
            <Badge variant='destructive' className='gap-1 text-[10px]'>
              <FlagIcon className='size-2.5' aria-hidden />
              Reported
            </Badge>
          ) : null}
          {message.deleted ? <RemovedTag /> : null}
          <span className='text-muted-foreground ml-auto text-[10px]'>
            <LocalTime iso={message.createdAt} />
          </span>
        </div>
        {message.imageUrl ? (
          <button
            type='button'
            onClick={() => onViewImage(message.imageUrl!)}
            className='ring-ring mt-1 block cursor-zoom-in rounded-md outline-none focus-visible:ring-2'
            aria-label='View image'
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={message.imageUrl}
              alt='Message attachment'
              className='max-h-32 rounded-md object-cover'
            />
          </button>
        ) : null}
        {message.content ? (
          <p className='mt-0.5 text-sm wrap-break-word whitespace-pre-wrap'>
            {message.content}
          </p>
        ) : !message.imageUrl ? (
          <p className='text-muted-foreground mt-0.5 text-sm italic'>
            No text content
          </p>
        ) : null}
      </div>
    </div>
  );
}

// The reported user's track record — every ban and every report ever filed
// against them — so a moderator can weigh a new report against prior behaviour
// instead of judging it in a vacuum. Read-only: lifting bans and deleting
// history entries stay in the moderation panel.
function UserHistoryDialog({
  target,
  onClose,
}: {
  target: ReportListItem | null;
  onClose: () => void;
}) {
  const [bans, setBans] = useState<BanHistoryEntry[] | null>(null);
  const [reports, setReports] = useState<ReportHistoryItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  const open = target !== null;
  const userId = target?.reportedUser?.id ?? null;
  const name = target?.reportedUser?.name ?? 'this user';

  useEffect(() => {
    if (!userId) {
      setBans(null);
      setReports(null);
      return;
    }
    let active = true;
    setLoading(true);
    setBans(null);
    setReports(null);
    Promise.all([getBanHistory(userId), listReportsAgainstUser(userId)])
      .then(([banRows, reportRows]) => {
        if (active) {
          setBans(banRows);
          setReports(reportRows);
        }
      })
      .catch((err) => {
        if (active) {
          toast.error(
            err instanceof Error ? err.message : 'Could not load history',
          );
          onClose();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, onClose]);

  const guiltyCount =
    reports?.filter((r) => r.verdict === 'GUILTY').length ?? 0;
  const activelyBanned = bans?.some((b) => b.active) ?? false;

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className='max-h-[80vh] gap-0 overflow-hidden p-0 sm:max-w-lg'>
        <DialogHeader className='border-border border-b p-4'>
          <DialogTitle>{name}&apos;s history</DialogTitle>
          <DialogDescription>
            Every ban and report on this account, newest first.
          </DialogDescription>
        </DialogHeader>

        <div className='max-h-[60vh] space-y-4 overflow-y-auto p-4'>
          {loading || !bans || !reports ? (
            <div className='flex justify-center py-10'>
              <Loader2Icon
                className='text-muted-foreground size-5 animate-spin'
                aria-hidden
              />
            </div>
          ) : (
            <>
              {/* Track-record summary */}
              <div className='flex flex-wrap items-center gap-2'>
                <Badge variant='outline' className='gap-1'>
                  <FlagIcon className='size-3' aria-hidden />
                  {reports.length} report{reports.length === 1 ? '' : 's'}
                </Badge>
                <Badge variant='outline' className='gap-1'>
                  <ShieldXIcon className='size-3' aria-hidden />
                  {guiltyCount} guilty
                </Badge>
                <Badge variant='outline' className='gap-1'>
                  <BanIcon className='size-3' aria-hidden />
                  {bans.length} ban{bans.length === 1 ? '' : 's'}
                </Badge>
                {activelyBanned ? (
                  <Badge variant='destructive'>Currently banned</Badge>
                ) : null}
              </div>

              {/* Bans */}
              <section className='space-y-2'>
                <h3 className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                  Ban history
                </h3>
                {bans.length === 0 ? (
                  <p className='text-muted-foreground text-sm italic'>
                    Never banned.
                  </p>
                ) : (
                  bans.map((b) => (
                    <div
                      key={`${b.scope}-${b.id}`}
                      className='border-border space-y-1 rounded-lg border p-3'
                    >
                      <div className='flex flex-wrap items-center gap-2'>
                        <Badge variant='outline' className='text-[10px]'>
                          {b.scope === 'IP' ? 'IP ban' : 'Account ban'}
                        </Badge>
                        {b.active ? (
                          <Badge variant='destructive' className='text-[10px]'>
                            Active
                          </Badge>
                        ) : b.liftedAt ? (
                          <Badge variant='secondary' className='text-[10px]'>
                            Lifted
                          </Badge>
                        ) : (
                          <Badge variant='secondary' className='text-[10px]'>
                            Expired
                          </Badge>
                        )}
                        <span className='text-muted-foreground ml-auto text-[10px]'>
                          <LocalTime iso={b.createdAt} />
                        </span>
                      </div>
                      <p className='text-sm wrap-break-word'>{b.reason}</p>
                      <p className='text-muted-foreground text-xs'>
                        {b.bannedByName ? `By ${b.bannedByName} · ` : null}
                        {b.expiresAt ? (
                          <>
                            expires <LocalTime iso={b.expiresAt} />
                          </>
                        ) : (
                          'permanent'
                        )}
                        {b.liftedAt ? (
                          <>
                            {' · lifted '}
                            <LocalTime iso={b.liftedAt} />
                            {b.liftedByName ? ` by ${b.liftedByName}` : null}
                          </>
                        ) : null}
                      </p>
                    </div>
                  ))
                )}
              </section>

              {/* Reports */}
              <section className='space-y-2'>
                <h3 className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                  Report history
                </h3>
                {reports.length === 0 ? (
                  <p className='text-muted-foreground text-sm italic'>
                    Never reported.
                  </p>
                ) : (
                  reports.map((r) => (
                    <div
                      key={r.id}
                      className='border-border space-y-1 rounded-lg border p-3'
                    >
                      <div className='flex flex-wrap items-center gap-2'>
                        <span className='font-mono text-xs font-medium tracking-wide'>
                          {r.reference}
                        </span>
                        <Badge variant='outline' className='text-[10px]'>
                          {TARGET_LABEL[r.target]}
                        </Badge>
                        {r.id === target?.id ? (
                          <Badge variant='outline' className='text-[10px]'>
                            This report
                          </Badge>
                        ) : null}
                        {r.status === 'PENDING' ? (
                          <Badge variant='secondary' className='text-[10px]'>
                            Pending
                          </Badge>
                        ) : r.verdict === 'GUILTY' ? (
                          <Badge variant='destructive' className='text-[10px]'>
                            Guilty
                          </Badge>
                        ) : (
                          <Badge variant='secondary' className='text-[10px]'>
                            Not guilty
                          </Badge>
                        )}
                        <span className='text-muted-foreground ml-auto text-[10px]'>
                          <LocalTime iso={r.createdAt} />
                        </span>
                      </div>
                      {r.reason ? (
                        <p className='text-muted-foreground line-clamp-2 text-xs wrap-break-word'>
                          {r.reason}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </section>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Confirming a guilty verdict: collect a ban reason + duration, then resolve the
// report AND ban the reported user in one server round-trip (resolveReport
// performs the ban). Reusing the moderation panel's fields keeps enforcement
// consistent.
function ReportBanDialog({
  target,
  onClose,
  onResolved,
}: {
  target: ReportListItem | null;
  onClose: () => void;
  onResolved: (reportId: string) => void;
}) {
  const [reason, setReason] = useState('');
  const [durationKey, setDurationKey] = useState('7');
  const [banIp, setBanIp] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const open = target !== null;
  const targetId = target?.id ?? null;
  const name = target?.reportedUser?.name ?? 'this user';

  // Reset the draft whenever a new report opens the dialog. Seed the reason with
  // the reporter's stated reason so the moderator can keep or edit it.
  useEffect(() => {
    if (!targetId) return;
    setReason(target?.reason ?? '');
    setDurationKey('7');
    setBanIp(false);
    setSubmitting(false);
  }, [targetId, target?.reason]);

  function submit() {
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
        const res = await resolveReport(target.id, 'GUILTY', {
          reason: trimmed,
          durationDays: duration.days,
          banIp,
        });
        onResolved(target.id);
        onClose();
        return res.ipBanned;
      })(),
      {
        loading: `Banning ${name}...`,
        success: (ipBanned) =>
          ipBanned
            ? `${name} and their IP were banned — report resolved`
            : `${name} was banned — report resolved`,
        error: (err) =>
          err instanceof Error ? err.message : 'Could not resolve report',
        finally: () => setSubmitting(false),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && !submitting ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {name}</DialogTitle>
          <DialogDescription>
            A guilty verdict bans the reported account. They&apos;ll immediately
            lose access and be signed out, the reporter is told action was taken,
            and this is recorded in the account&apos;s ban history.
          </DialogDescription>
        </DialogHeader>

        <div className='min-w-0 space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='report-ban-reason'>Reason</Label>
            <Textarea
              id='report-ban-reason'
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
                  onClick={() => setDurationKey(d.key)}
                  variant={durationKey === d.key ? 'default' : 'outline'}
                >
                  {d.label}
                </Button>
              ))}
            </div>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='report-ban-ip' className='block'>
              Also ban their IP address
            </Label>
            <div className='border-border xs:flex-row xs:items-center flex flex-col justify-between gap-4 rounded-lg border p-3'>
              <div className='min-w-0'>
                <p className='text-muted-foreground xs:whitespace-pre-wrap text-xs text-pretty'>
                  Blocks the last known IP from this account.{'\n'}IPs can be
                  shared, so this may affect other users.
                </p>
              </div>
              <Switch
                id='report-ban-ip'
                checked={banIp}
                onCheckedChange={setBanIp}
              />
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
            Ban &amp; resolve
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReportParty({
  label,
  user,
  emphasize = false,
  action,
}: {
  label: string;
  user: ReportListItem['reporter'];
  emphasize?: boolean;
  // Optional control rendered on the box's header row (e.g. the reported
  // user's History button).
  action?: ReactNode;
}) {
  return (
    <div className='border-border rounded-lg border p-3'>
      <div className='flex items-center justify-between gap-2'>
        <div className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
          {label}
        </div>
        {action}
      </div>
      {user ? (
        user.username ? (
          <Link
            href={`/app/u/${user.username}`}
            className='mt-1.5 flex items-center gap-2'
          >
            <UserAvatar
              name={user.name}
              image={user.image}
              className='size-8 shrink-0'
            />
            <div className='min-w-0 leading-tight'>
              <p
                className={`truncate text-sm hover:underline ${
                  emphasize ? 'font-semibold' : 'font-medium'
                }`}
              >
                {user.name}
              </p>
              <p className='text-muted-foreground truncate text-xs'>
                @{user.username}
              </p>
            </div>
          </Link>
        ) : (
          <div className='mt-1.5 flex items-center gap-2'>
            <UserAvatar
              name={user.name}
              image={user.image}
              className='size-8 shrink-0'
            />
            <p className='truncate text-sm font-medium'>{user.name}</p>
          </div>
        )
      ) : (
        <p className='text-muted-foreground mt-1.5 text-sm italic'>
          Account deleted
        </p>
      )}
    </div>
  );
}
