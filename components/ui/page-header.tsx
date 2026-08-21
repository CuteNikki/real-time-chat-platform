import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

// Shared page title block for the top of each app screen. Standardises the
// heading scale, semantics (a real <h1>), and description treatment so Feed,
// Friends, Settings, and Admin no longer drift apart.
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className='flex items-start justify-between gap-3'>
        <h1 className='text-2xl font-semibold tracking-tight text-balance'>
          {title}
        </h1>
        {action ? <div className='shrink-0'>{action}</div> : null}
      </div>
      {description ? (
        <p className='text-muted-foreground text-sm text-pretty'>
          {description}
        </p>
      ) : null}
    </div>
  );
}
