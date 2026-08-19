'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR from 'swr';

import {
  HomeIcon,
  LogOutIcon,
  MessageCircleIcon,
  OrbitIcon,
  SettingsIcon,
  ShieldIcon,
  ShuffleIcon,
  User2Icon,
  UserPlus2Icon,
  Users2Icon,
} from 'lucide-react';

import { authClient } from '@/lib/auth-client';
import { cn } from '@/lib/utils';

import { NotificationBell } from '@/components/notification-bell';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from '@/components/user-avatar';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const links = [
  { href: '/app/feed', label: 'Feed', icon: HomeIcon, exact: false },
  { href: '/app/match', label: 'Match', icon: ShuffleIcon, exact: false },
  { href: '/app/rooms', label: 'Rooms', icon: Users2Icon, exact: false },
  {
    href: '/app/messages',
    label: 'Messages',
    icon: MessageCircleIcon,
    exact: false,
  },
  { href: '/app/friends', label: 'Friends', icon: UserPlus2Icon, exact: false },
];

export function AppNav({
  user,
  hideBorder = false,
}: {
  user: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null;
    username?: string | null;
    bio?: string | null;
    role: 'ADMIN' | 'MODERATOR' | 'MEMBER';
  };
  hideBorder?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  // Poll pending friend requests for the badge; realtime events also revalidate this.
  const { data } = useSWR<{ count: number }>(
    '/api/invites/pending-count',
    fetcher,
    {
      refreshInterval: 15000,
    },
  );
  const pendingInvites = data?.count ?? 0;

  async function signOut() {
    await authClient.signOut();
    router.push('/');
    router.refresh();
  }

  const profileHref = user.username
    ? `/app/u/${user.username}`
    : '/app/settings';

  return (
    <header
      className={cn(
        'bg-background/70 fixed inset-x-0 top-0 z-50 backdrop-blur-md',
        hideBorder ? '' : 'border-b',
      )}
    >
      <div className='xs:p-6 mx-auto flex w-full max-w-7xl items-center justify-between p-4'>
        <Link href='/' className='flex items-center gap-2'>
          <OrbitIcon className='text-primary size-6' aria-hidden />
          <span className='text-lg font-semibold tracking-tight'>Orbit</span>
        </Link>

        <nav className='hidden items-center gap-1 md:flex'>
          {links.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : pathname.startsWith(link.href);
            const Icon = link.icon;
            const showBadge =
              link.href === '/app/friends' && pendingInvites > 0;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  buttonVariants({ variant: active ? 'secondary' : 'ghost' }),
                )}
              >
                <Icon className='size-4' aria-hidden />
                <span className='hidden md:inline'>{link.label}</span>
                {showBadge && (
                  <Badge
                    className='ml-0.5 h-5 min-w-5 justify-center px-1 tabular-nums'
                    variant='default'
                  >
                    {pendingInvites}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>

        <div className='flex items-center gap-1'>
          <NotificationBell userId={user.id} username={user.username ?? null} />
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}
            >
              <UserAvatar
                name={user.name}
                image={user.image}
                className='size-8 text-xs'
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-64'>
              {/* Profile header: avatar + name/handle aligned with the items below. */}
              <div className='flex items-center gap-3 p-2'>
                <UserAvatar
                  name={user.name}
                  image={user.image}
                  className='size-10 text-sm'
                />
                <div className='flex min-w-0 flex-col'>
                  <span className='truncate text-sm font-medium'>
                    {user.name}
                  </span>
                  <span className='text-muted-foreground truncate text-xs'>
                    {user.username ? `@${user.username}` : user.email}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href={profileHref}>
                  <User2Icon aria-hidden />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href='/app/settings'>
                  <SettingsIcon aria-hidden />
                  Settings
                </Link>
              </DropdownMenuItem>
              {(user.role === 'ADMIN' || user.role === 'MODERATOR') && (
                <DropdownMenuItem asChild>
                  <Link href='/app/admin'>
                    <ShieldIcon aria-hidden />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} variant='destructive'>
                <LogOutIcon aria-hidden />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

export function MobileBottomNav() {
  const pathname = usePathname();

  const { data } = useSWR<{ count: number }>(
    '/api/invites/pending-count',
    fetcher,
    {
      refreshInterval: 15000,
    },
  );
  const pendingInvites = data?.count ?? 0;

  return (
    <nav
      aria-label='Primary'
      className='border-border bg-background/70 fixed inset-x-0 bottom-0 z-50 flex shrink-0 items-stretch justify-around border-t backdrop-blur-md md:hidden'
    >
      {links.map((link) => {
        const active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href);
        const Icon = link.icon;
        const showBadge = link.href === '/app/friends' && pendingInvites > 0;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium transition-colors',
              active
                ? 'text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span className='relative'>
              <Icon className='size-4' aria-hidden />
              {showBadge && (
                <Badge
                  className='absolute -top-1.5 -right-2 h-4 min-w-4 justify-center px-1 text-[10px] tabular-nums'
                  variant='default'
                >
                  {pendingInvites}
                </Badge>
              )}
            </span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
