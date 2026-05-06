"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { loadAllQuestions } from "@/lib/questions";

const TOTAL = loadAllQuestions().length;

export default function HomePage() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold text-terminal-fg">
          {tCommon("appName")}
        </h1>
        <LocaleSwitcher />
      </header>

      <p className="mb-2 text-terminal-dim">
        {t.rich("tagline", {
          abbr: (chunks) => (
            <abbr title={tCommon("appAbbr")}>{chunks}</abbr>
          )
        })}
      </p>
      <p className="mb-8 text-terminal-dim">{t("intro")}</p>

      <section className="mb-8 space-y-3 rounded-lg border border-terminal-dim/40 bg-black/30 p-5 text-sm">
        <h2 className="text-base font-semibold text-terminal-fg">
          {t("whyTitle")}
        </h2>
        <p>
          {t.rich("whyP1", {
            c: (chunks) => (
              <code className="text-terminal-accent">{chunks}</code>
            )
          })}
        </p>
        <p>{t("whyP2")}</p>
      </section>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/session"
          className="rounded bg-terminal-accent px-5 py-3 font-semibold text-terminal-bg hover:opacity-90"
        >
          {t("startSession")}
        </Link>
        <Link
          href="/dashboard"
          className="rounded border border-terminal-dim/60 px-5 py-3 hover:border-terminal-fg"
        >
          {t("viewDashboard")}
        </Link>
        <p className="text-sm text-terminal-dim">
          {t("questionCount", { count: TOTAL, limit: 60 })}
        </p>
      </div>

      <footer className="mt-16 text-xs text-terminal-dim">
        <p>
          {t("footerStatus")}{" "}
          <a
            href="https://github.com/ictdevops/cka-sim"
            className="underline hover:text-terminal-fg"
          >
            {t("sourceLink")}
          </a>{" "}
          ·{" "}
          <Link
            href="/about"
            className="underline hover:text-terminal-fg"
          >
            {t("roadmapLink")}
          </Link>
        </p>
      </footer>
    </main>
  );
}
