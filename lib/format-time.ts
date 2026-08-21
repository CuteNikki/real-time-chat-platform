// Human-friendly, relative message timestamps.
//
// Rules (local time):
//   * today      → time only            → "10:13 PM"
//   * yesterday  → "Yesterday at 10:13 PM"
//   * this year  → "Aug 14 at 10:13 PM"
//   * older      → "Aug 14, 2024 at 10:13 PM"

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function timeOf(d: Date): string {
  return d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

// `now` is injectable for tests; defaults to the current time.
export function formatMessageTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const today = startOfDay(now);
  const that = startOfDay(d);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((today.getTime() - that.getTime()) / dayMs);

  if (diffDays <= 0) return timeOf(d);
  if (diffDays === 1) return `Yesterday at ${timeOf(d)}`;

  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${date} at ${timeOf(d)}`;
}

// Like formatMessageTime, but a post from today reads "Today at 10:13 PM"
// rather than the bare time messages use — posts want the day spelled out so
// the top-right stamp reads consistently with "Yesterday at …"/"Aug 14 at …".
export function formatPostTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const today = startOfDay(now);
  const that = startOfDay(d);
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((today.getTime() - that.getTime()) / dayMs);

  if (diffDays <= 0) return `Today at ${timeOf(d)}`;
  if (diffDays === 1) return `Yesterday at ${timeOf(d)}`;

  const sameYear = d.getFullYear() === now.getFullYear();
  const date = d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  return `${date} at ${timeOf(d)}`;
}

// Full, unambiguous timestamp for hover tooltips (title attributes).
export function formatExactTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
