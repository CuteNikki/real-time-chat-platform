// Plain constants/types shared between the settings route
// (app/app/settings/page.tsx) and the client tab component
// (components/settings/settings-tabs.tsx). Kept out of the 'use client' file so
// a server component can import it directly without crossing a client module
// boundary, which does not reliably serialize plain array/type exports.

export const SETTINGS_TABS = [
  'profile',
  'account',
  'privacy',
  'preferences',
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const DEFAULT_SETTINGS_TAB: SettingsTab = 'profile';

export function isSettingsTab(
  value: string | null | undefined,
): value is SettingsTab {
  return (
    typeof value === 'string' &&
    (SETTINGS_TABS as readonly string[]).includes(value)
  );
}

// Coerce an arbitrary URL value to a valid tab, defaulting to profile.
export function normalizeSettingsTab(
  value: string | null | undefined,
): SettingsTab {
  return isSettingsTab(value) ? value : DEFAULT_SETTINGS_TAB;
}
