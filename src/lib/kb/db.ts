import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Read-only knowledge-base database, separate from `app.db`.
 *
 * Layout (built by scripts/kb-build.mjs):
 *   meta(key TEXT PRIMARY KEY, value TEXT)
 *     "embedding_provider" -> id of the provider used to build the index
 *     "dimensions"         -> vector size
 *     "built_at"           -> epoch ms
 *   chunks(id INTEGER PRIMARY KEY, source_url TEXT, source_section TEXT,
 *          source_file TEXT, content TEXT)
 *   chunks_vec USING vec0(embedding float[N])  -- N varies per provider
 *
 * The DB ships with the repo (and Docker image). The path defaults to
 * `<repo-root>/kb.db` and can be overridden by CKA_SIM_KB_PATH.
 */

export const KB_PATH =
  process.env.CKA_SIM_KB_PATH ?? join(process.cwd(), "kb.db");

let cached: Database.Database | null = null;

export interface KbMeta {
  embeddingProvider: string;
  dimensions: number;
  builtAt: number;
}

export function openKbReadOnly(): Database.Database | null {
  if (cached) return cached;
  if (!existsSync(KB_PATH)) return null;
  const db = new Database(KB_PATH, { readonly: true });
  db.pragma("foreign_keys = ON");
  sqliteVec.load(db);
  cached = db;
  return db;
}

export function readKbMeta(db: Database.Database): KbMeta {
  const rows = db.prepare("SELECT key, value FROM meta").all() as Array<{
    key: string;
    value: string;
  }>;
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;
  return {
    embeddingProvider: map.embedding_provider ?? "",
    dimensions: Number(map.dimensions ?? 0),
    builtAt: Number(map.built_at ?? 0)
  };
}

/** Write-mode helper, used only by the ingestion script. */
export function openKbWritable(path: string = KB_PATH): Database.Database {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  sqliteVec.load(db);
  return db;
}
