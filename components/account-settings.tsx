'use client';

import type React from 'react';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword, deleteUser, signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, KeyRound, Trash2 } from 'lucide-react';

export function AccountSettings() {
  const router = useRouter();

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
