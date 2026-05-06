import type { NextRequest } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { LlmConfigError, getProviderForUser } from "@/lib/llm";
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
 *   data: {"type":"delta","text":"..."}\n\n     (zero or more)
 *   data: {"type":"done"}\n\n                    (exactly one — terminator)
 *   data: {"type":"error","message":"..."}\n\n  (instead of done on failure)
 *
 * Why SSE rather than plain chunked JSON: the browser's EventSource API and
 * fetch streams handle SSE naturally, and the typed event-payload makes
 * client-side parsing trivial. The tutor is read-only, no need for WebSocket.
 */
export async function POST(req: NextRequest) {
  const userId = await requireLocalUserId();
  if (!userId) {
    return jsonError("no_user", 401);
  }

  // Respect the user's master toggles. Exam mode beats everything.
  const prefs = getPrefs(userId);
  if (prefs.examMode) {
    return jsonError("exam_mode_active", 409);
  }
  if (!prefs.aiTutorEnabled) {
    return jsonError("tutor_disabled", 409);
  }

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

  const messages = buildTutorMessages({
    locale: body.locale === "fr" ? "fr" : "en",
    scenario: body.scenario,
    domain: body.domain,
    difficulty: body.difficulty,
    expected: body.expected,
    userInput: body.userInput ?? "",
    isCorrect: body.isCorrect,
    explanation: body.explanation,
    docUrls: body.docUrls
  });

  const encoder = new TextEncoder();
  const abort = new AbortController();
  // Forward client disconnects to the upstream provider.
  req.signal.addEventListener("abort", () => abort.abort(), { once: true });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }
      try {
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
