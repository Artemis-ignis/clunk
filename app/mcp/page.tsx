import { redirect } from "next/navigation";

/**
 * 2026-09-02: this page repeated /agents — same endpoint, same steps, same
 * boundary, different wording. The endpoint's live status (McpEndpointStatus)
 * and the connection steps now live only on /agents, so there is one place to
 * read and one place to keep correct.
 */
export default function McpPage(): never {
  redirect("/agents");
}
