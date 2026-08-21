import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

// The canonical "nothing here yet" panel used across the app (empty rooms,
// conversations, profiles, search results, hero prompts). A single muted
// rounded-2xl icon chip with a primary-tinted glyph echoes the refined chat
// bubbles, so every blank surface reads as the same design language.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 px-6 py-12 text-center',
        className,
      )}
    >
      <div className='bg-muted ring-border/60 flex size-16 shrink-0 items-center justify-center rounded-2xl ring-1'>
        <Icon className='text-primary size-7 shrink-0' aria-hidden />
      </div>
      <div className='flex flex-col items-center gap-1.5'>
        <h2 className='text-2xl font-semibold tracking-tight text-balance'>
          {title}
        </h2>
        {description ? (
          <p className='text-muted-foreground max-w-sm text-sm text-pretty'>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className='mt-2'>{action}</div> : null}
    </div>
  );
}
