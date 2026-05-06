import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { MIGRATIONS } from "./migrations";

/**
 * SQLite connection singleton with a lightweight migration runner.
 *
 * The DB lives at `<DATA_DIR>/app.db` (default `<cwd>/data/app.db`). In
 * Docker, mount `/app/data` as a volume to persist runs across container
 * upgrades. Override the location with `CKA_SIM_DATA_DIR`.
 */

const DATA_DIR =
  process.env.CKA_SIM_DATA_DIR ?? join(process.cwd(), "data");
const DB_PATH = join(DATA_DIR, "app.db");

let cachedDb: Database.Database | null = null;

export function getDb(): Database.Database {
  if (cachedDb) return cachedDb;
  mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");
  runMigrations(db);
  cachedDb = db;
  return db;
}

function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    db
      .prepare("SELECT name FROM _migrations")
      .all()
      .map((r) => (r as { name: string }).name)
  );

  const apply = db.transaction((name: string, sql: string) => {
    db.exec(sql);
    db.prepare(
      "INSERT INTO _migrations (name, applied_at) VALUES (?, ?)"
    ).run(name, Date.now());
  });

  for (const m of MIGRATIONS) {
    if (applied.has(m.name)) continue;
    apply(m.name, m.sql);
  }
}
