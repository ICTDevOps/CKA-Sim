import {
  LlmConfigError,
  type LlmProvider,
  type LlmStreamEvent,
  type LlmStreamOptions
} from "./types";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

/**
 * OpenRouter chat-completion provider with streaming SSE.
 *
 * OpenRouter is OpenAI-compatible: it speaks the `chat/completions` schema
 * and emits `data: {...}\n\n` chunks. We forward the cumulative `delta.content`
 * as text deltas. We also pass `HTTP-Referer` and `X-Title` headers so usage
 * is attributed to the app on the OpenRouter dashboard.
 */
export class OpenRouterProvider implements LlmProvider {
  readonly id = "openrouter";

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    if (!apiKey) {
      throw new LlmConfigError(
        "OpenRouter API key is required. Set it on the Settings page."
      );
    }
    if (!model) {
      throw new LlmConfigError("OpenRouter model is required.");
    }
  }

  get modelLabel(): string {
    return `openrouter:${this.model}`;
  }

  async *stream(opts: LlmStreamOptions): AsyncIterable<LlmStreamEvent> {
    let res: Response;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
          "HTTP-Referer": "https://github.com/ictdevops/cka-sim",
          "X-Title": "CKA-Sim"
        },
        body: JSON.stringify({
          model: this.model,
          messages: opts.messages,
          temperature: opts.temperature ?? 0.4,
          max_tokens: opts.maxTokens ?? 600,
          stream: true
        }),
        signal: opts.signal
      });
    } catch (e) {
      yield {
        type: "error",
        message: `Network error contacting OpenRouter: ${(e as Error).message}`,
        retryable: true
      };
      return;
    }

    if (!res.ok) {
      const body = await safeText(res);
      yield {
        type: "error",
        message: `OpenRouter ${res.status}: ${body || res.statusText}`,
        retryable: res.status >= 500 || res.status === 429
      };
      return;
    }
    if (!res.body) {
      yield { type: "error", message: "OpenRouter returned no body." };
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

        // SSE frames are separated by blank lines. Process complete frames.
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);

          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload) continue;
            if (payload === "[DONE]") {
              yield { type: "done" };
              return;
            }
            try {
              const parsed = JSON.parse(payload) as {
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const text = parsed.choices?.[0]?.delta?.content;
              if (text) yield { type: "delta", text };
            } catch {
              // Non-JSON keepalive or comment frame — ignore.
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
      yield {
        type: "error",
        message: `Stream parse error: ${err.message}`
      };
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
