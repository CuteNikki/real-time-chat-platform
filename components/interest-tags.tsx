import { cn } from "@/lib/utils"

// Read-only display of interest tags as small pills.
export function InterestTags({
  interests,
  className,
  max,
}: {
  interests: string[]
  className?: string
  max?: number
}) {
  if (!interests.length) return null
  const shown = max ? interests.slice(0, max) : interests
  const extra = max ? interests.length - shown.length : 0

  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)}>
      {shown.map((tag) => (
        <li
          key={tag}
          className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
        >
          {tag}
        </li>
      ))}
      {extra > 0 ? (
        <li className="rounded-full px-2 py-0.5 text-xs font-medium text-muted-foreground">
          +{extra}
        </li>
      ) : null}
    </ul>
  )
}
