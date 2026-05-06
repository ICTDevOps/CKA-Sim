import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { routing } from "@/i18n/routing";

/**
 * Composes two responsibilities:
 *  1. i18n routing via next-intl (redirects `/` → `/en` ou `/fr`,
 *     enforces the locale prefix, sets the `NEXT_LOCALE` cookie).
 *  2. anonymous local user identification via a `cka-sim-uid` cookie.
 *
 * The user row itself is created lazily by API routes that touch the DB
 * (better-sqlite3 can't run in the Edge runtime where this middleware
 * lives).
 */

const UID_COOKIE = "cka-sim-uid";
const UUID_RE = /^[0-9a-f-]{36}$/i;
const ONE_YEAR_SEC = 60 * 60 * 24 * 365;

const intl = createIntlMiddleware(routing);

export default function middleware(req: NextRequest) {
  const res = intl(req);

  const existing = req.cookies.get(UID_COOKIE)?.value;
  if (!existing || !UUID_RE.test(existing)) {
    res.cookies.set({
      name: UID_COOKIE,
      value: uuid(),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: ONE_YEAR_SEC
    });
  }
  return res;
}

export const config = {
  // Tout sauf API routes, assets statiques et les screenshots.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|screenshots).*)"
  ]
};
