"use client";

import { createAuthClient } from "better-auth/react";

// No `baseURL` needed -- the client talks to /api/auth/* on the same origin.
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
