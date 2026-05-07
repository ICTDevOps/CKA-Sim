"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

interface SourcePublic {
  id: string;
  url: string;
  displayName: string | null;
  status: "pending" | "ok" | "error";
  error: string | null;
  chunkCount: number;
  lastFetchedAt: number | null;
  addedAt: number;
}

/**
 * Settings widget for managing user-added web sources for the RAG.
 * Lives inside /settings; talks to /api/sources.
 */
export function SourcesPanel() {
  const t = useTranslations("settings");
  const [sources, setSources] = useState<SourcePublic[] | null>(null);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | "add" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/sources");
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(payload.error ?? `HTTP ${res.status}`);
        setSources([]);
        return;
      }
      const data = (await res.json()) as { sources: SourcePublic[] };
      setSources(data.sources);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      setSources([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!url.trim()) return;
    setBusy("add");
    setError(null);
    try {
      const res = await fetch("/api/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), displayName: name.trim() })
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(payload.error ?? `HTTP ${res.status}`);
      } else {
        setUrl("");
        setName("");
        await load();
      }
    } finally {
      setBusy(null);
    }
  }

  async function refresh(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/sources/${id}/refresh`, { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/sources/${id}`, { method: "DELETE" });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mb-6 rounded-lg border border-terminal-dim/40 bg-black/30 p-5">
      <h2 className="text-base font-semibold text-terminal-fg">
        {t("sourcesSection")}
      </h2>
      <p className="mt-1 mb-4 max-w-prose text-xs text-terminal-dim">
        {t("sourcesHint")}
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <input
          type="url"
          spellCheck={false}
          autoComplete="off"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("sourcesAddPlaceholder")}
          className="rounded border border-terminal-dim/50 bg-black/40 px-3 py-2 text-sm outline-none focus:border-terminal-accent"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("sourcesNamePlaceholder")}
          className="rounded border border-terminal-dim/50 bg-black/40 px-3 py-2 text-sm outline-none focus:border-terminal-accent"
        />
        <button
          type="button"
          onClick={add}
          disabled={busy === "add" || !url.trim()}
          className="rounded bg-terminal-accent px-3 py-2 text-sm font-semibold text-terminal-bg hover:opacity-90 disabled:opacity-40"
        >
          {busy === "add" ? t("sourcesAdding") : t("sourcesAdd")}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded border border-terminal-ko/50 bg-terminal-ko/10 px-2 py-1 text-xs text-terminal-ko">
          {error}
        </p>
      )}

      {sources && sources.length === 0 && (
        <p className="text-xs text-terminal-dim">{t("sourcesEmpty")}</p>
      )}

      {sources && sources.length > 0 && (
        <ul className="divide-y divide-terminal-dim/30 overflow-hidden rounded border border-terminal-dim/30 text-sm">
          {sources.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-terminal-fg">
                  {s.displayName || s.url}
                </div>
                {s.displayName && (
                  <div className="truncate text-xs text-terminal-dim">
                    {s.url}
                  </div>
                )}
                <div className="text-xs">
                  {s.status === "ok" ? (
                    <span className="text-terminal-dim">
                      {t("sourcesStatusOk", {
                        n: s.chunkCount,
                        when: s.lastFetchedAt
                          ? new Date(s.lastFetchedAt).toLocaleString()
                          : t("sourcesNeverFetched")
                      })}
                    </span>
                  ) : s.status === "pending" ? (
                    <span className="text-yellow-300">
                      {t("sourcesStatusPending")}
                    </span>
                  ) : (
                    <span className="text-terminal-ko">
                      {t("sourcesStatusError", {
                        error: s.error ?? "unknown"
                      })}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => refresh(s.id)}
                  disabled={busy === s.id}
                  className="rounded border border-terminal-dim/60 px-2 py-1 hover:border-terminal-fg disabled:opacity-40"
                >
                  {t("sourcesRefresh")}
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={busy === s.id}
                  className="rounded border border-terminal-ko/50 px-2 py-1 text-terminal-ko hover:border-terminal-ko disabled:opacity-40"
                >
                  {t("sourcesDelete")}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
