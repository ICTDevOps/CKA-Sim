import { NextRequest, NextResponse } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { recordAttempt } from "@/lib/db/repositories/attempts";

export const runtime = "nodejs";

interface AttemptBody {
  questionId?: string;
  category?: string;
  domain?: string;
  difficulty?: number;
  userInput?: string;
  isCorrect?: boolean;
  timeMs?: number;
  hintsUsed?: number;
  keystrokes?: number;
  optimalKeystrokes?: number;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const userId = await requireLocalUserId();
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 401 });
  }
  const { id: runId } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as AttemptBody;
  if (
    !b.questionId ||
    !b.category ||
    !b.domain ||
    typeof b.difficulty !== "number" ||
    typeof b.timeMs !== "number" ||
    typeof b.isCorrect !== "boolean"
  ) {
    return NextResponse.json({ error: "bad_payload" }, { status: 400 });
  }
  const row = recordAttempt({
    runId,
    userId,
    questionId: b.questionId,
    category: b.category,
    domain: b.domain,
    difficulty: b.difficulty,
    userInput: b.userInput ?? "",
    isCorrect: b.isCorrect,
    timeMs: Math.max(0, b.timeMs),
    hintsUsed: b.hintsUsed ?? 0,
    keystrokes: b.keystrokes ?? null,
    optimalKeystrokes: b.optimalKeystrokes ?? null
  });
  if (!row) {
    return NextResponse.json({ error: "run_not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
