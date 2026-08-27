import { getChatGPTUser } from "../chatgpt-auth";
import { AuthEntryCard } from "../components/AuthEntryCard";
import { createPageMetadata } from "../components/site-metadata";

export const dynamic = "force-dynamic";
export const metadata = createPageMetadata({
  title: "로그인",
  description: "ChatGPT 계정으로 Clunk 비공개 워크스페이스에 입장합니다. 별도 회원가입 절차는 없습니다.",
  path: "/login",
});

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const user = await getChatGPTUser();
  const params = await searchParams;
  const returnTo =
    params.return_to?.startsWith("/") && !params.return_to.startsWith("//")
      ? params.return_to
      : "/app";

  return <AuthEntryCard mode="login" user={user} returnTo={returnTo} />;
}
