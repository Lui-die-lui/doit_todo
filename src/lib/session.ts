import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { account } from "@/db/auth-schema";
import { auth } from "./auth";

/** Reads the current session from the verified server-side cookie -- never from any
 * client-supplied id/header/body field. Returns null when signed out. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** For server components/layouts backing a data screen: redirects signed-out
 * browsers to the public login screen (`/`) instead of rendering the page. */
export async function requireSessionOrRedirect() {
  const session = await getSession();
  if (!session) redirect("/");
  return session;
}

/** For Server Actions: the caller decides how to surface "no session" (they don't
 * carry HTTP status codes), but this is the one place that reads it. */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}

/** How this user signed up, read from their `account` row(s) -- "credential" (email
 * + password) or "google". accountLinking is disabled (see auth.ts), so a real user
 * has exactly one; this takes the first if that ever changes. Null only if the
 * account row is somehow missing. */
export async function getAccountProvider(userId: string): Promise<"credential" | "google" | null> {
  const [row] = await db.select({ providerId: account.providerId }).from(account).where(eq(account.userId, userId));
  return (row?.providerId as "credential" | "google" | undefined) ?? null;
}
