import { getPrefs } from "@/lib/settings/repository";
import { ClaudeOAuthStubProvider } from "./claude-oauth";
import { OpenRouterProvider } from "./openrouter";
import { LlmConfigError, type LlmProvider } from "./types";

/**
 * Resolves the active LLM provider for `userId` from their stored prefs.
 * Throws `LlmConfigError` if the user's preferred provider is not usable
 * (missing key, unsupported model, etc.) so callers can surface a clean
 * 4xx response instead of a 5xx.
 */
export function getProviderForUser(userId: string): LlmProvider {
  const prefs = getPrefs(userId);
  if (prefs.llmProvider === "openrouter") {
    if (!prefs.openrouterApiKey) {
      throw new LlmConfigError(
        "OpenRouter API key is missing. Add it on the Settings page."
      );
    }
    return new OpenRouterProvider(
      prefs.openrouterApiKey,
      prefs.openrouterModel
    );
  }
  return new ClaudeOAuthStubProvider();
}

export { LlmConfigError } from "./types";
export type {
  LlmMessage,
  LlmProvider,
  LlmRole,
  LlmStreamEvent,
  LlmStreamOptions
} from "./types";
