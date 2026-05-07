import { getPrefs } from "@/lib/settings/repository";
import { LocalBgeProvider } from "./local-bge";
import { OpenRouterEmbeddingProvider } from "./openrouter";
import {
  EmbeddingError,
  type EmbeddingProvider,
  type EmbeddingProviderId
} from "./types";

/**
 * Resolves the active embedding provider for `userId`. Throws
 * `EmbeddingError` when the chosen provider can't be constructed (e.g.
 * OpenRouter selected without an API key).
 *
 * Note: the at-runtime provider must match the one used to BUILD the
 * vector index, otherwise dimensions and vector spaces won't line up.
 * The retrieval layer validates this at boot.
 */
export function getEmbeddingProviderForUser(
  userId: string
): EmbeddingProvider {
  const prefs = getPrefs(userId);
  return getEmbeddingProvider(prefs.embeddingProvider, {
    openrouterApiKey: prefs.openrouterApiKey
  });
}

export interface EmbeddingProviderContext {
  openrouterApiKey?: string;
}

export function getEmbeddingProvider(
  id: EmbeddingProviderId,
  ctx: EmbeddingProviderContext = {}
): EmbeddingProvider {
  if (id === "local-bge-small") return new LocalBgeProvider();
  if (!ctx.openrouterApiKey) {
    throw new EmbeddingError(
      `OpenRouter API key is required for embedding provider "${id}".`
    );
  }
  return new OpenRouterEmbeddingProvider(id, ctx.openrouterApiKey);
}

export { EmbeddingError } from "./types";
export type { EmbeddingProvider, EmbeddingProviderId } from "./types";
