import 'server-only';

import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import { createInstance, type TFunction } from 'i18next';

import { resources } from './resources';
import {
  cookieName,
  fallbackLng,
  getOptions,
  isLanguage,
  type Language,
} from './settings';

// Resolve the active language from the cookie, falling back to the browser's
// Accept-Language header and finally the default. Cached per request.
export const detectLanguage = cache(async (): Promise<Language> => {
  const store = await cookies();
  const fromCookie = store.get(cookieName)?.value;
  if (isLanguage(fromCookie)) return fromCookie;

  const accept = (await headers()).get('accept-language');
  if (accept) {
    for (const part of accept.split(',')) {
      const code = part.split(';')[0]?.trim().slice(0, 2).toLowerCase();
      if (isLanguage(code)) return code;
    }
  }
  return fallbackLng;
});

// One i18next instance per language, memoized for the lifetime of the request.
const getInstance = cache(async (lng: Language) => {
  const instance = createInstance();
  await instance.init({ ...getOptions(lng), resources });
  return instance;
});

// Translation helper for server components. Returns a `t` bound to the current
// language plus the resolved language code (useful for <html lang>).
export async function getTranslation(): Promise<{
  t: TFunction;
  lng: Language;
}> {
  const lng = await detectLanguage();
  const instance = await getInstance(lng);
  return { t: instance.getFixedT(lng, null), lng };
}
