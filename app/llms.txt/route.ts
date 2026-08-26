import llmsText from "../../public/llms.txt?raw";

export const dynamic = "force-static";

export function GET(): Response {
  return new Response(llmsText, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-type": "text/plain; charset=utf-8",
    },
  });
}
