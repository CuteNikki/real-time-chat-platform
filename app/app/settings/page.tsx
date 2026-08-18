import { redirect } from 'next/navigation';

// /app/settings has no tab of its own — "profile" is the canonical default,
// and /app/settings/[tab] is the single source of truth for rendering.
export default function SettingsPage() {
  redirect('/app/settings/profile');
}
