import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  changePassword,
  requestPasswordReset,
  resetPassword,
  deleteUser,
} = authClient;
