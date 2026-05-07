import type { NextRequest } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { getEmbeddingProviderForUser } from "@/lib/embeddings";
import { LlmConfigError, getProviderForUser } from "@/lib/llm";
import {
  KbProviderMismatchError,
  KbUnavailableError,
  retrieve,
  type RetrievedChunk
} from "@/lib/kb/retrieve";
import { getPrefs } from "@/lib/settings/repository";
import { buildTutorMessages } from "@/lib/tutor";

export const runtime = "nodejs";

interface ExplainBody {
  locale?: "en" | "fr";
  scenario?: string;
  domain?: string;
  difficulty?: number;
  expected?: string;
  userInput?: string;
  isCorrect?: boolean;
  explanation?: string;
  docUrls?: string[];
}

/**
 * Streams the AI tutor's explanation as Server-Sent Events.
 *
 * Frame format:
 *   data: {"type":"sources","items":[{...}]}\n\n   (zero or one, before deltas)
 *   data: {"type":"delta","text":"..."}\n\n        (zero or more)
 *   data: {"type":"done"}\n\n                       (terminator on success)
 *   data: {"type":"error","message":"..."}\n\n     (terminator on failure)
 *   data: {"type":"warning","message":"..."}\n\n   (non-fatal, surfaces UI hint)
 */
export async function POST(req: NextRequest) {
  const userId = await requireLocalUserId();
  if (!userId) return jsonError("no_user", 401);

  const prefs = getPrefs(userId);
  if (prefs.examMode) return jsonError("exam_mode_active", 409);
  if (!prefs.aiTutorEnabled) return jsonError("tutor_disabled", 409);

  const body = (await req.json().catch(() => ({}))) as ExplainBody;
  if (
    !body.scenario ||
    !body.domain ||
    typeof body.difficulty !== "number" ||
    !body.expected ||
    typeof body.isCorrect !== "boolean"
  ) {
    return jsonError("bad_payload", 400);
  }

  let provider;
  try {
    provider = getProviderForUser(userId);
  } catch (e) {
    if (e instanceof LlmConfigError) {
      return jsonError(e.message, 400);
    }
    throw e;
  }

  // ── RAG retrieval (optional, best-effort)
  // We never fail the tutor on retrieval issues — surface them as warning
  // SSE events and proceed without RAG. The KB might just not be built yet.
  const ragQuery = `${body.scenario}\nExpected: ${body.expected}\nUser typed: ${body.userInput ?? ""}`;
  let ragChunks: RetrievedChunk[] = [];
  let ragWarning: string | null = null;

  if (prefs.ragEnabled) {
    try {
      const embedProvider = getEmbeddingProviderForUser(userId);
      const result = await retrieve(ragQuery, embedProvider, 5);
      ragChunks = result.chunks;
    } catch (e) {
      if (
        e instanceof KbUnavailableError ||
        e instanceof KbProviderMismatchError
      ) {
        ragWarning = e.message;
      } else {
        ragWarning = `Retrieval failed: ${(e as Error).message}`;
      }
    }
  }

  const messages = buildTutorMessages({
    locale: body.locale === "fr" ? "fr" : "en",
    scenario: body.scenario,
    domain: body.domain,
    difficulty: body.difficulty,
    expected: body.expected,
    userInput: body.userInput ?? "",
    isCorrect: body.isCorrect,
    explanation: body.explanation,
    docUrls: body.docUrls,
    ragChunks: ragChunks.map((c) => ({
      sourceUrl: c.sourceUrl,
      sourceSection: c.sourceSection,
      content: c.content
    }))
  });

  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      try {
        if (ragChunks.length > 0) {
          send({
            type: "sources",
            items: ragChunks.map((c) => ({
              url: c.sourceUrl,
              section: c.sourceSection
            }))
          });
        }
        if (ragWarning) {
          send({ type: "warning", message: ragWarning });
        }

        for await (const ev of provider.stream({
          messages,
          signal: abort.signal,
          maxTokens: 600,
          temperature: 0.4
        })) {
          send(ev);
          if (ev.type === "done" || ev.type === "error") break;
        }
      } catch (e) {
        send({
          type: "error",
          message: `Tutor crashed: ${(e as Error).message}`
        });
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
