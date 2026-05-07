import { NextRequest, NextResponse } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { getEmbeddingProviderForUser } from "@/lib/embeddings";
import { deleteSource, getSource } from "@/lib/kb/sources/repository";

export const runtime = "nodejs";

export async function DELETE(
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

  // Light ownership check: a user can only delete their own sources.
  const row = getSource(provider.dimensions, id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (row.added_by && row.added_by !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const ok = deleteSource(provider.dimensions, id);
  return NextResponse.json({ deleted: ok });
}
