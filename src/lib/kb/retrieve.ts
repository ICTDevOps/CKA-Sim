import { existsSync } from "node:fs";
import { type EmbeddingProvider } from "@/lib/embeddings";
import { searchSources } from "./sources/repository";
import { getKbUserPath } from "./user-db";
import { openKbReadOnly, readKbMeta } from "./db";

export interface RetrievedChunk {
  id: number | string;
  sourceUrl: string;
  sourceSection: string;
  sourceFile?: string;
  /** "bundled" for kb.db, "user" for kb-user.db. */
  origin: "bundled" | "user";
  content: string;
  /** Distance from sqlite-vec. Lower = more similar. */
  distance: number;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  /** Diagnostic: which embedding provider the bundled index was built with. */
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
 * Retrieves the top-K KB chunks closest to `query`, MERGING:
 *  - the bundled, read-only kb.db (built at image time)
 *  - the user-writable kb-user.db (sources added at runtime)
 *
 * Both indexes must use the same embedding provider — we validate the
 * bundled one's metadata and assume kb-user.db is built with the same
 * provider (it's seeded that way by the crawler).
 *
 * If the bundled kb.db is missing, we still serve user-source results.
 * If both are empty, returns an empty array.
 */
export async function retrieve(
  query: string,
  provider: EmbeddingProvider,
  k = 5
): Promise<RetrievalResult> {
  const bundledDb = openKbReadOnly();
  let indexProvider: string = provider.id;

  if (bundledDb) {
    const meta = readKbMeta(bundledDb);
    if (meta.embeddingProvider && meta.embeddingProvider !== provider.id) {
      throw new KbProviderMismatchError(
        `Bundled index built with "${meta.embeddingProvider}" (${meta.dimensions}-d) ` +
          `but the active embedding provider is "${provider.id}" ` +
          `(${provider.dimensions}-d). Switch the embedding provider in ` +
          `Settings, or rebuild the KB with the matching provider.`
      );
    }
    indexProvider = meta.embeddingProvider || provider.id;
  } else if (!hasUserSourcesIndex()) {
    throw new KbUnavailableError(
      `No knowledge base available yet. Run \`npm run kb:build\` to build ` +
        `the bundled index, or add a custom web source in Settings.`
    );
  }

  const [vec] = await provider.embed([query]);
  if (!vec) return { chunks: [], indexProvider };

  const bundled = bundledDb ? queryBundled(bundledDb, vec, k) : [];
  const user = hasUserSourcesIndex()
    ? queryUser(provider.dimensions, vec, k)
    : [];

  // Merge by ascending distance, then take the global top-K.
  const merged = [...bundled, ...user]
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);

  return { chunks: merged, indexProvider };
}

function hasUserSourcesIndex(): boolean {
  return existsSync(getKbUserPath());
}

function queryBundled(
  db: ReturnType<typeof openKbReadOnly> & object,
  vec: Float32Array,
  k: number
): RetrievedChunk[] {
  const blob = Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
  const rows = db
    .prepare(
      `SELECT c.id           AS id,
              c.source_url   AS sourceUrl,
              c.source_section AS sourceSection,
              c.source_file  AS sourceFile,
              c.content      AS content,
              v.distance     AS distance
         FROM chunks_vec v
         INNER JOIN chunks c ON c.id = v.rowid
         WHERE v.embedding MATCH ? AND k = ?
         ORDER BY v.distance`
    )
    .all(blob, k) as Array<{
    id: number;
    sourceUrl: string;
    sourceSection: string;
    sourceFile: string;
    content: string;
    distance: number;
  }>;
  return rows.map((r) => ({
    id: r.id,
    sourceUrl: r.sourceUrl,
    sourceSection: r.sourceSection,
    sourceFile: r.sourceFile,
    origin: "bundled" as const,
    content: r.content,
    distance: r.distance
  }));
}

function queryUser(
  dimensions: number,
  vec: Float32Array,
  k: number
): RetrievedChunk[] {
  return searchSources(dimensions, vec, k).map((r) => ({
    id: r.id,
    sourceUrl: r.sourceUrl,
    sourceSection: r.sourceSection,
    sourceFile: undefined,
    origin: "user" as const,
    content: r.content,
    distance: r.distance
  }));
}
