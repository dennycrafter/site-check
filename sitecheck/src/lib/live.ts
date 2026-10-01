/** ?live=1 on review pages: /demo shows them next to the phone and they refresh on their own. */
export function isLive(params: Record<string, string | string[] | undefined>): boolean {
  return params.live === "1";
}

/** Keeps ?live=1 on links inside a live page, so clicking around in /demo stays live. */
export function liveHref(href: string, live: boolean): string {
  if (!live) return href;
  return `${href}${href.includes("?") ? "&" : "?"}live=1`;
}
