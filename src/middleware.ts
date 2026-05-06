import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";

/**
 * Ensures every visitor has a stable `cka-sim-uid` cookie. The uid is used
 * as the user id (`users.id`) by the persistence layer at Niveau 1.
 *
 * The user row itself is created lazily on the first DB-touching request
 * (see `ensureAnonymousUser` in `lib/db/repositories/users.ts`). This avoids
 * touching the DB from the Edge runtime where better-sqlite3 can't run.
 */

const COOKIE_NAME = "cka-sim-uid";
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const existing = req.cookies.get(COOKIE_NAME)?.value;
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) {
    return NextResponse.next();
  }
  const res = NextResponse.next();
  res.cookies.set({
    name: COOKIE_NAME,
    value: uuid(),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: ONE_YEAR_SEC
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|screenshots).*)"]
};
