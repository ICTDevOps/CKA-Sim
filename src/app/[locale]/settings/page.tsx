"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { LocaleSwitcher } from "@/components/LocaleSwitcher";
import { Link } from "@/i18n/navigation";
import {
  ANTHROPIC_CHAT_MODELS,
  OPENROUTER_CHAT_MODELS,
  type EmbeddingProvider,
  type LlmProvider
} from "@/lib/settings/types";

interface ClientPrefs {
  llmProvider: LlmProvider;
  anthropicApiKeySet: boolean;
  anthropicModel: string;
  openrouterApiKeySet: boolean;
  openrouterModel: string;
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
  const [anthropicKeyDraft, setAnthropicKeyDraft] = useState("");
  const [openrouterKeyDraft, setOpenrouterKeyDraft] = useState("");
  const [, setSaving] = useState(false);
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
      setAnthropicKeyDraft("");
      setOpenrouterKeyDraft("");
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
          value="anthropic"
          current={prefs.llmProvider}
          label={t("providerAnthropic")}
          hint={t("providerAnthropicHint")}
          onChange={(v) => save({ llmProvider: v })}
        >
          {prefs.llmProvider === "anthropic" && (
            <ApiKeyAndModel
              keyLabel={t("anthropicApiKey")}
              keyPlaceholder={t("anthropicApiKeyPlaceholder")}
              keyStored={prefs.anthropicApiKeySet}
              keyStoredLabel={t("anthropicApiKeyStored", { masked: "sk-ant-•••" })}
              keyClearLabel={t("anthropicApiKeyClear")}
              modelLabel={t("anthropicModel")}
              models={[...ANTHROPIC_CHAT_MODELS]}
              currentModel={prefs.anthropicModel}
              draft={anthropicKeyDraft}
              setDraft={setAnthropicKeyDraft}
              onSaveKey={(k) => save({ anthropicApiKey: k })}
              onClearKey={() => save({ clearAnthropicApiKey: true })}
              onChangeModel={(m) => save({ anthropicModel: m })}
              saveLabel={t("save")}
              keyInputId="anthropic-key"
            />
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
          {prefs.llmProvider === "openrouter" && (
            <ApiKeyAndModel
              keyLabel={t("openrouterApiKey")}
              keyPlaceholder={t("openrouterApiKeyPlaceholder")}
              keyStored={prefs.openrouterApiKeySet}
              keyStoredLabel={t("openrouterApiKeyStored", { masked: "sk-or-•••" })}
              keyClearLabel={t("openrouterApiKeyClear")}
              modelLabel={t("openrouterModel")}
              models={[...OPENROUTER_CHAT_MODELS]}
              currentModel={prefs.openrouterModel}
              draft={openrouterKeyDraft}
              setDraft={setOpenrouterKeyDraft}
              onSaveKey={(k) => save({ openrouterApiKey: k })}
              onClearKey={() => save({ clearOpenrouterApiKey: true })}
              onChangeModel={(m) => save({ openrouterModel: m })}
              saveLabel={t("save")}
              keyInputId="openrouter-key"
            />
          )}
        </Radio>
      </Section>

      {/* Embeddings + RAG */}
      <Section title={t("embeddingsSection")} hint={t("embeddingsHint")}>
        <div className="space-y-2">
          {(Object.keys(EMBEDDING_LABELS) as EmbeddingProvider[]).map((key) => (
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
          ))}
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

interface ApiKeyAndModelProps {
  keyLabel: string;
  keyPlaceholder: string;
  keyStored: boolean;
  keyStoredLabel: string;
  keyClearLabel: string;
  modelLabel: string;
  models: string[];
  currentModel: string;
  draft: string;
  setDraft: (v: string) => void;
  onSaveKey: (k: string) => void;
  onClearKey: () => void;
  onChangeModel: (m: string) => void;
  saveLabel: string;
  keyInputId: string;
}

function ApiKeyAndModel(p: ApiKeyAndModelProps) {
  return (
    <div className="mt-3 space-y-3">
      <div>
        <label
          htmlFor={p.keyInputId}
          className="block text-xs text-terminal-dim"
        >
          {p.keyLabel}
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={p.keyInputId}
            type="password"
            spellCheck={false}
            autoComplete="off"
            value={p.draft}
            onChange={(e) => p.setDraft(e.target.value)}
            placeholder={p.keyPlaceholder}
            className="w-full rounded border border-terminal-dim/50 bg-black/40 px-3 py-2 text-sm outline-none focus:border-terminal-accent"
          />
          <button
            type="button"
            disabled={!p.draft}
            onClick={() => p.onSaveKey(p.draft)}
            className="rounded bg-terminal-accent px-3 py-2 text-sm font-semibold text-terminal-bg hover:opacity-90 disabled:opacity-40"
          >
            {p.saveLabel}
          </button>
        </div>
        {p.keyStored && (
          <p className="mt-1 flex items-center gap-2 text-xs text-terminal-ok">
            ✓ {p.keyStoredLabel}
            <button
              type="button"
              onClick={p.onClearKey}
              className="text-terminal-dim underline hover:text-terminal-fg"
            >
              {p.keyClearLabel}
            </button>
          </p>
        )}
      </div>
      <div>
        <label
          htmlFor={`${p.keyInputId}-model`}
          className="block text-xs text-terminal-dim"
        >
          {p.modelLabel}
        </label>
        <select
          id={`${p.keyInputId}-model`}
          value={p.currentModel}
          onChange={(e) => p.onChangeModel(e.target.value)}
          className="mt-1 w-full rounded border border-terminal-dim/50 bg-black/40 px-3 py-2 text-sm outline-none focus:border-terminal-accent"
        >
          {p.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
