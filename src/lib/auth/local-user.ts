import { cookies } from "next/headers";
import { ensureAnonymousUser } from "@/lib/db/repositories/users";

/**
 * Reads the `cka-sim-uid` cookie set by the middleware and ensures a
 * matching `users` row exists. Returns the user id, or null if the cookie
 * is missing/malformed (which should never happen behind the middleware,
 * but guards against direct API calls from clients that don't accept
 * cookies).
 */
export async function requireLocalUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const uid = cookieStore.get("cka-sim-uid")?.value;
  if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) return null;
  ensureAnonymousUser(uid);
  return uid;
}
