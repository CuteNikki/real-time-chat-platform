// Core i18n configuration shared by the server and client setups.
export const fallbackLng = 'en';
export const languages = ['en', 'de'] as const;
export type Language = (typeof languages)[number];

// Name of the cookie that stores the visitor's chosen language.
export const cookieName = 'orbit_lng';

// A single default namespace keeps imports simple; keys are nested by area.
export const defaultNS = 'translation';

// Native language labels for the switcher.
export const languageNames: Record<Language, string> = {
  en: 'English',
  de: 'Deutsch',
};

export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === 'string' &&
    (languages as readonly string[]).includes(value)
  );
}

export function getOptions(lng: Language = fallbackLng) {
  return {
    // Resources are bundled, so initialization is synchronous.
    supportedLngs: languages,
    fallbackLng,
    lng,
    defaultNS,
    ns: defaultNS,
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  };
}
