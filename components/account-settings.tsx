'use client';

import type React from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  changePassword,
  deleteUser,
  sendVerificationEmail,
  signOut,
  useSession,
} from '@/lib/auth-client';
import {
  KeyRound,
  Loader2,
  MailCheckIcon,
  MailIcon,
  Trash2,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

export function AccountSettings() {
  const router = useRouter();
  const { data: session } = useSession();
  const [sendingVerify, setSendingVerify] = useState(false);

  async function handleResendVerification() {
    if (!session?.user.email) return;
    setSendingVerify(true);
    try {
      const { error } = await sendVerificationEmail({
        email: session.user.email,
        callbackURL: '/app/settings',
      });
      if (error) throw new Error(error.message || 'Could not send email');
      toast.success('Verification email sent — check your inbox');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSendingVerify(false);
    }
  }

  // Change password state.
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Delete account state.
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setSavingPw(true);
    try {
      const { error } = await changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (error) throw new Error(error.message || 'Could not change password');
      toast.success('Password updated');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not change password',
      );
    } finally {
      setSavingPw(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await deleteUser();
      if (error) throw new Error(error.message || 'Could not delete account');
      toast.success('Your account has been deleted');
      await signOut();
      router.push('/sign-up');
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not delete account',
      );
      setDeleting(false);
    }
  }

  return (
    <div className='space-y-10'>
      {/* Change password */}
      {session?.user ? (
        <section className='border-border bg-card flex items-center justify-between gap-4 rounded-xl border p-5'>
          <div className='flex items-start gap-3'>
            {session.user.emailVerified ? (
              <MailCheckIcon
                className='text-primary mt-0.5 size-4 shrink-0'
                aria-hidden
              />
            ) : (
              <MailIcon
                className='text-muted-foreground mt-0.5 size-4 shrink-0'
                aria-hidden
              />
            )}
            <div>
              <p className='text-sm font-medium'>{session.user.email}</p>
              <p className='text-muted-foreground text-sm'>
                {session.user.emailVerified ? 'Verified' : 'Not verified yet'}
              </p>
            </div>
          </div>
          {!session.user.emailVerified && (
            <Button
              variant='outline'
              size='sm'
              disabled={sendingVerify}
              onClick={handleResendVerification}
            >
              {sendingVerify ? (
                <Loader2 className='size-4 animate-spin' aria-hidden />
              ) : null}
              Resend verification
            </Button>
          )}
        </section>
      ) : null}
      <section className='space-y-4'>
        <div className='flex items-center gap-2'>
          <KeyRound className='text-muted-foreground size-4' aria-hidden />
          <h2 className='text-lg font-semibold tracking-tight'>
            Change password
          </h2>
        </div>
        <form onSubmit={handleChangePassword} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='current-password'>Current password</Label>
            <Input
              id='current-password'
              type='password'
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete='current-password'
              required
            />
          </div>
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='new-password'>New password</Label>
              <Input
                id='new-password'
                type='password'
                value={next}
                onChange={(e) => setNext(e.target.value)}
                minLength={8}
                autoComplete='new-password'
                required
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='confirm-password'>Confirm new password</Label>
              <Input
                id='confirm-password'
                type='password'
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                minLength={8}
                autoComplete='new-password'
                required
              />
            </div>
          </div>
          <div className='flex justify-end'>
            <Button type='submit' disabled={savingPw} className='gap-2'>
              {savingPw ? (
                <Loader2 className='size-4 animate-spin' aria-hidden />
              ) : null}
              Update password
            </Button>
          </div>
        </form>
      </section>

      {/* Danger zone */}
      <section className='border-destructive/40 bg-destructive/5 space-y-4 rounded-xl border p-5'>
        <div className='flex items-center gap-2'>
          <Trash2 className='text-destructive size-4' aria-hidden />
          <h2 className='text-destructive text-lg font-semibold tracking-tight'>
            Delete account
          </h2>
        </div>
        <p className='text-muted-foreground text-sm leading-relaxed'>
          Permanently delete your account, profile, posts, and messages. This
          cannot be undone.
        </p>
        <Dialog>
          <DialogTrigger
            render={<Button variant='destructive' className='gap-2' />}
          >
            <Trash2 className='size-4' aria-hidden />
            Delete my account
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                This permanently removes your account and all associated data.
                Type{' '}
                <span className='text-foreground font-semibold'>DELETE</span> to
                confirm.
              </DialogDescription>
            </DialogHeader>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='DELETE'
              autoComplete='off'
              aria-label='Type DELETE to confirm'
            />
            <DialogFooter>
              <DialogClose render={<Button variant='outline' />}>
                Cancel
              </DialogClose>
              <Button
                variant='destructive'
                className='gap-2'
                disabled={deleteConfirm !== 'DELETE' || deleting}
                onClick={handleDelete}
              >
                {deleting ? (
                  <Loader2 className='size-4 animate-spin' aria-hidden />
                ) : null}
                Delete forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
