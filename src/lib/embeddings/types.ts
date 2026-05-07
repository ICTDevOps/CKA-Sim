/**
 * Embedding provider abstraction. Different models produce different
 * vector spaces — the index built with one provider can ONLY be queried
 * with the same provider. Each provider declares its `id` and `dimensions`
 * so the runtime can validate the index ↔ query consistency at boot.
 */

export type EmbeddingProviderId =
  | "local-bge-small"
  | "openrouter-text-embedding-3-small"
  | "openrouter-text-embedding-3-large"
  | "openrouter-qwen3-embedding-0-6b";

export interface EmbeddingProvider {
  readonly id: EmbeddingProviderId;
  readonly dimensions: number;
  /**
   * Embeds a batch of texts. Returned vectors must be L2-normalized so
   * that cosine similarity reduces to a dot product (sqlite-vec works
   * with both, but we keep the invariant explicit).
   */
  embed(texts: string[]): Promise<Float32Array[]>;
}

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingError";
  }
}
