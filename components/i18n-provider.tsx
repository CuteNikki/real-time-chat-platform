'use client';

import { useEffect, useState } from 'react';

import { createInstance, type i18n as I18nInstance } from 'i18next';
import { I18nextProvider, initReactI18next } from 'react-i18next';

import { resources } from '@/lib/i18n/resources';
import { getOptions, type Language } from '@/lib/i18n/settings';

// Creates one i18next instance per render tree (via useState, so it is stable
// on the client and freshly seeded per request during SSR). Because resources
// are bundled and `initImmediate` is false, initialization is synchronous —
// the correct language is ready on the very first paint, so SSR and hydration
// never disagree.
export function I18nProvider({
  lng,
  children,
}: {
  lng: Language;
  children: React.ReactNode;
}) {
  const [instance] = useState<I18nInstance>(() => {
    const i18n = createInstance();
    void i18n.use(initReactI18next).init({
      ...getOptions(lng),
      resources,
      // Synchronous init so the correct language is ready on first paint.
      initAsync: false,
    });
    return i18n;
  });

  // Keep the client instance in sync when the language changes (the switcher
  // updates the cookie and calls router.refresh(), which re-renders with a new
  // `lng`).
  useEffect(() => {
    if (instance.resolvedLanguage !== lng) void instance.changeLanguage(lng);
  }, [instance, lng]);

  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
