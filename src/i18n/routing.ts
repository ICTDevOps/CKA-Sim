import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "fr"],
  defaultLocale: "en",
  // Redirige automatiquement vers `/en` ou `/fr` selon Accept-Language au
  // premier visit, puis garde le choix via le cookie `NEXT_LOCALE`.
  localeDetection: true,
  // URLs : /en/session, /fr/session — cohérent avec le repo qui a déjà
  // l'anglais comme langue par défaut.
  localePrefix: "always"
});

export type Locale = (typeof routing.locales)[number];
