import { cache } from 'react';

import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

// Memoized per request so the several getCurrentUser/getUserId callers in one
// render or action share a single session lookup instead of repeating it.
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function getUserId() {
  const session = await getSession();
  if (!session?.user) throw new Error('Unauthorized');
  return session.user.id;
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user) throw new Error('Unauthorized');
  return session.user;
}

// Non-throwing variant for routes that gracefully degrade when signed out.
export async function getCurrentUserOrNull() {
  const session = await getSession();
  return session?.user ?? null;
}
