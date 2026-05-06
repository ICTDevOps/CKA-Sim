"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";

export default function AboutPage() {
  const t = useTranslations("about");
  const tCommon = useTranslations("common");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">{t("title")}</h1>
        <LocaleSwitcher />
      </header>

      <section className="space-y-4 text-sm leading-relaxed">
        <p>
          {t.rich("intro", {
            localFirst: (chunks) => <strong>{chunks}</strong>
          })}
        </p>

        <h2 className="pt-4 text-lg font-semibold">{t("roadmapTitle")}</h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>{t("sprint1")}</li>
          <li>{t("sprint2")}</li>
          <li>{t("sprint3")}</li>
          <li>{t("sprint4")}</li>
          <li>{t("sprint5")}</li>
          <li>{t("sprint6")}</li>
        </ol>

        <p className="pt-4">
          <Link
            href="/"
            className="text-terminal-accent underline hover:opacity-90"
          >
            ← {tCommon("home")}
          </Link>
        </p>
      </section>
    </main>
  );
}
