import { NextRequest, NextResponse } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { createRun } from "@/lib/db/repositories/runs";

// Force Node runtime — better-sqlite3 is a native module that can't run on
// the Edge runtime.
export const runtime = "nodejs";

interface CreateBody {
  mode?: "training" | "exam";
  totalQuestions?: number;
  categoryFilter?: string | null;
  k8sVersion?: string | null;
}

export async function POST(req: NextRequest) {
  const userId = await requireLocalUserId();
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as CreateBody;
  const totalQuestions = Math.max(1, Math.min(100, body.totalQuestions ?? 10));
  const mode = body.mode === "exam" ? "exam" : "training";
  const run = createRun({
    userId,
    mode,
    totalQuestions,
    categoryFilter: body.categoryFilter ?? null,
    k8sVersion: body.k8sVersion ?? null
  });
  return NextResponse.json({ runId: run.id, startedAt: run.started_at });
}
