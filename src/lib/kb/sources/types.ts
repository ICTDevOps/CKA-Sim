export type SourceStatus = "pending" | "ok" | "error";

export interface SourceRow {
  id: string;
  url: string;
  display_name: string | null;
  added_by: string | null;
  added_at: number;
  last_fetched_at: number | null;
  last_etag: string | null;
  last_modified: string | null;
  content_hash: string | null;
  status: SourceStatus;
  error: string | null;
  chunk_count: number;
}

export interface SourcePublic {
  id: string;
  url: string;
  displayName: string | null;
  status: SourceStatus;
  error: string | null;
  chunkCount: number;
  lastFetchedAt: number | null;
  addedAt: number;
}

export function toPublic(row: SourceRow): SourcePublic {
  return {
    id: row.id,
    url: row.url,
    displayName: row.display_name,
    status: row.status,
    error: row.error,
    chunkCount: row.chunk_count,
    lastFetchedAt: row.last_fetched_at,
    addedAt: row.added_at
  };
}
