import type { AnchorHTMLAttributes } from "react";

type NativeLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  /** Kept for source compatibility with the previous Next Link call sites. */
  prefetch?: boolean;
};

/**
 * Sites serves Clunk as a static/worker-rendered surface. Native anchors are
 * deliberate here: they preserve browser navigation when the client router
 * is unavailable or hydration is delayed, instead of swallowing the click.
 */
export default function NativeLink({ prefetch: _prefetch, ...props }: NativeLinkProps) {
  return <a {...props} />;
}
