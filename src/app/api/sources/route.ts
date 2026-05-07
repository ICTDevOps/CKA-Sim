import { NextRequest, NextResponse } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { getEmbeddingProviderForUser } from "@/lib/embeddings";
import { refreshSource } from "@/lib/kb/crawler";
import {
  createSource,
  listSources
} from "@/lib/kb/sources/repository";
import { toPublic } from "@/lib/kb/sources/types";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireLocalUserId();
  if (!userId) return NextResponse.json({ error: "no_user" }, { status: 401 });

  let provider;
  try {
    provider = getEmbeddingProviderForUser(userId);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }

  const rows = listSources(provider.dimensions, userId);
  return NextResponse.json({ sources: rows.map(toPublic) });
}

export async function POST(req: NextRequest) {
  const userId = await requireLocalUserId();
  if (!userId) return NextResponse.json({ error: "no_user" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    url?: string;
    displayName?: string;
  };
  if (!body.url || !isLikelyUrl(body.url)) {
    return NextResponse.json({ error: "bad_url" }, { status: 400 });
  }

  let provider;
  try {
    provider = getEmbeddingProviderForUser(userId);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }

  const created = createSource(provider.dimensions, {
    url: body.url,
    displayName: body.displayName?.trim() || null,
    addedBy: userId
  });

  // Kick off the first refresh synchronously — clients want to see the
  // result. With a few-page MVP this stays under the route's 30s budget.
  const result = await refreshSource(provider, created.id);

  return NextResponse.json({
    source: { ...toPublic(created), ...result }
  });
}

function isLikelyUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
