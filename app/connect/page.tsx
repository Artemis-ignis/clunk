import { redirect } from "next/navigation";

/**
 * 2026-09-02: /connect, /mcp and /agents were three near-identical pages
 * explaining the same Clunk connection. A visitor who found two of them could not
 * tell which one was current, and each had its own half-translated copy.
 *
 * /agents is the one page now. Everything that used to render here — the
 * sample run (SampleRunWorkbench), the client setup (AgentsClient), the live
 * endpoint panel — is there, in one order, under one set of words.
 *
 * The redirect keeps the anchor: anyone holding a /connect or /connect#connect
 * link lands on the client-setup section of /agents.
 */
export default function ConnectPage(): never {
  redirect("/agents#connect");
}
