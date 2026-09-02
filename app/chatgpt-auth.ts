import { redirect } from "next/navigation";

import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getCurrentUser,
  requireUser,
  type AuthUser,
} from "./auth";
import { ensureSchema, getRuntimeDb } from "./api/_lib/clunk";

export type ChatGPTUser = AuthUser & { userId: string };

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  return toLegacyUser(await getCurrentUser());
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await requireUser(returnTo);
  await requireConsent(user.id, returnTo);
  return { ...user, userId: user.id };
}

/**
 * A signed-in person who has not yet agreed to the terms and the data collection is sent
 * to /consent before any workspace page renders. The answer is recorded there, once; after
 * that this is a single indexed read. Pages only — the API keeps its own contract, and an
 * agent holding a key is not a person reading a form.
 *
 * A missing row is treated as "not yet consented", never as consented: the user row is
 * created on the first API call, which a fresh sign-in may not have made yet.
 */
async function requireConsent(userId: string, returnTo: string): Promise<void> {
  const db = getRuntimeDb();
  await ensureSchema(db);
  const row = await db
    .prepare(`SELECT consented_at AS consentedAt FROM clunk_users WHERE id = ? LIMIT 1`)
    .bind(userId)
    .first<{ consentedAt: string | null }>();
  if (row?.consentedAt) return;
  redirect(`/consent?return_to=${encodeURIComponent(returnTo)}`);
}

function toLegacyUser(user: AuthUser | null): ChatGPTUser | null {
  return user ? { ...user, userId: user.id } : null;
}

export { chatGPTSignInPath, chatGPTSignOutPath };
