/**
 * Conversations are created before their first message. Keep their inbox
 * preview empty until there is actual message content to format.
 */
export function getInboxConversationPreview(
  rawPreview: string | null | undefined,
  formatPreview: (preview: string) => string,
): string {
  return rawPreview?.trim() ? formatPreview(rawPreview) : "";
}

/** Format structured link labels for inboxes and reply previews. */
export function formatLinkPreview(rawLabel: string | null | undefined, fallbackUrl?: string | null): string {
  if (!rawLabel) {
    try { return fallbackUrl ? new URL(fallbackUrl).hostname.replace(/^www\./, "") : "Link compartilhado"; }
    catch { return "Link compartilhado"; }
  }
  try {
    const parsed = JSON.parse(rawLabel) as { type?: string; name?: string; label?: string; cloudTitle?: string; cloudVisibility?: string };
    if (parsed.type === "profile_share") return parsed.name ? `Perfil: ${parsed.name}` : "Perfil compartilhado";
    if (parsed.type === "forwarded_link") return parsed.label || "Link compartilhado";
    if (parsed.type === "cloud_invitation") {
      const visibility = parsed.cloudVisibility === "private" ? "privada" : "pública";
      return parsed.cloudTitle ? `☁️ Convite: ${parsed.cloudTitle}` : `☁️ Convite para Cloud ${visibility}`;
    }
  } catch {
    // Older inbox previews may have been truncated in the middle of the JSON.
    if (/^\s*\{\s*"type"\s*:\s*"profile_share"/.test(rawLabel)) {
      const name = rawLabel.match(/"name"\s*:\s*("(?:[^"\\]|\\.)*")/);
      if (name) {
        try { return `Perfil: ${JSON.parse(name[1])}`; } catch { /* use generic label */ }
      }
      return "Perfil compartilhado";
    }
  }
  return rawLabel;
}
