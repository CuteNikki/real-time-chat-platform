'use client';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { Loader2, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

export function SignOutButton({
  className,
  variant = 'outline',
  children,
}: {
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary' | 'destructive';
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

  async function signOut() {
    setLoading(true);
    try {
      await authClient.signOut();
      router.push('/');
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      className={className}
      onClick={signOut}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className='size-4 animate-spin' aria-hidden />
      ) : (
        <LogOut className='size-4' aria-hidden />
      )}
      {children ?? t('auth.signOut')}
    </Button>
  );
}
