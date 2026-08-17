// Pure, client-safe role helpers. No server-only imports live here so this
// module can be pulled into Client Components (e.g. the admin role picker).
// Server-only guards that hit the DB/session live in `lib/roles-server.ts`.

export type Role = 'ADMIN' | 'MODERATOR' | 'MEMBER';

export const ROLES: Role[] = ['ADMIN', 'MODERATOR', 'MEMBER'];

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Admin',
  MODERATOR: 'Moderator',
  MEMBER: 'Member',
};

// Higher number = more privilege.
const RANK: Record<Role, number> = {
  MEMBER: 0,
  MODERATOR: 1,
  ADMIN: 2,
};

export function normalizeRole(value: string | null | undefined): Role {
  return value === 'ADMIN' || value === 'MODERATOR' ? value : 'MEMBER';
}

export function atLeast(role: Role, minimum: Role): boolean {
  return RANK[role] >= RANK[minimum];
}

// Group chats can be created by moderators and admins.
export function canCreateGroups(role: Role): boolean {
  return atLeast(role, 'MODERATOR');
}

// Only admins can manage roles.
export function canManageRoles(role: Role): boolean {
  return role === 'ADMIN';
}
