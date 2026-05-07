import { type EmbeddingProvider } from "@/lib/embeddings";
import { openKbReadOnly, readKbMeta } from "./db";

export interface RetrievedChunk {
  id: number;
  sourceUrl: string;
  sourceSection: string;
  sourceFile: string;
  content: string;
  /** Distance from sqlite-vec. Lower = more similar. */
  distance: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  /** Diagnostic: which embedding provider the index was built with. */
  indexProvider: string;
}

export class KbUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KbUnavailableError";
  }
}

export class KbProviderMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "KbProviderMismatchError";
  }
}

/**
 * Retrieves the top-K knowledge-base chunks closest to `query`.
 *
 * Validates that the active embedding provider matches the one used to
 * build the index. A mismatch is a hard error — querying a 384-d index
 * with a 1536-d vector would either crash or silently return garbage.
 */
export async function retrieve(
  query: string,
  provider: EmbeddingProvider,
  k = 5
): Promise<RetrievalResult> {
  const db = openKbReadOnly();
  if (!db) {
    throw new KbUnavailableError(
      `Knowledge base not found. Run \`npm run kb:build\` to generate it.`
    );
  }
  const meta = readKbMeta(db);
  if (meta.embeddingProvider !== provider.id) {
    throw new KbProviderMismatchError(
      `Index was built with "${meta.embeddingProvider}" (${meta.dimensions}-d) ` +
        `but the active embedding provider is "${provider.id}" ` +
        `(${provider.dimensions}-d). Switch the embedding provider in ` +
        `Settings, or rebuild the KB with the matching provider.`
    );
  }

  const [vec] = await provider.embed([query]);
  if (!vec) {
    return { chunks: [], indexProvider: meta.embeddingProvider };
  }

  // sqlite-vec accepts a Float32Array passed as a Buffer.
  const blob = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);

  const rows = db
    .prepare(
      `SELECT c.id          AS id,
              c.source_url  AS sourceUrl,
              c.source_section AS sourceSection,
              c.source_file AS sourceFile,
              c.content     AS content,
              v.distance    AS distance
         FROM chunks_vec v
         INNER JOIN chunks c ON c.id = v.rowid
         WHERE v.embedding MATCH ?
           AND k = ?
         ORDER BY v.distance`
    )
    .all(blob, k) as RetrievedChunk[];

  return { chunks: rows, indexProvider: meta.embeddingProvider };
}
