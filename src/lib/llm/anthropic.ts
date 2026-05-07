import {
  LlmConfigError,
  type LlmProvider,
  type LlmStreamEvent,
  type LlmStreamOptions
} from "./types";

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Anthropic Messages API provider with streaming SSE.
 *
 * Authentication mirrors the dash-pass-Gerpinnes pattern: an API key passed
 * via the `x-api-key` header (no OAuth, no Bearer scheme). Despite the
 * Sprint 3 placeholder being labeled "Claude OAuth", real-world usage is
 * always BYOK with an API key — we adopt the honest label here.
 *
 * Streaming format (Anthropic SSE):
 *   event: content_block_delta
 *   data: {"type":"content_block_delta","index":0,
 *          "delta":{"type":"text_delta","text":"..."}}
 *   …
 *   event: message_stop
 *   data: {"type":"message_stop"}
 *
 * The `system` prompt is passed as a top-level field (not as a "system"
 * message), per the Anthropic schema.
 */
export class AnthropicProvider implements LlmProvider {
  readonly id = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    if (!apiKey) {
      throw new LlmConfigError(
        "Anthropic API key is required. Set it on the Settings page."
      );
    }
    if (!model) {
      throw new LlmConfigError("Anthropic model is required.");
    }
  }

  get modelLabel(): string {
    return `anthropic:${this.model}`;
  }

  async *stream(opts: LlmStreamOptions): AsyncIterable<LlmStreamEvent> {
    // Split system messages from chat turns — Anthropic expects `system` as
    // a top-level field, distinct from the user/assistant alternation.
    const sysParts = opts.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n");
    const chatMessages = opts.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": ANTHROPIC_VERSION
        },
        body: JSON.stringify({
          model: this.model,
          system: sysParts || undefined,
          messages: chatMessages,
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 600,
          stream: true
        }),
        signal: opts.signal
      });
    } catch (e) {
      yield {
        type: "error",
        message: `Network error contacting Anthropic: ${(e as Error).message}`,
        retryable: true
      };
      return;
    }

    if (!res.ok) {
      const body = await safeText(res);
      yield {
        type: "error",
        message: `Anthropic ${res.status}: ${body || res.statusText}`,
        retryable: res.status >= 500 || res.status === 429
      };
      return;
    }
    if (!res.body) {
      yield { type: "error", message: "Anthropic returned no body." };
      return;
    }

    const decoder = new TextDecoder();
    const reader = res.body.getReader();
    let buffer = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          // A frame is a sequence of `event: ...` and `data: ...` lines.
          // We only care about `data:` payloads — `event:` is informational.
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            try {
              const parsed = JSON.parse(payload) as {
                type?: string;
                delta?: { type?: string; text?: string };
              };
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta" &&
                parsed.delta.text
              ) {
                yield { type: "delta", text: parsed.delta.text };
              } else if (parsed.type === "message_stop") {
                yield { type: "done" };
                return;
              }
              // Ignore: ping, message_start, content_block_start/stop,
              // message_delta — not user-visible deltas.
            } catch {
              // Non-JSON keepalive — ignore.
            }
          }
        }
      }
      yield { type: "done" };
    } catch (e) {
      const err = e as Error;
      if (err.name === "AbortError") {
        yield { type: "done" };
        return;
      }
      yield { type: "error", message: `Stream parse error: ${err.message}` };
    } finally {
      reader.releaseLock();
    }
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}
