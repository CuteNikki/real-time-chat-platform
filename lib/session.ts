import { auth } from '@/lib/auth';
import { headers } from 'next/headers';

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

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
