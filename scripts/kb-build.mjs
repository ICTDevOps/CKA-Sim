// Build the bundled KB vector index from kb/*.md.
//
// Usage:
//   node scripts/kb-build.mjs                # default: local-bge-small → kb.db
//   KB_OUT=kb-3-small.db EMBEDDING_PROVIDER=openrouter-text-embedding-3-small \
//     OPENROUTER_API_KEY=sk-or-... \
//     node scripts/kb-build.mjs
//
// Chunking strategy:
//   - Split each .md by H2 (## ...) — each H2 becomes one chunk
//   - Treat the H1 as document-level title that prefixes the chunk content
//   - The first non-blank "> Source: <url>" line under an H2 is captured as
//     the chunk's source URL; otherwise the file-level source URL is used
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { readdirSync, readFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const ROOT = resolve(".");
const KB_DIR = join(ROOT, "kb");
const OUT_PATH = process.env.KB_OUT
  ? resolve(process.env.KB_OUT)
  : join(ROOT, "kb.db");
const PROVIDER_ID =
  process.env.EMBEDDING_PROVIDER || "local-bge-small";

console.log(`[kb] in:  ${KB_DIR}`);
console.log(`[kb] out: ${OUT_PATH}`);
console.log(`[kb] provider: ${PROVIDER_ID}`);

// ── Embedding provider (mirrors src/lib/embeddings but standalone for ESM)

async function getProvider() {
  if (PROVIDER_ID === "local-bge-small") {
    const { pipeline } = await import("@huggingface/transformers");
    const pipe = await pipeline(
      "feature-extraction",
      "Xenova/bge-small-en-v1.5",
      { dtype: "fp32" }
    );
    return {
      id: "local-bge-small",
      dimensions: 384,
      async embed(texts) {
        const out = await pipe(texts, { pooling: "mean", normalize: true });
        const data = out.data;
        const dims = out.dims ?? [texts.length, 384];
        const n = dims[0];
        const d = dims[1];
        const vectors = [];
        for (let i = 0; i < n; i++) {
          vectors.push(
            new Float32Array(
              new Float32Array(data.buffer, data.byteOffset + i * d * 4, d)
            )
          );
        }
        return vectors;
      }
    };
  }
  // OpenRouter providers
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY required for non-local providers.");
  }
  const cfg = {
    "openrouter-text-embedding-3-small": {
      model: "openai/text-embedding-3-small",
      dimensions: 1536
    },
    "openrouter-text-embedding-3-large": {
      model: "openai/text-embedding-3-large",
      dimensions: 3072
    },
    "openrouter-qwen3-embedding-0-6b": {
      model: "qwen/qwen3-embedding-0.6b",
      dimensions: 1024
    }
  }[PROVIDER_ID];
  if (!cfg) throw new Error(`Unknown EMBEDDING_PROVIDER: ${PROVIDER_ID}`);
  return {
    id: PROVIDER_ID,
    dimensions: cfg.dimensions,
    async embed(texts) {
      const res = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://github.com/ictdevops/cka-sim",
          "X-Title": "CKA-Sim"
        },
        body: JSON.stringify({ model: cfg.model, input: texts })
      });
      if (!res.ok) {
        throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
      }
      const json = await res.json();
      return json.data.map((d) => normalize(new Float32Array(d.embedding)));
    }
  };
}

function normalize(v) {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  const n = Math.sqrt(s) || 1;
  for (let i = 0; i < v.length; i++) v[i] /= n;
  return v;
}

// ── Markdown chunking by H2

function splitMarkdown(filePath) {
  const text = readFileSync(filePath, "utf8");
  const fileName = filePath.split("/").pop();

  // Capture file-level title (H1) and a fallback source URL
  const lines = text.split("\n");
  let fileTitle = "";
  let fileSource = "";
  for (const line of lines) {
    if (!fileTitle && line.startsWith("# ")) {
      fileTitle = line.slice(2).trim();
    } else if (!fileSource && /^>\s*Source:\s*(\S+)/i.test(line)) {
      fileSource = line.replace(/^>\s*Source:\s*/i, "").trim();
    }
  }

  // Split on H2 headings
  const sections = text.split(/^## /m).slice(1); // discard pre-H2 preamble
  return sections.map((sec) => {
    const headerEnd = sec.indexOf("\n");
    const heading = sec.slice(0, headerEnd).trim();
    const body = sec.slice(headerEnd + 1).trim();

    // Per-section source override (must appear in the first 3 non-blank lines)
    let sourceUrl = fileSource;
    const head = body
      .split("\n")
      .filter((l) => l.trim())
      .slice(0, 3);
    for (const line of head) {
      const m = line.match(/^>\s*Source:\s*(\S+)/i);
      if (m) {
        sourceUrl = m[1];
        break;
      }
    }

    // Chunk text fed to the embedding model: file title + section heading +
    // body. Including the heading gives retrieval a strong topic signal.
    const chunkText = `${fileTitle} — ${heading}\n\n${body}`;
    return {
      sourceUrl,
      sourceSection: heading,
      sourceFile: fileName,
      content: chunkText
    };
  });
}

// ── Build

async function main() {
  if (!existsSync(KB_DIR)) {
    throw new Error(`kb/ directory not found at ${KB_DIR}`);
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  // Clean previous build to keep things deterministic
  if (existsSync(OUT_PATH)) rmSync(OUT_PATH);
  if (existsSync(OUT_PATH + "-shm")) rmSync(OUT_PATH + "-shm");
  if (existsSync(OUT_PATH + "-wal")) rmSync(OUT_PATH + "-wal");

  const files = readdirSync(KB_DIR)
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(KB_DIR, f));
  console.log(`[kb] markdown files: ${files.length}`);

  const allChunks = [];
  for (const f of files) {
    for (const c of splitMarkdown(f)) allChunks.push(c);
  }
  console.log(`[kb] chunks: ${allChunks.length}`);

  const provider = await getProvider();
  console.log(`[kb] embedding ${allChunks.length} chunks…`);
  const vectors = await provider.embed(allChunks.map((c) => c.content));
  if (vectors.length !== allChunks.length) {
    throw new Error("Provider returned mismatched vector count.");
  }
  if (vectors[0].length !== provider.dimensions) {
    throw new Error(
      `Provider declared ${provider.dimensions}-d but returned ${vectors[0].length}-d vectors.`
    );
  }

  const db = new Database(OUT_PATH);
  db.pragma("journal_mode = WAL");
  sqliteVec.load(db);

  db.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_url     TEXT NOT NULL,
      source_section TEXT NOT NULL,
      source_file    TEXT NOT NULL,
      content        TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE chunks_vec USING vec0(
      embedding float[${provider.dimensions}]
    );
  `);

  const insertMeta = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?)");
  insertMeta.run("embedding_provider", provider.id);
  insertMeta.run("dimensions", String(provider.dimensions));
  insertMeta.run("built_at", String(Date.now()));

  const insertChunk = db.prepare(
    `INSERT INTO chunks (source_url, source_section, source_file, content)
     VALUES (?, ?, ?, ?)`
  );
  const insertVec = db.prepare(
    `INSERT INTO chunks_vec (rowid, embedding) VALUES (?, ?)`
  );

  const insertAll = db.transaction(() => {
    for (let i = 0; i < allChunks.length; i++) {
      const c = allChunks[i];
      const r = insertChunk.run(
        c.sourceUrl,
        c.sourceSection,
        c.sourceFile,
        c.content
      );
      const blob = Buffer.from(
        vectors[i].buffer,
        vectors[i].byteOffset,
        vectors[i].byteLength
      );
      // sqlite-vec needs SQLITE_INTEGER — BigInt is the safe bind type.
      insertVec.run(BigInt(r.lastInsertRowid), blob);
    }
  });
  insertAll();

  // Compact / vacuum for a smaller shipped file
  db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
  db.close();
  console.log(`[kb] wrote ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
