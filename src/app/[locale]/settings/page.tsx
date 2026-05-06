"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Link } from "@/i18n/navigation";
import {
  OPENROUTER_CHAT_MODELS,
  type EmbeddingProvider,
  type LlmProvider
} from "@/lib/settings/types";

interface ClientPrefs {
  llmProvider: LlmProvider;
  openrouterApiKeySet: boolean;
  openrouterModel: string;
  claudeOauthLinked: boolean;
  embeddingProvider: EmbeddingProvider;
  aiTutorEnabled: boolean;
  examMode: boolean;
  ragEnabled: boolean;
}

const EMBEDDING_LABELS: Record<EmbeddingProvider, string> = {
  "local-bge-small": "embeddingLocal",
  "openrouter-text-embedding-3-small": "embeddingOpenAi3Small",
  "openrouter-text-embedding-3-large": "embeddingOpenAi3Large",
  "openrouter-qwen3-embedding-0-6b": "embeddingQwen3"
};

export default function SettingsPage() {
  const t = useTranslations("settings");
  const [prefs, setPrefs] = useState<ClientPrefs | null>(null);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<"saved" | "error" | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: { prefs: ClientPrefs }) => setPrefs(d.prefs))
      .catch(() => setFlash("error"));
  }, []);

  async function save(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      if (!res.ok) throw new Error(String(res.status));
      const { prefs: updated } = (await res.json()) as {
        prefs: ClientPrefs;
      };
      setPrefs(updated);
      setApiKeyDraft("");
      setFlash("saved");
    } catch {
      setFlash("error");
    } finally {
      setSaving(false);
      setTimeout(() => setFlash(null), 2500);
    }
  }

  if (!prefs) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12 text-terminal-dim">
        …
      </main>
    );
  }

  const isOpenRouter = prefs.llmProvider === "openrouter";

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{t("title")}</h1>
          <p className="mt-1 max-w-prose text-sm text-terminal-dim">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded border border-terminal-dim/60 px-3 py-2 text-sm hover:border-terminal-fg"
          >
            ←
          </Link>
          <LocaleSwitcher />
        </div>
      </header>

      <div className="mb-4 rounded-lg border border-terminal-dim/40 bg-black/30 p-3 text-xs text-terminal-dim">
        {t("futureNotice")}
      </div>

      {/* AI tutor master toggle */}
      <Section title={t("tutorSection")}>
        <Toggle
          label={t("tutorEnabled")}
          hint={t("tutorEnabledHint")}
          checked={prefs.aiTutorEnabled}
          onChange={(v) => save({ aiTutorEnabled: v })}
        />
        <Toggle
          label={t("examMode")}
          hint={t("examModeHint")}
          checked={prefs.examMode}
          onChange={(v) => save({ examMode: v })}
        />
      </Section>

      {/* LLM provider */}
      <Section title={t("providerSection")} hint={t("providerHint")}>
        <Radio
          name="llmProvider"
          value="claude-oauth"
          current={prefs.llmProvider}
          label={t("providerClaude")}
          hint={t("providerClaudeHint")}
          onChange={(v) => save({ llmProvider: v })}
        >
          {prefs.llmProvider === "claude-oauth" && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              {prefs.claudeOauthLinked ? (
                <>
                  <span className="text-terminal-ok">
                    ✓ {t("providerClaudeLinked")}
                  </span>
                  <button
                    type="button"
                    onClick={() => save({ claudeOauthLinked: false })}
                    className="text-terminal-dim underline hover:text-terminal-fg"
                  >
                    {t("providerClaudeUnlink")}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled
                  className="cursor-not-allowed rounded border border-terminal-dim/60 px-3 py-1 text-terminal-dim"
                  title="Sprint 3"
                >
                  {t("providerClaudeLink")} (Sprint 3)
                </button>
              )}
            </div>
          )}
        </Radio>

        <Radio
          name="llmProvider"
          value="openrouter"
          current={prefs.llmProvider}
          label={t("providerOpenrouter")}
          hint={t("providerOpenrouterHint")}
          onChange={(v) => save({ llmProvider: v })}
        >
          {isOpenRouter && (
            <div className="mt-3 space-y-3">
              <div>
                <label
                  htmlFor="or-key"
                  className="block text-xs text-terminal-dim"
                >
                  {t("openrouterApiKey")}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="or-key"
                    type="password"
                    spellCheck={false}
                    autoComplete="off"
                    value={apiKeyDraft}
                    onChange={(e) => setApiKeyDraft(e.target.value)}
                    placeholder={t("openrouterApiKeyPlaceholder")}
                    className="w-full rounded border border-terminal-dim/50 bg-black/40 px-3 py-2 text-sm outline-none focus:border-terminal-accent"
                  />
                  <button
                    type="button"
                    disabled={!apiKeyDraft || saving}
                    onClick={() =>
                      save({ openrouterApiKey: apiKeyDraft })
                    }
                    className="rounded bg-terminal-accent px-3 py-2 text-sm font-semibold text-terminal-bg hover:opacity-90 disabled:opacity-40"
                  >
                    {t("save")}
                  </button>
                </div>
                {prefs.openrouterApiKeySet && (
                  <p className="mt-1 flex items-center gap-2 text-xs text-terminal-ok">
                    ✓ {t("openrouterApiKeyStored", { masked: "sk-or-•••" })}
                    <button
                      type="button"
                      onClick={() => save({ clearOpenrouterApiKey: true })}
                      className="text-terminal-dim underline hover:text-terminal-fg"
                    >
                      {t("openrouterApiKeyClear")}
                    </button>
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="or-model"
                  className="block text-xs text-terminal-dim"
                >
                  {t("openrouterModel")}
                </label>
                <select
                  id="or-model"
                  value={prefs.openrouterModel}
                  onChange={(e) =>
                    save({ openrouterModel: e.target.value })
                  }
                  className="mt-1 w-full rounded border border-terminal-dim/50 bg-black/40 px-3 py-2 text-sm outline-none focus:border-terminal-accent"
                >
                  {OPENROUTER_CHAT_MODELS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </Radio>
      </Section>

      {/* Embeddings + RAG */}
      <Section
        title={t("embeddingsSection")}
        hint={t("embeddingsHint")}
      >
        <div className="space-y-2">
          {(Object.keys(EMBEDDING_LABELS) as EmbeddingProvider[]).map(
            (key) => (
              <Radio
                key={key}
                name="embeddingProvider"
                value={key}
                current={prefs.embeddingProvider}
                label={t(EMBEDDING_LABELS[key])}
                onChange={(v) =>
                  save({ embeddingProvider: v as EmbeddingProvider })
                }
              />
            )
          )}
        </div>
        <div className="mt-3">
          <Toggle
            label={t("ragEnabled")}
            hint={t("ragEnabledHint")}
            checked={prefs.ragEnabled}
            onChange={(v) => save({ ragEnabled: v })}
          />
        </div>
      </Section>

      {flash && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 rounded border px-3 py-2 text-sm ${
            flash === "saved"
              ? "border-terminal-ok/60 bg-terminal-ok/10 text-terminal-ok"
              : "border-terminal-ko/60 bg-terminal-ko/10 text-terminal-ko"
          }`}
        >
          {flash === "saved" ? t("saved") : t("saveError")}
        </div>
      )}
    </main>
  );
}

function Section({
  title,
  hint,
  children
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-lg border border-terminal-dim/40 bg-black/30 p-5">
      <h2 className="text-base font-semibold text-terminal-fg">{title}</h2>
      {hint && (
        <p className="mt-1 mb-4 max-w-prose text-xs text-terminal-dim">
          {hint}
        </p>
      )}
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 cursor-pointer accent-terminal-accent"
      />
      <span>
        <span className="text-terminal-fg">{label}</span>
        {hint && (
          <span className="block text-xs text-terminal-dim">{hint}</span>
        )}
      </span>
    </label>
  );
}

function Radio<T extends string>({
  name,
  value,
  current,
  label,
  hint,
  onChange,
  children
}: {
  name: string;
  value: T;
  current: T;
  label: string;
  hint?: string;
  onChange: (v: T) => void;
  children?: React.ReactNode;
}) {
  const active = value === current;
  return (
    <div
      className={`rounded border p-3 transition-colors ${
        active
          ? "border-terminal-accent/70 bg-terminal-accent/5"
          : "border-terminal-dim/30 hover:border-terminal-dim/60"
      }`}
    >
      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="radio"
          name={name}
          value={value}
          checked={active}
          onChange={() => onChange(value)}
          className="mt-1 h-4 w-4 cursor-pointer accent-terminal-accent"
        />
        <span>
          <span className="text-terminal-fg">{label}</span>
          {hint && (
            <span className="block text-xs text-terminal-dim">{hint}</span>
          )}
        </span>
      </label>
      {children}
    </div>
  );
}
