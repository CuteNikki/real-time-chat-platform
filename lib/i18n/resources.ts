import de from './locales/de.json';
import en from './locales/en.json';

// Translations are bundled statically (not lazy-loaded) so that both the
// server and the client have every string available synchronously — this keeps
// SSR output and client hydration perfectly in sync.
export const resources = {
  en: { translation: en },
  de: { translation: de },
} as const;
