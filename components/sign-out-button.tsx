'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { LogOut, Loader2 } from 'lucide-react';

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
      {children ?? 'Sign out'}
    </Button>
  );
}
