"use client"

// Renders an ISO timestamp in the viewer's local timezone. Uses
// suppressHydrationWarning because the server renders in its own timezone and
// the client re-renders in the user's — a deliberate, harmless mismatch.
export function LocalTime({
  iso,
  dateOnly = false,
  className,
}: {
  iso: string
  dateOnly?: boolean
  className?: string
}) {
  const d = new Date(iso)
  const formatted = dateOnly
    ? d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
    : d.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
  return (
    <time dateTime={iso} className={className} suppressHydrationWarning>
      {formatted}
    </time>
  )
}
