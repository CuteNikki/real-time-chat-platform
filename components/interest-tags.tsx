import { cn } from '@/lib/utils';

// Read-only display of interest tags as small pills.
export function InterestTags({
  interests,
  className,
  max,
}: {
  interests: string[];
  className?: string;
  max?: number;
}) {
  if (!interests.length) return null;
  const shown = max ? interests.slice(0, max) : interests;
  const extra = max ? interests.length - shown.length : 0;

  return (
    <ul className={cn('flex flex-wrap gap-1.5', className)}>
      {shown.map((tag) => (
        <li
          key={tag}
          className='bg-secondary text-secondary-foreground rounded-full px-2.5 py-0.5 text-xs font-medium'
        >
          {tag}
        </li>
      ))}
      {extra > 0 ? (
        <li className='text-muted-foreground rounded-full px-2 py-0.5 text-xs font-medium'>
          +{extra}
        </li>
      ) : null}
    </ul>
  );
}
