"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { isCommandQuestion, type Question } from "@/lib/questions";
import { localized, type Locale } from "@/lib/questions/types";

interface TutorPanelProps {
  question: Question;
  userInput: string;
  isCorrect: boolean;
  locale: Locale;
  /** Increments to force a fresh request when the same panel reuses props. */
  triggerKey: number;
}

interface Source {
  url: string;
  section: string;
}

type TutorStatus = "idle" | "streaming" | "done" | "error";

/**
 * Subscribes to /api/tutor as a Server-Sent Events stream and renders the
 * incoming text as it arrives. Auto-aborts on unmount or `triggerKey`
 * change.
 *
 * SSE events handled:
 *  - sources: render citation chips above the streamed text
 *  - delta:   append text
 *  - warning: non-fatal hint (e.g. KB not built)
 *  - done / error: terminate
 */
export function TutorPanel({
  question,
  userInput,
  isCorrect,
  locale,
  triggerKey
}: TutorPanelProps) {
  const t = useTranslations("tutor");
  const [text, setText] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [warning, setWarning] = useState<string | null>(null);
  const [status, setStatus] = useState<TutorStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setText("");
    setSources([]);
    setWarning(null);
    setError(null);
    setStatus("streaming");
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const docUrls = "docUrls" in question ? question.docUrls : undefined;
    const expected = isCommandQuestion(question)
      ? question.challenge.expected
      : "";
    const explanation = isCommandQuestion(question)
      ? localized(question.challenge.explanation, locale)
      : "";

    fetch("/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        locale,
        scenario: localized(question.scenario, locale),
        domain: question.domain,
        difficulty: question.difficulty,
        expected,
        userInput,
        isCorrect,
        explanation,
        docUrls
      }),
      signal: ctrl.signal
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setError(payload.error ?? `HTTP ${res.status}`);
          setStatus("error");
          return;
        }
        if (!res.body) {
          setError("Empty response");
          setStatus("error");
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let sep: number;
            while ((sep = buf.indexOf("\n\n")) !== -1) {
              const frame = buf.slice(0, sep);
              buf = buf.slice(sep + 2);
              for (const line of frame.split("\n")) {
                if (!line.startsWith("data:")) continue;
                const payload = line.slice(5).trim();
                if (!payload) continue;
                try {
                  const ev = JSON.parse(payload) as {
                    type: string;
                    text?: string;
                    message?: string;
                    items?: Source[];
                  };
                  if (ev.type === "delta" && ev.text) {
                    setText((t) => t + ev.text);
                  } else if (ev.type === "sources" && ev.items) {
                    setSources(ev.items);
                  } else if (ev.type === "warning" && ev.message) {
                    setWarning(ev.message);
                  } else if (ev.type === "done") {
                    setStatus("done");
                  } else if (ev.type === "error") {
                    setError(ev.message ?? "Unknown error");
                    setStatus("error");
                  }
                } catch {
                  /* ignore non-JSON keepalive */
                }
              }
            }
          }
        } catch (e) {
          if ((e as Error).name !== "AbortError") {
            setError((e as Error).message);
            setStatus("error");
          }
        }
      })
      .catch((e) => {
        if ((e as Error).name !== "AbortError") {
          setError((e as Error).message);
          setStatus("error");
        }
      });

    return () => {
      ctrl.abort();
    };
  }, [triggerKey, question, userInput, isCorrect, locale]);

  return (
    <section
      aria-labelledby="tutor-title"
      className="rounded-lg border border-terminal-accent/40 bg-terminal-accent/5 p-3 text-sm"
    >
      <header className="mb-2 flex items-center gap-2 text-xs uppercase tracking-wide text-terminal-accent">
        <span aria-hidden>🤖</span>
        <h3 id="tutor-title">{t("title")}</h3>
        {status === "streaming" && !text && (
          <span className="ml-auto animate-pulse text-terminal-dim">
            {t("loading")}
          </span>
        )}
      </header>

      {warning && (
        <div className="mb-2 rounded border border-yellow-500/40 bg-yellow-500/10 px-2 py-1 text-xs text-yellow-200">
          <strong>{t("warningPrefix")}</strong> {warning}
        </div>
      )}

      {sources.length > 0 && (
        <div className="mb-3">
          <div className="mb-1 text-xs uppercase tracking-wide text-terminal-dim">
            {t("sourcesTitle")}
          </div>
          <ol className="flex flex-wrap gap-2 text-xs">
            {sources.map((s, i) => (
              <li
                key={`${s.url}-${i}`}
                className="rounded bg-black/40 px-2 py-0.5"
              >
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-terminal-accent hover:underline"
                  title={s.url}
                >
                  [{i + 1}] {s.section}
                </a>
              </li>
            ))}
          </ol>
        </div>
      )}

      {status === "error" ? (
        <div className="space-y-2 text-terminal-ko">
          <p>
            <strong>{t("errorPrefix")}</strong> {error}
          </p>
          <Link
            href="/settings"
            className="inline-block rounded border border-terminal-ko/50 px-2 py-1 text-xs text-terminal-fg hover:border-terminal-fg"
          >
            {t("settingsCta")}
          </Link>
        </div>
      ) : (
        <div className="whitespace-pre-wrap leading-relaxed text-terminal-fg">
          <RenderTutorText text={text} sources={sources} />
          {status === "streaming" && <span className="caret" aria-hidden />}
        </div>
      )}
    </section>
  );
}

/**
 * Tiny inline-only Markdown renderer:
 *  - `code` → <code>
 *  - **bold** → <strong>
 *  - [N] when sources are available → links to the matching citation
 */
function RenderTutorText({
  text,
  sources
}: {
  text: string;
  sources: Source[];
}) {
  if (!text) return null;
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              key={i}
              className="rounded bg-black/40 px-1 py-0.5 text-terminal-accent"
            >
              {part.slice(1, -1)}
            </code>
          );
        }
        const boldParts = part.split(/(\*\*[^*]+\*\*)/g);
        return boldParts.map((bp, j) => {
          const key = `${i}-${j}`;
          if (bp.startsWith("**") && bp.endsWith("**")) {
            return <strong key={key}>{bp.slice(2, -2)}</strong>;
          }
          // Replace [N] markers with hyperlinks when we have a source for N.
          if (sources.length === 0 || !bp.includes("[")) {
            return <span key={key}>{bp}</span>;
          }
          const segments = bp.split(/(\[\d+\])/g);
          return (
            <span key={key}>
              {segments.map((seg, sIdx) => {
                const m = seg.match(/^\[(\d+)\]$/);
                if (!m) return <span key={sIdx}>{seg}</span>;
                const n = Number(m[1]);
                const src = sources[n - 1];
                if (!src) return <span key={sIdx}>{seg}</span>;
                return (
                  <a
                    key={sIdx}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`${src.section} — ${src.url}`}
                    className="text-terminal-accent hover:underline"
                  >
                    {seg}
                  </a>
                );
              })}
            </span>
          );
        });
      })}
    </>
  );
}
