"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type Locale } from "@/i18n/routing";

/**
 * Toggles between EN and FR. Uses next-intl's locale-aware router so the
 * destination URL keeps the same path with the new locale segment, and the
 * NEXT_LOCALE cookie is updated for future direct visits.
 */
export function LocaleSwitcher() {
  const t = useTranslations("language");
  const current = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(locale: Locale) {
    if (locale === current) return;
    startTransition(() => {
      router.replace(pathname, { locale });
    });
  }

  return (
    <div
      role="group"
      aria-label="Language"
      className="inline-flex overflow-hidden rounded border border-terminal-dim/50 text-xs"
    >
      {routing.locales.map((locale) => {
        const active = locale === current;
        const label =
          locale === "en" ? t("english") : t("french");
        return (
          <button
            key={locale}
            type="button"
            onClick={() => switchTo(locale)}
            disabled={pending}
            aria-pressed={active}
            aria-label={t("switchTo", { locale: label })}
            className={
              "px-2 py-1 transition-colors " +
              (active
                ? "bg-terminal-accent text-terminal-bg"
                : "text-terminal-dim hover:text-terminal-fg")
            }
          >
            {locale.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
