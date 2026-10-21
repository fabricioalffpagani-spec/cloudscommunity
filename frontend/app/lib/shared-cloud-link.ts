export function sharedCloudLink(url: string | null | undefined, origin: string): "talk" | "read" | null {
  if (!url) return null;
  try {
    const parsed = new URL(url, origin);
    if (parsed.origin !== origin) return null;
    if (/^\/cloud\/[^/]+\/conversation\/?$/.test(parsed.pathname) || (parsed.pathname === "/read" && parsed.searchParams.has("cloud"))) return "read";
    if (/^\/cloud\/[^/]+\/?$/.test(parsed.pathname)) return "talk";
  } catch { /* Invalid links remain ordinary link messages. */ }
  return null;
}
