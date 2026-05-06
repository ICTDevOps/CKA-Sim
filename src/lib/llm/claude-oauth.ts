import type { LlmProvider, LlmStreamEvent } from "./types";

/**
 * Stub provider for the Claude OAuth path. The OAuth flow itself (PKCE,
 * redirect URL registration with Anthropic, token storage and refresh) is
 * a Sprint 3.1 follow-up — the user has an existing implementation in their
 * dash-pass project that will be ported in.
 *
 * Until then, selecting "Claude OAuth" in Settings without completing the
 * (yet-unbuilt) link flow surfaces this clean error in the tutor panel,
 * pointing at OpenRouter as the working alternative.
 */
export class ClaudeOAuthStubProvider implements LlmProvider {
  readonly id = "claude-oauth";
  readonly modelLabel = "claude-oauth (stub)";

  async *stream(): AsyncIterable<LlmStreamEvent> {
    yield {
      type: "error",
      message:
        "Claude OAuth integration ships in Sprint 3.1. " +
        "Switch to OpenRouter on the Settings page to use the AI tutor today."
    };
  }
}
