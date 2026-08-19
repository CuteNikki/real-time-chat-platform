import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';

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
    <ul className={cn('flex flex-wrap gap-1', className)}>
      {shown.map((tag) => (
        <li key={tag}>
          <Badge variant='secondary'>{tag}</Badge>
        </li>
      ))}
      {extra > 0 ? (
        <li>
          <Badge variant='outline'>+{extra} more</Badge>
        </li>
      ) : null}
    </ul>
  );
}
