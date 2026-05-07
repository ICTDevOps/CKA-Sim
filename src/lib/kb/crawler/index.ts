import { createHash } from "node:crypto";
import type { EmbeddingProvider } from "@/lib/embeddings";
import {
  getSource,
  replaceChunks,
  updateSource
} from "@/lib/kb/sources/repository";
import { chunkDocument } from "./chunk";
import { extractText } from "./extract";

const USER_AGENT =
  "CKA-Sim/0.1 (+https://github.com/ictdevops/cka-sim) SourcesCrawler";

const MAX_BODY_BYTES = 2_000_000; // 2 MB cap, plenty for a doc page

export class CrawlerError extends Error {
  constructor(
    message: string,
    readonly status: "skipped" | "error" = "error"
  ) {
    super(message);
    this.name = "CrawlerError";
  }
}

export interface FetchResult {
  status: "fetched" | "not-modified" | "skipped";
  contentType?: string;
  body?: string;
  etag?: string | null;
  lastModified?: string | null;
  hash?: string;
}

/**
 * Conditional GET with ETag / If-Modified-Since when we have prior
 * fetch metadata. Caps body size and rejects non-HTML responses.
 */
export async function fetchUrl(
  url: string,
  opts: { etag?: string | null; lastModified?: string | null } = {},
  signal?: AbortSignal
): Promise<FetchResult> {
  const headers: Record<string, string> = {
    "User-Agent": USER_AGENT,
    Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    "Accept-Language": "en;q=0.9, fr;q=0.8"
  };
  if (opts.etag) headers["If-None-Match"] = opts.etag;
  if (opts.lastModified) headers["If-Modified-Since"] = opts.lastModified;

  const res = await fetch(url, { method: "GET", headers, signal });
  if (res.status === 304) {
    return { status: "not-modified" };
  }
  if (!res.ok) {
    throw new CrawlerError(
      `HTTP ${res.status} ${res.statusText} fetching ${url}`
    );
  }
  const ct = res.headers.get("content-type") ?? "";
  if (!/text\/html|application\/xhtml/i.test(ct)) {
    throw new CrawlerError(
      `Unsupported Content-Type "${ct}" for ${url} (expected HTML)`
    );
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BODY_BYTES) {
    throw new CrawlerError(
      `Body too large (${buf.byteLength} bytes > ${MAX_BODY_BYTES})`
    );
  }
  const body = new TextDecoder().decode(buf);
  const hash = createHash("sha256")
    .update(Buffer.from(buf))
    .digest("hex");
  return {
    status: "fetched",
    contentType: ct,
    body,
    etag: res.headers.get("etag"),
    lastModified: res.headers.get("last-modified"),
    hash
  };
}

interface IngestOpts {
  signal?: AbortSignal;
}

/**
 * Refreshes a single source: fetch (with conditional GET if we have
 * prior metadata), extract text, chunk, embed, store. Returns the
 * outcome so the API can surface it to the user.
 */
export async function refreshSource(
  embedProvider: EmbeddingProvider,
  sourceId: string,
  opts: IngestOpts = {}
): Promise<{
  status: "ok" | "not-modified" | "error";
  error?: string;
  chunkCount?: number;
}> {
  const dims = embedProvider.dimensions;
  const source = getSource(dims, sourceId);
  if (!source) return { status: "error", error: "Source not found." };

  try {
    const fr = await fetchUrl(
      source.url,
      { etag: source.last_etag, lastModified: source.last_modified },
      opts.signal
    );

    if (fr.status === "not-modified") {
      updateSource(dims, sourceId, {
        status: "ok",
        lastFetchedAt: Date.now(),
        error: null
      });
      return { status: "not-modified", chunkCount: source.chunk_count };
    }

    if (fr.hash && fr.hash === source.content_hash) {
      // Content identical despite no 304 — skip re-embedding.
      updateSource(dims, sourceId, {
        status: "ok",
        lastFetchedAt: Date.now(),
        etag: fr.etag,
        lastModified: fr.lastModified,
        error: null
      });
      return { status: "not-modified", chunkCount: source.chunk_count };
    }

    const text = extractText(fr.body ?? "");
    const fallbackTitle =
      source.display_name?.trim() || titleFromUrl(source.url);
    const raw = chunkDocument(text, fallbackTitle).slice(0, 200); // sanity cap

    if (raw.length === 0) {
      throw new CrawlerError("No usable content extracted from page.");
    }

    const vectors = await embedProvider.embed(raw.map((c) => c.content));
    if (vectors.length !== raw.length) {
      throw new CrawlerError(
        `Embedding count mismatch: got ${vectors.length} for ${raw.length} chunks.`
      );
    }
    if (vectors[0].length !== dims) {
      throw new CrawlerError(
        `Embedding dimensions ${vectors[0].length} ≠ index ${dims}`
      );
    }

    replaceChunks(
      dims,
      sourceId,
      raw.map((c, i) => ({ ...c, embedding: vectors[i] }))
    );

    updateSource(dims, sourceId, {
      status: "ok",
      error: null,
      etag: fr.etag,
      lastModified: fr.lastModified,
      contentHash: fr.hash,
      lastFetchedAt: Date.now(),
      chunkCount: raw.length
    });
    return { status: "ok", chunkCount: raw.length };
  } catch (e) {
    const msg = (e as Error).message.slice(0, 500);
    updateSource(dims, sourceId, {
      status: "error",
      error: msg,
      lastFetchedAt: Date.now()
    });
    return { status: "error", error: msg };
  }
}

function titleFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").filter(Boolean).pop();
    return last || u.hostname;
  } catch {
    return url.slice(0, 60);
  }
}
