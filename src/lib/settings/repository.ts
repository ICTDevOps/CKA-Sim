import { getDb } from "@/lib/db";
import { DEFAULT_PREFS, type UserPrefs } from "./types";

const PREFS_KEY = "user-prefs";

/**
 * Reads the user's preferences, merging stored values over defaults so newly
 * added fields work transparently for users who saved settings before they
 * existed.
 */
export function getPrefs(userId: string): UserPrefs {
  const row = getDb()
    .prepare(
      "SELECT value FROM user_settings WHERE user_id = ? AND key = ?"
    )
    .get(userId, PREFS_KEY) as { value: string } | undefined;
  if (!row?.value) return { ...DEFAULT_PREFS };
  try {
    const parsed = JSON.parse(row.value) as Partial<UserPrefs>;
    return { ...DEFAULT_PREFS, ...parsed, schemaVersion: 1 };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/**
 * Replaces the user's preferences. Caller is responsible for validating.
 */
export function setPrefs(userId: string, prefs: UserPrefs): void {
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO user_settings (user_id, key, value, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, key) DO UPDATE SET
         value = excluded.value,
         updated_at = excluded.updated_at`
    )
    .run(userId, PREFS_KEY, JSON.stringify(prefs), now);
}
