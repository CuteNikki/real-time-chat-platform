'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  CheckIcon,
  KeyRoundIcon,
  Loader2Icon,
  MailIcon,
  MailsIcon,
  SaveIcon,
  Trash2Icon,
} from 'lucide-react';

import {
  changePassword,
  deleteUser,
  sendVerificationEmail,
  signOut,
  useSession,
} from '@/lib/auth-client';

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
import { Skeleton } from '@/components/ui/skeleton';

export function AccountSettings() {
  const router = useRouter();
  const { t } = useTranslation();
  const { data: session, isPending: sessionPending } = useSession();
  const [sendingVerify, setSendingVerify] = useState(false);

  const isVerified = session?.user.emailVerified ?? false;

  async function handleResendVerification() {
    if (!session?.user.email) return;
    setSendingVerify(true);

    toast.promise(
      (async () => {
        const { error } = await sendVerificationEmail({
          email: session.user.email,
          callbackURL: '/app/settings',
        });
        if (error)
          throw new Error(
            error.message || t('settings.account.couldNotSendEmail'),
          );
      })(),
      {
        loading: t('settings.account.sendingEmail'),
        success: t('settings.account.emailSent'),
        error: (err) =>
          err instanceof Error
            ? err.message
            : t('settings.account.somethingWrong'),
        finally: () => setSendingVerify(false),
      },
    );
  }

  // Change password state.
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  // Delete account state.
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleChangePassword(e: React.SubmitEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error(t('settings.account.pwMismatch'));
      return;
    }

    setSavingPw(true);

    toast.promise(
      (async () => {
        const { error } = await changePassword({
          currentPassword: current,
          newPassword: next,
          revokeOtherSessions: true,
        });
        if (error)
          throw new Error(
            error.message || t('settings.account.couldNotChangePassword'),
          );

        setCurrent('');
        setNext('');
        setConfirm('');
      })(),
      {
        loading: t('settings.account.updatingPassword'),
        success: t('settings.account.passwordUpdated'),
        error: (err) =>
          err instanceof Error
            ? err.message
            : t('settings.account.couldNotChangePassword'),
        finally: () => setSavingPw(false),
      },
    );
  }

  async function handleDelete() {
    setDeleting(true);

    toast.promise(
      (async () => {
        const { error } = await deleteUser();
        if (error)
          throw new Error(
            error.message || t('settings.account.couldNotDelete'),
          );

        await signOut();
        router.push('/sign-up');
        router.refresh();
      })(),
      {
        loading: t('settings.account.deletingAccount'),
        success: t('settings.account.accountDeleted'),
        error: (err) => {
          setDeleting(false);
          return err instanceof Error
            ? err.message
            : t('settings.account.couldNotDeleteBang');
        },
      },
    );
  }

  return (
    <div className='space-y-4'>
      {/* Email */}
      <section className='space-y-2'>
        <div className='flex items-center gap-2'>
          <MailIcon
            className='text-muted-foreground size-4 shrink-0'
            aria-hidden
          />
          <h2 className='text-lg font-semibold tracking-tight'>
            {t('settings.account.email')}
          </h2>
        </div>
        {sessionPending ? (
          <div className='border-border bg-card flex items-center gap-3 rounded-xl border p-4'>
            <div className='space-y-1'>
              <Skeleton className='h-5 w-40' />
              <Skeleton className='h-4 w-20' />
            </div>
          </div>
        ) : session?.user ? (
          <div className='border-border bg-card flex items-center gap-3 rounded-xl border p-4'>
            <div className='min-w-0 flex-1'>
              <p className='truncate text-sm font-medium'>
                {session.user.email}
              </p>
              <p className='text-muted-foreground text-sm'>
                {isVerified
                  ? t('settings.account.verifiedText')
                  : t('settings.account.notVerifiedText')}
              </p>
            </div>
            <Button
              variant='default'
              size='sm'
              disabled={sendingVerify || isVerified}
              onClick={handleResendVerification}
            >
              {sendingVerify ? (
                <>
                  <Loader2Icon className='shrink-0 animate-spin' aria-hidden />
                  {t('settings.account.sending')}
                </>
              ) : (
                <>
                  {isVerified ? (
                    <>
                      <CheckIcon className='shrink-0' aria-hidden />
                      {t('settings.account.verifiedBtn')}
                    </>
                  ) : (
                    <>
                      <MailsIcon className='shrink-0' aria-hidden />
                      {t('settings.account.resend')}
                    </>
                  )}
                </>
              )}
            </Button>
          </div>
        ) : null}
      </section>

      <section className='space-y-2'>
        <div className='flex items-center gap-2'>
          <KeyRoundIcon
            className='text-muted-foreground size-4 shrink-0'
            aria-hidden
          />
          <h2 className='text-lg font-semibold tracking-tight'>
            {t('settings.account.changePassword')}
          </h2>
        </div>
        <form onSubmit={handleChangePassword} className='space-y-4'>
          <div className='space-y-2'>
            <Label htmlFor='current-password'>
              {t('settings.account.currentPassword')}
            </Label>
            <Input
              id='current-password'
              type='password'
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              autoComplete='current-password'
              required
            />
          </div>
          <div className='grid gap-2 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='new-password'>
                {t('settings.account.newPassword')}
              </Label>
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
              <Label htmlFor='confirm-password'>
                {t('settings.account.confirmNewPassword')}
              </Label>
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
            <Button type='submit' disabled={savingPw}>
              {savingPw ? (
                <>
                  <Loader2Icon className='shrink-0 animate-spin' aria-hidden />
                  {t('settings.account.updating')}
                </>
              ) : (
                <>
                  <SaveIcon className='shrink-0' aria-hidden />
                  {t('settings.account.update')}
                </>
              )}
            </Button>
          </div>
        </form>
      </section>

      {/* Danger zone */}
      <section className='border-destructive/40 bg-destructive/5 space-y-2 rounded-xl border p-4'>
        <div className='flex items-center gap-2'>
          <Trash2Icon className='text-destructive size-4' aria-hidden />
          <h2 className='text-destructive text-lg font-semibold tracking-tight'>
            {t('settings.account.deleteTitle')}
          </h2>
        </div>
        <p className='text-muted-foreground text-sm leading-relaxed'>
          {t('settings.account.deleteDesc')}
        </p>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant='destructive'>
              {t('settings.account.continue')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {t('settings.account.deleteDialogTitle')}
              </DialogTitle>
              <DialogDescription>
                {t('settings.account.deleteConfirmPrefix')}{' '}
                <span className='text-foreground font-semibold'>DELETE</span>{' '}
                {t('settings.account.deleteConfirmSuffix')}
              </DialogDescription>
            </DialogHeader>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder='DELETE'
              autoComplete='off'
              aria-label={t('settings.account.typeDeleteAria')}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant='outline'>
                  {t('settings.account.cancel')}
                </Button>
              </DialogClose>
              <Button
                variant='destructive'
                className='gap-2'
                disabled={deleteConfirm !== 'DELETE' || deleting}
                onClick={handleDelete}
              >
                {deleting ? (
                  <>
                    <Loader2Icon className='size-4 animate-spin' aria-hidden />
                    {t('settings.account.deleting')}
                  </>
                ) : (
                  <>{t('settings.account.delete')}</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>
    </div>
  );
}
