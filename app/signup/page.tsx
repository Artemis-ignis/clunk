import { getChatGPTUser } from "../chatgpt-auth";
import { AuthEntryCard } from "../components/AuthEntryCard";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "회원가입",
  description: "ChatGPT 계정으로 Clunk 비공개 워크스페이스를 만듭니다.",
  path: "/signup",
});

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const user = await getChatGPTUser();
  const params = await searchParams;
  const returnTo =
    params.return_to?.startsWith("/") && !params.return_to.startsWith("//")
      ? params.return_to
      : "/dashboard";

  return <AuthEntryCard mode="signup" user={user} returnTo={returnTo} />;
}
