import { redirect } from 'next/navigation';

import { normalizeSettingsTab } from '@/lib/settings-tabs';

// Legacy path: settings tabs moved to /app/settings?tab=… — redirect old
// /app/settings/<tab> links and bookmarks to the query-param form.
export default async function LegacySettingsTabPage({
  params,
}: {
  params: Promise<{ tab: string }>;
}) {
  const { tab } = await params;
  redirect(`/app/settings?tab=${normalizeSettingsTab(tab)}`);
}
