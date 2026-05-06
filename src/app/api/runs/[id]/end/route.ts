import { NextRequest, NextResponse } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { endRun } from "@/lib/db/repositories/runs";

export const runtime = "nodejs";

interface EndBody {
  correctCount?: number;
  totalTimeMs?: number;
  scorePercent?: number;
}

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await requireLocalUserId();
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 401 });
  }
  const { id: runId } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as EndBody;
  const run = endRun({
    runId,
    userId,
    correctCount: Math.max(0, b.correctCount ?? 0),
    totalTimeMs: Math.max(0, b.totalTimeMs ?? 0),
    scorePercent: Math.max(0, Math.min(100, b.scorePercent ?? 0))
  });
  if (!run) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }
  return NextResponse.json({ run });
}
