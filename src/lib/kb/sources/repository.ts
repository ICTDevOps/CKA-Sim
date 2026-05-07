import type Database from "better-sqlite3";
import { generateSourceId, getKbUserDb } from "@/lib/kb/user-db";
import type { SourceRow, SourceStatus } from "./types";

export interface CreateSourceInput {
  url: string;
  displayName?: string | null;
  addedBy?: string | null;
}

export function createSource(
  dimensions: number,
  input: CreateSourceInput
): SourceRow {
  const db = getKbUserDb(dimensions);
  const row: SourceRow = {
    id: generateSourceId(),
    url: input.url,
    display_name: input.displayName ?? null,
    added_by: input.addedBy ?? null,
    added_at: Date.now(),
    last_fetched_at: null,
    last_etag: null,
    last_modified: null,
    content_hash: null,
    status: "pending",
    error: null,
    chunk_count: 0
  };
  db.prepare(
    `INSERT INTO sources
       (id, url, display_name, added_by, added_at, status)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.url,
    row.display_name,
    row.added_by,
    row.added_at,
    row.status
  );
  return row;
}

export function listSources(
  dimensions: number,
  addedBy?: string
): SourceRow[] {
  const db = getKbUserDb(dimensions);
  if (addedBy) {
    return db
      .prepare(
        "SELECT * FROM sources WHERE added_by = ? ORDER BY added_at DESC"
      )
      .all(addedBy) as SourceRow[];
  }
  return db
    .prepare("SELECT * FROM sources ORDER BY added_at DESC")
    .all() as SourceRow[];
}

export function getSource(
  dimensions: number,
  id: string
): SourceRow | null {
  const db = getKbUserDb(dimensions);
  return (
    (db.prepare("SELECT * FROM sources WHERE id = ?").get(id) as
      | SourceRow
      | undefined) ?? null
  );
}

export function deleteSource(dimensions: number, id: string): boolean {
  const db = getKbUserDb(dimensions);
  const r = db.prepare("DELETE FROM sources WHERE id = ?").run(id);
  // chunks rows are cleaned up via FK cascade; chunks_vec is virtual and
  // doesn't auto-cascade, so wipe its rows for this source explicitly.
  db.prepare(
    `DELETE FROM chunks_vec WHERE rowid IN (
       SELECT id FROM chunks WHERE source_id = ?
     )`
  ).run(id);
  return r.changes > 0;
}

export interface SourceUpdate {
  status?: SourceStatus;
  error?: string | null;
  contentHash?: string | null;
  etag?: string | null;
  lastModified?: string | null;
  lastFetchedAt?: number;
  chunkCount?: number;
}

export function updateSource(
  dimensions: number,
  id: string,
  patch: SourceUpdate
): void {
  const db = getKbUserDb(dimensions);
  const sets: string[] = [];
  const args: unknown[] = [];
  const map: Record<keyof SourceUpdate, string> = {
    status: "status",
    error: "error",
    contentHash: "content_hash",
    etag: "last_etag",
    lastModified: "last_modified",
    lastFetchedAt: "last_fetched_at",
    chunkCount: "chunk_count"
  };
  for (const [k, col] of Object.entries(map) as Array<
    [keyof SourceUpdate, string]
  >) {
    if (patch[k] !== undefined) {
      sets.push(`${col} = ?`);
      args.push(patch[k] as unknown);
    }
  }
  if (sets.length === 0) return;
  args.push(id);
  db.prepare(`UPDATE sources SET ${sets.join(", ")} WHERE id = ?`).run(
    ...args
  );
}

/**
 * Replaces all chunks for a source (used on refresh). Runs in a single
 * transaction so a partial failure doesn't corrupt the index.
 */
export function replaceChunks(
  dimensions: number,
  sourceId: string,
  chunks: Array<{ section: string; content: string; embedding: Float32Array }>
): void {
  const db = getKbUserDb(dimensions);
  const sourceRow = getSource(dimensions, sourceId);
  if (!sourceRow) throw new Error(`Source ${sourceId} not found`);

  const wipeChunks = db.prepare("DELETE FROM chunks WHERE source_id = ?");
  const wipeVec = db.prepare(
    `DELETE FROM chunks_vec WHERE rowid IN (
       SELECT id FROM chunks WHERE source_id = ?
     )`
  );
  const insertChunk = db.prepare(
    `INSERT INTO chunks (source_id, source_url, source_section, content)
     VALUES (?, ?, ?, ?)`
  );
  const insertVec = db.prepare(
    `INSERT INTO chunks_vec (rowid, embedding) VALUES (?, ?)`
  );

  const tx = db.transaction(() => {
    wipeVec.run(sourceId);
    wipeChunks.run(sourceId);
    for (const c of chunks) {
      const r = insertChunk.run(
        sourceId,
        sourceRow.url,
        c.section,
        c.content
      );
      const blob = Buffer.from(
        c.embedding.buffer,
        c.embedding.byteOffset,
        c.embedding.byteLength
      );
      // better-sqlite3 v12 binds JS Numbers as SQLITE_FLOAT; sqlite-vec
      // rejects "Only integers are allowed for primary key values".
      // BigInt always binds as SQLITE_INTEGER — use it unconditionally.
      insertVec.run(BigInt(r.lastInsertRowid), blob);
    }
  });
  tx();

  updateSource(dimensions, sourceId, { chunkCount: chunks.length });
}

export function searchSources(
  dimensions: number,
  queryVec: Float32Array,
  k: number
): Array<{
  id: number;
  sourceId: string;
  sourceUrl: string;
  sourceSection: string;
  content: string;
  distance: number;
}> {
  const db: Database.Database = getKbUserDb(dimensions);
  const blob = Buffer.from(
    queryVec.buffer,
    queryVec.byteOffset,
    queryVec.byteLength
  );
  return db
    .prepare(
      `SELECT c.id              AS id,
              c.source_id       AS sourceId,
              c.source_url      AS sourceUrl,
              c.source_section  AS sourceSection,
              c.content         AS content,
              v.distance        AS distance
         FROM chunks_vec v
         INNER JOIN chunks c ON c.id = v.rowid
        WHERE v.embedding MATCH ? AND k = ?
        ORDER BY v.distance`
    )
    .all(blob, k) as Array<{
    id: number;
    sourceId: string;
    sourceUrl: string;
    sourceSection: string;
    content: string;
    distance: number;
  }>;
}
