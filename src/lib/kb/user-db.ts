import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { v4 as uuid } from "uuid";

/**
 * Writable companion to the bundled kb.db. Holds user-added web sources
 * and their chunks. Lives in `<DATA_DIR>/kb-user.db` so it survives Docker
 * image upgrades when the data directory is mounted as a volume.
 *
 * Schema is created lazily on first open. The vector dimensions are tied
 * to the bundled kb.db's embedding provider — we ALWAYS use the same
 * embedding provider for user sources so retrieval can merge results.
 */

/**
 * Resolves the kb-user.db path lazily so tests (which mutate
 * `CKA_SIM_DATA_DIR` between cases) get the right file each time.
 */
export function getKbUserPath(): string {
  return (
    process.env.CKA_SIM_KB_USER_PATH ??
    join(
      process.env.CKA_SIM_DATA_DIR ?? join(process.cwd(), "data"),
      "kb-user.db"
    )
  );
}

let cached: Database.Database | null = null;

export function getKbUserDb(dimensions: number): Database.Database {
  if (cached) return cached;
  const path = getKbUserPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  sqliteVec.load(db);
  initSchema(db, dimensions);
  cached = db;
  return db;
}

/** Test helper — drops the cached connection so a fresh one is created. */
export function _resetKbUserDb(): void {
  cached?.close();
  cached = null;
}

function initSchema(db: Database.Database, dimensions: number): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS sources (
      id              TEXT PRIMARY KEY,
      url             TEXT NOT NULL,
      display_name    TEXT,
      added_by        TEXT,
      added_at        INTEGER NOT NULL,
      last_fetched_at INTEGER,
      last_etag       TEXT,
      last_modified   TEXT,
      content_hash    TEXT,
      status          TEXT NOT NULL DEFAULT 'pending',
      error           TEXT,
      chunk_count     INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_sources_added_by_at
      ON sources(added_by, added_at DESC);
    CREATE TABLE IF NOT EXISTS chunks (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id      TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
      source_url     TEXT NOT NULL,
      source_section TEXT NOT NULL,
      content        TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chunks_source_id ON chunks(source_id);
  `);

  // The vec virtual table can only be created once with fixed dimensions.
  // If it exists with the wrong dimensions, we must drop and recreate.
  const existing = db
    .prepare(
      `SELECT sql FROM sqlite_master
        WHERE type IN ('table', 'view') AND name = 'chunks_vec'`
    )
    .get() as { sql: string } | undefined;

  const expected = `float[${dimensions}]`;
  if (existing && !existing.sql.includes(expected)) {
    // Wipe everything that depended on the old dimensions.
    db.exec("DROP TABLE chunks_vec; DELETE FROM chunks; DELETE FROM sources;");
  }
  db.exec(
    `CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(embedding ${expected});`
  );

  // Record the dimensions for diagnostics + boot validation.
  db.prepare(
    `INSERT INTO meta (key, value) VALUES ('dimensions', ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(String(dimensions));
}

export function generateSourceId(): string {
  return uuid();
}
