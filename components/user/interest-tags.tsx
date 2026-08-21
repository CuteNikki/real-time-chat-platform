'use client';

import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  if (!interests.length) return null;
  const shown = max ? interests.slice(0, max) : interests;
  const extra = max ? interests.length - shown.length : 0;

  return (
    <ul className={cn('flex max-w-full min-w-0 flex-wrap gap-1', className)}>
      {shown.map((tag) => (
        <li key={tag} className='max-w-full min-w-0'>
          <Badge variant='secondary' className='block max-w-full truncate'>
            {tag}
          </Badge>
        </li>
      ))}
      {extra > 0 ? (
        <li>
          <Badge variant='outline'>
            {t('profile.moreInterests', { count: extra })}
          </Badge>
        </li>
      ) : null}
    </ul>
  );
}
