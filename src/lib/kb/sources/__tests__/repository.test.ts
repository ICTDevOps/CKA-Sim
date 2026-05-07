import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

let tempDir: string;

beforeEach(async () => {
  tempDir = mkdtempSync(join(tmpdir(), "cka-sim-srcs-"));
  process.env.CKA_SIM_DATA_DIR = tempDir;
  // Reset the cached kb-user.db connection so each test gets a fresh DB.
  const userDb = await import("@/lib/kb/user-db");
  userDb._resetKbUserDb();
});

afterEach(() => {
  delete process.env.CKA_SIM_DATA_DIR;
  rmSync(tempDir, { recursive: true, force: true });
});

const DIM = 4;

function fakeVec(): Float32Array {
  const v = new Float32Array(DIM);
  for (let i = 0; i < DIM; i++) v[i] = Math.random();
  // Normalize so sqlite-vec MATCH gives sane results (unit vectors).
  let s = 0;
  for (let i = 0; i < DIM; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < DIM; i++) v[i] /= n;
  return v;
}

describe("sources repository", () => {
  it("createSource → listSources → getSource roundtrip", async () => {
    const repo = await import("@/lib/kb/sources/repository");
    const a = repo.createSource(DIM, {
      url: "https://kubernetes.io/docs/a",
      addedBy: "alice"
    });
    const b = repo.createSource(DIM, {
      url: "https://kubernetes.io/docs/b",
      displayName: "B Page",
      addedBy: "alice"
    });
    expect(repo.listSources(DIM, "alice")).toHaveLength(2);
    expect(repo.listSources(DIM, "bob")).toHaveLength(0);

    const fetched = repo.getSource(DIM, b.id);
    expect(fetched?.display_name).toBe("B Page");
    expect(fetched?.status).toBe("pending");
    void a;
  });

  it("updateSource patches only provided fields", async () => {
    const repo = await import("@/lib/kb/sources/repository");
    const s = repo.createSource(DIM, {
      url: "https://example.test/x",
      addedBy: "u"
    });
    repo.updateSource(DIM, s.id, {
      status: "ok",
      etag: 'W/"abc"',
      lastFetchedAt: 12345,
      chunkCount: 3
    });
    const after = repo.getSource(DIM, s.id);
    expect(after?.status).toBe("ok");
    expect(after?.last_etag).toBe('W/"abc"');
    expect(after?.last_fetched_at).toBe(12345);
    expect(after?.chunk_count).toBe(3);
    // Unchanged:
    expect(after?.url).toBe("https://example.test/x");
  });

  it("replaceChunks stores chunks + vectors atomically and search returns them", async () => {
    const repo = await import("@/lib/kb/sources/repository");
    const s = repo.createSource(DIM, {
      url: "https://example.test/q",
      addedBy: "u"
    });
    const chunks = [
      { section: "Intro", content: "Intro\n\nfirst", embedding: fakeVec() },
      { section: "Detail", content: "Detail\n\nsecond", embedding: fakeVec() }
    ];
    repo.replaceChunks(DIM, s.id, chunks);
    const after = repo.getSource(DIM, s.id);
    expect(after?.chunk_count).toBe(2);

    const results = repo.searchSources(DIM, chunks[0].embedding, 5);
    expect(results.length).toBeGreaterThan(0);
    // The closest chunk to chunks[0].embedding should be the one we
    // inserted with that exact embedding.
    expect(results[0].sourceId).toBe(s.id);
    expect(results[0].content).toBe("Intro\n\nfirst");
  });

  it("replaceChunks wipes previous chunks before inserting", async () => {
    const repo = await import("@/lib/kb/sources/repository");
    const s = repo.createSource(DIM, {
      url: "https://example.test/r",
      addedBy: "u"
    });
    repo.replaceChunks(DIM, s.id, [
      { section: "old", content: "old content here", embedding: fakeVec() }
    ]);
    repo.replaceChunks(DIM, s.id, [
      { section: "new", content: "new content here", embedding: fakeVec() }
    ]);
    const after = repo.getSource(DIM, s.id);
    expect(after?.chunk_count).toBe(1);
    const results = repo.searchSources(DIM, fakeVec(), 10);
    expect(results.every((r) => r.content === "new content here")).toBe(true);
  });

  it("deleteSource cascades chunks and removes vec rows", async () => {
    const repo = await import("@/lib/kb/sources/repository");
    const s = repo.createSource(DIM, {
      url: "https://example.test/d",
      addedBy: "u"
    });
    repo.replaceChunks(DIM, s.id, [
      { section: "x", content: "delete me later", embedding: fakeVec() }
    ]);
    expect(repo.deleteSource(DIM, s.id)).toBe(true);
    expect(repo.getSource(DIM, s.id)).toBeNull();
    expect(repo.searchSources(DIM, fakeVec(), 5)).toHaveLength(0);
  });
});
