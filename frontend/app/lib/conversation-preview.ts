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
