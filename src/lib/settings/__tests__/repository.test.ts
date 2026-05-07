import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;

// Each test gets a fresh DB by pointing CKA_SIM_DATA_DIR at a temp dir
// before importing the singletons. We require() inside each test for
// isolation (fresh module cache -> fresh getDb singleton).
beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), "cka-sim-test-"));
  process.env.CKA_SIM_DATA_DIR = tempDir;
});

afterEach(() => {
  delete process.env.CKA_SIM_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

async function freshModules() {
  // Reset module registry so each test gets a fresh getDb singleton.
  const { default: viteResetModules } = (await import("vitest")) as never;
  void viteResetModules;
  const repo = await import("@/lib/settings/repository");
  return repo;
}

describe("settings repository", () => {
  it("returns DEFAULT_PREFS when no row exists", async () => {
    const { getPrefs } = await freshModules();
    const p = getPrefs("user-1");
    expect(p.llmProvider).toBe("anthropic");
    expect(p.anthropicApiKey).toBe("");
    expect(p.aiTutorEnabled).toBe(false);
  });

  it("roundtrips setPrefs / getPrefs", async () => {
    const { getPrefs, setPrefs } = await freshModules();
    const { ensureAnonymousUser } = await import(
      "@/lib/db/repositories/users"
    );
    // The user_settings table has a FK to users — create the user first.
    ensureAnonymousUser("user-1");
    setPrefs("user-1", {
      schemaVersion: 1,
      llmProvider: "openrouter",
      anthropicApiKey: "",
      anthropicModel: "claude-sonnet-4-6",
      openrouterApiKey: "sk-or-test",
      openrouterModel: "openai/gpt-5",
      embeddingProvider: "local-bge-small",
      aiTutorEnabled: true,
      examMode: false,
      ragEnabled: true
    });
    const p = getPrefs("user-1");
    expect(p.llmProvider).toBe("openrouter");
    expect(p.openrouterApiKey).toBe("sk-or-test");
    expect(p.aiTutorEnabled).toBe(true);
  });

  it("normalizes legacy claude-oauth value to anthropic", async () => {
    // Write a legacy row directly via the underlying DB to simulate a
    // user who saved settings under Sprint 3.
    const { getDb } = await import("@/lib/db");
    const { ensureAnonymousUser } = await import(
      "@/lib/db/repositories/users"
    );
    ensureAnonymousUser("legacy-user");
    const legacyJson = JSON.stringify({ llmProvider: "claude-oauth" });
    getDb()
      .prepare(
        `INSERT INTO user_settings (user_id, key, value, updated_at)
         VALUES (?, ?, ?, ?)`
      )
      .run("legacy-user", "user-prefs", legacyJson, Date.now());

    const { getPrefs } = await import("@/lib/settings/repository");
    const p = getPrefs("legacy-user");
    expect(p.llmProvider).toBe("anthropic");
  });

  it("merges stored values over defaults (forward-compat)", async () => {
    const { getDb } = await import("@/lib/db");
    const { ensureAnonymousUser } = await import(
      "@/lib/db/repositories/users"
    );
    ensureAnonymousUser("partial-user");
    // Only set one field — repository should fill the rest from defaults.
    getDb()
      .prepare(
        `INSERT INTO user_settings (user_id, key, value, updated_at)
         VALUES (?, ?, ?, ?)`
      )
      .run(
        "partial-user",
        "user-prefs",
        JSON.stringify({ aiTutorEnabled: true }),
        Date.now()
      );

    const { getPrefs } = await import("@/lib/settings/repository");
    const p = getPrefs("partial-user");
    expect(p.aiTutorEnabled).toBe(true);
    expect(p.llmProvider).toBe("anthropic");
    expect(p.examMode).toBe(false);
  });

  it("returns defaults on malformed JSON without throwing", async () => {
    const { getDb } = await import("@/lib/db");
    const { ensureAnonymousUser } = await import(
      "@/lib/db/repositories/users"
    );
    ensureAnonymousUser("broken-user");
    getDb()
      .prepare(
        `INSERT INTO user_settings (user_id, key, value, updated_at)
         VALUES (?, ?, ?, ?)`
      )
      .run("broken-user", "user-prefs", "not-json{", Date.now());

    const { getPrefs } = await import("@/lib/settings/repository");
    const p = getPrefs("broken-user");
    expect(p.llmProvider).toBe("anthropic");
  });
});
