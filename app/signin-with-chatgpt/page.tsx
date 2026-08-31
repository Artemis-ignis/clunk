import { redirect } from "next/navigation";
import { safeOAuthReturnPath } from "../oauth";

export const dynamic = "force-dynamic";

/**
 * Legacy Sites-host gateway (2026-08-31 master review: a dead end on this
 * deployment). Old links keep working by landing on the real sign-in page.
 */
export default async function LegacySignInRedirect({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeOAuthReturnPath(params.return_to ?? "/app");
  redirect(`/login?return_to=${encodeURIComponent(returnTo)}`);
}
