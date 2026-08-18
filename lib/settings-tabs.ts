// Plain constants/types shared between the server route
// (app/app/settings/[tab]/page.tsx) and the client tab component
// (components/settings-tabs.tsx). Kept out of the 'use client' file so a
// server component can import it directly without crossing a client module
// boundary, which does not reliably serialize plain array/type exports.

export const SETTINGS_TABS = [
  'profile',
  'account',
  'privacy',
  'preferences',
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];
