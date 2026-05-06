import { getDb } from "@/lib/db";
import type { UserRow } from "@/lib/db/types";

/**
 * Returns the user row for `id`, creating it lazily if missing. Used by the
 * cookie-based identification middleware: every visitor gets an anonymous
 * local user on first request.
 */
export function ensureAnonymousUser(id: string): UserRow {
  const db = getDb();
  const existing = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id) as UserRow | undefined;
  if (existing) return existing;

  const row: UserRow = {
    id,
    display_name: null,
    is_anonymous: 1,
    created_at: Date.now()
  };
  db.prepare(
    "INSERT INTO users (id, display_name, is_anonymous, created_at) VALUES (?, ?, ?, ?)"
  ).run(row.id, row.display_name, row.is_anonymous, row.created_at);
  return row;
}

export function getUser(id: string): UserRow | null {
  const db = getDb();
  return (
    (db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | UserRow
      | undefined) ?? null
  );
}
