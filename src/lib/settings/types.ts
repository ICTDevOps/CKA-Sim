/**
 * Schema for user-configurable settings. Values are persisted as a single
 * JSON blob keyed by `user-prefs` in `user_settings`. The schema is versioned
 * via `schemaVersion` so future migrations can read older shapes.
 *
 * IMPORTANT: this MVP stores LLM API keys in plain text inside the SQLite
 * DB. That's acceptable for a single-user, locally hosted app where the
 * same user controls the disk; it would NOT be acceptable for a shared
 * deployment. When/if the app moves to multi-user, keys should be wrapped
 * with a per-user encryption key derived from a passphrase or OS keychain.
 */

export type LlmProvider = "anthropic" | "openrouter";

export type EmbeddingProvider =
  | "local-bge-small"
  | "openrouter-text-embedding-3-small"
  | "openrouter-text-embedding-3-large"
  | "openrouter-qwen3-embedding-0-6b";

export interface UserPrefs {
  schemaVersion: 1;

  /** Active LLM provider for the AI tutor. */
  llmProvider: LlmProvider;

  /** Anthropic API key — used when `llmProvider === "anthropic"`. */
  anthropicApiKey: string;

  /** Selected Anthropic model id (e.g. "claude-sonnet-4-6"). */
  anthropicModel: string;

  /** OpenRouter API key — used when `llmProvider === "openrouter"`. */
  openrouterApiKey: string;

  /** Selected OpenRouter chat model id. */
  openrouterModel: string;

  /** Active embedding provider for RAG. */
  embeddingProvider: EmbeddingProvider;

  /** Master switch for the AI tutor (overrides provider config). */
  aiTutorEnabled: boolean;

  /** When ON, the tutor is hidden during sessions (chrono-only, like CKA). */
  examMode: boolean;

  /** When ON, retrieval is performed before LLM calls (Sprint 4). */
  ragEnabled: boolean;
}

export const DEFAULT_PREFS: UserPrefs = {
  schemaVersion: 1,
  llmProvider: "anthropic",
  anthropicApiKey: "",
  anthropicModel: "claude-sonnet-4-6",
  openrouterApiKey: "",
  openrouterModel: "anthropic/claude-sonnet-4.6",
  embeddingProvider: "local-bge-small",
  aiTutorEnabled: false,
  examMode: false,
  ragEnabled: true
};

/** Curated Anthropic chat models for the tutor. */
export const ANTHROPIC_CHAT_MODELS = [
  "claude-opus-4-7",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001"
] as const;

/** OpenRouter chat models curated for the tutor (sensible CKA defaults). */
export const OPENROUTER_CHAT_MODELS = [
  "anthropic/claude-sonnet-4.6",
  "anthropic/claude-opus-4.7",
  "anthropic/claude-haiku-4.5",
  "openai/gpt-5",
  "google/gemini-2.5-pro",
  "qwen/qwen3-235b-instruct",
  "meta-llama/llama-4-405b-instruct"
] as const;
