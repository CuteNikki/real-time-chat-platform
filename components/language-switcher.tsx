'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { CheckIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  cookieName,
  languageNames,
  languages,
  type Language,
} from '@/lib/i18n/settings';
import { cn } from '@/lib/utils';

// Persists the choice in a cookie and calls router.refresh() so server
// components re-render in the new language; the client instance switches
// immediately via i18n.changeLanguage.
export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = (i18n.resolvedLanguage ?? 'en') as Language;

  function change(lng: Language) {
    if (lng === current) return;
    document.cookie = `${cookieName}=${lng}; path=/; max-age=31536000; SameSite=Lax`;
    void i18n.changeLanguage(lng);
    startTransition(() => router.refresh());
  }

  return (
    <div className='flex flex-wrap gap-2'>
      {languages.map((lng) => {
        const active = lng === current;
        return (
          <button
            key={lng}
            type='button'
            onClick={() => change(lng)}
            disabled={pending}
            aria-pressed={active}
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-60',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {active ? <CheckIcon className='size-4' aria-hidden /> : null}
            {languageNames[lng]}
          </button>
        );
      })}
    </div>
  );
}
