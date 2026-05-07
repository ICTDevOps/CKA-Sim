import { NextRequest, NextResponse } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { getEmbeddingProviderForUser } from "@/lib/embeddings";
import { refreshSource } from "@/lib/kb/crawler";
import { getSource } from "@/lib/kb/sources/repository";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await requireLocalUserId();
  if (!userId) return NextResponse.json({ error: "no_user" }, { status: 401 });
  const { id } = await ctx.params;

  let provider;
  try {
    provider = getEmbeddingProviderForUser(userId);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 400 }
    );
  }

  const row = getSource(provider.dimensions, id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.added_by && row.added_by !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const result = await refreshSource(provider, id);
  return NextResponse.json({ result });
}
