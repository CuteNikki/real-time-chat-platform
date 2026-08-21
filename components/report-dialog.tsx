'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { FlagIcon, Loader2Icon } from 'lucide-react';

import { reportUser } from '@/app/actions/report';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

// Everything needed to file one report: always a reported user, optionally
// pinned to a specific post or chat message they authored (and the chat it
// happened in, so the server can verify membership). A friendly `name` is only
// for the dialog copy.
export type ReportTarget = {
  reportedUserId: string;
  name?: string | null;
  chatId?: string;
  postId?: string;
  messageId?: string;
};

// What kind of thing is being reported, for the dialog's wording.
function targetNoun(target: ReportTarget): string {
  if (target.postId) return 'post';
  if (target.messageId) return 'message';
  return 'user';
}

// A shared, controlled report dialog used everywhere the app lets you report
// someone: a random-chat partner, a profile, a post, a user preview. Collects an
// optional reason, files the report, and surfaces the returned reference code so
// the reporter can refer to it later (they also receive it as a System DM).
export function ReportDialog({
  target,
  open,
  onOpenChange,
}: {
  target: ReportTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Clear the draft whenever a fresh target opens the dialog.
  useEffect(() => {
    if (open) {
      setReason('');
      setSubmitting(false);
    }
  }, [open, target?.reportedUserId]);

  const noun = target ? targetNoun(target) : 'user';
  const who = target?.name?.trim();

  async function submit() {
    if (!target || submitting) return;
    setSubmitting(true);
    try {
      const res = await reportUser({
        reportedUserId: target.reportedUserId,
        chatId: target.chatId,
        postId: target.postId,
        messageId: target.messageId,
        reason: reason.trim() || undefined,
      });
      onOpenChange(false);
      toast.success('Report submitted', {
        description: `Reference ${res.reference} — our team will review it.`,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit report');
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!submitting ? onOpenChange(o) : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Report {noun === 'user' ? (who ?? 'user') : `this ${noun}`}
          </DialogTitle>
          <DialogDescription>
            {noun === 'user'
              ? `Flag ${who ?? 'this account'} for our moderators to review.`
              : `Flag this ${noun}${who ? ` from ${who}` : ''} for our moderators to review.`}{' '}
            You&apos;ll get a reference code and a message with the outcome.
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-2'>
          <Label htmlFor='report-reason'>Reason (optional)</Label>
          <Textarea
            id='report-reason'
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder='Add any context that will help us review this report'
            className='resize-y wrap-break-word'
            maxLength={1000}
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button variant='destructive' onClick={submit} disabled={submitting}>
            {submitting ? (
              <Loader2Icon className='animate-spin' aria-hidden />
            ) : (
              <FlagIcon aria-hidden />
            )}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
