import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getCurrentUser,
  requireUser,
  type AuthUser,
} from "./auth";

export type ChatGPTUser = AuthUser & { userId: string };

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  return toLegacyUser(await getCurrentUser());
}

export async function requireChatGPTUser(
  returnTo: string,
): Promise<ChatGPTUser> {
  const user = await requireUser(returnTo);
  return { ...user, userId: user.id };
}

function toLegacyUser(user: AuthUser | null): ChatGPTUser | null {
  return user ? { ...user, userId: user.id } : null;
}

export { chatGPTSignInPath, chatGPTSignOutPath };
