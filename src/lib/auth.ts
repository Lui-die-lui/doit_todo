import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";

// 7 days -- matches CLAUDE.md's default plan; recorded here (and in the T07 doc) as the
// explicit, intentional value rather than relying on better-auth's same-value default.
const SESSION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
// How often an active session's expiry is pushed back out on use.
const SESSION_UPDATE_AGE_SECONDS = 60 * 60 * 24;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    // `revokeOtherSessions` isn't a server-wide setting -- it's passed per call to
    // authClient.changePassword() so a password change kills a leaked/old session
    // token the moment the owner rotates their password. See the change-password UI.
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      // No `scope` override -- better-auth's google provider default
      // (["email", "profile", "openid"]) is already the minimal sign-in scope.
      // Never add Drive/Gmail/Calendar scopes here.
    },
  },
  session: {
    expiresIn: SESSION_EXPIRES_IN_SECONDS,
    updateAge: SESSION_UPDATE_AGE_SECONDS,
  },
  account: {
    accountLinking: {
      // A Google sign-in must never silently attach itself to an existing
      // email/password account with the same email -- see CLAUDE.md 6장 and
      // docs/T07_AUTH_IMPLEMENTATION.md's account-linking decision.
      enabled: false,
    },
  },
  user: {
    deleteUser: {
      // Off by default in better-auth. No sendDeleteAccountVerification is
      // configured (no email service wired up), so /mypage's delete flow relies on
      // the built-in password check (credential accounts) or session-freshness
      // check (Google accounts) instead of an email confirmation link.
      enabled: true,
    },
  },
});
