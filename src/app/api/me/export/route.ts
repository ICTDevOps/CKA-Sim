import { NextResponse } from "next/server";
import { requireLocalUserId } from "@/lib/auth/local-user";
import { getUser } from "@/lib/db/repositories/users";
import { listUserRuns } from "@/lib/db/repositories/runs";
import { listUserAttempts } from "@/lib/db/repositories/attempts";

export const runtime = "nodejs";

/**
 * Returns the full history of the local user as a JSON dump. Clients can
 * persist this to a file for backup or to migrate to another instance.
 */
export async function GET() {
  const userId = await requireLocalUserId();
  if (!userId) {
    return NextResponse.json({ error: "no_user" }, { status: 401 });
  }
  const user = getUser(userId);
  const runs = listUserRuns(userId, 10_000);
  const attempts = listUserAttempts(userId);
  return NextResponse.json(
    {
      exportedAt: Date.now(),
      schemaVersion: 1,
      user,
      runs,
      attempts
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="cka-sim-export-${Date.now()}.json"`
      }
    }
  );
}
