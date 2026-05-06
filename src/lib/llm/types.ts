/**
 * LLM provider abstraction shared by all chat-style AI features in the app.
 *
 * Today the only consumer is the post-answer Tutor (Sprint 3). Tomorrow:
 * RAG-grounded explanations (Sprint 4), question generation (later), etc.
 *
 * Only the streaming surface is part of the contract — every supported
 * provider can stream, and the UI always benefits from streaming feedback.
 */

export type LlmRole = "system" | "user" | "assistant";

export interface LlmMessage {
  role: LlmRole;
  content: string;
}

export interface LlmStreamOptions {
  messages: LlmMessage[];
  /** Soft cap on output tokens. */
  maxTokens?: number;
  /** 0..2; lower = more deterministic. Default 0.4. */
  temperature?: number;
  /** AbortSignal for client disconnects. */
  signal?: AbortSignal;
}

export type LlmStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done" }
  | { type: "error"; message: string; retryable?: boolean };

export interface LlmProvider {
  /** Stable id of the provider (`"openrouter"`, `"claude-oauth"`, ...). */
  readonly id: string;
  /** Human-readable model id, for diagnostics/logs. */
  readonly modelLabel: string;
  /**
   * Streams the assistant's reply for the given conversation. The returned
   * iterable must:
   *  - emit `delta` events as text arrives
   *  - emit a single `done` event when the stream completes successfully
   *  - emit a single `error` event and stop on failure
   *
   * Implementations should never throw — surface failures via `error` events
   * so the API route can convert them into clean SSE messages.
   */
  stream(opts: LlmStreamOptions): AsyncIterable<LlmStreamEvent>;
}

export class LlmConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmConfigError";
  }
}
