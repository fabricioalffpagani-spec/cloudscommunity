export type ForwardOrigin = { id: string; name: string };

export function cloudForwardMarker(origin: ForwardOrigin): string {
  return `↗ Encaminhada [cloud:${encodeURIComponent(origin.id)}:${encodeURIComponent(origin.name)}]`;
}

export function parseForwardedContent(content: string) {
  const match = content.match(/^↗\s*Encaminhada \[cloud:([^:\]\s]+):([^\]\s]+)\](?:\s|$)/i);
  if (match) {
    try {
      const origin = { id: decodeURIComponent(match[1]), name: decodeURIComponent(match[2]) };
      if (origin.id && origin.name) return { forwarded: true, origin, text: content.slice(match[0].length) };
    } catch { /* Treat malformed markers as ordinary text. */ }
  }
  const legacy = content.match(/^(?:↗\s*(?:Mensagem encaminhada|Encaminhada(?: de uma cloud)?)\s*)+/i);
  return { forwarded: Boolean(legacy), origin: null, text: legacy ? content.slice(legacy[0].length) : content, legacyCloud: Boolean(legacy && /de uma cloud/i.test(legacy[0])) };
}

/** Turn Cloud comment payloads into readable text while preserving ordinary messages. */
export function formatCloudCommentContent(content: string): string {
  try {
    const parsed = JSON.parse(content) as { type?: string; cloudTitle?: unknown; comment?: unknown; response?: unknown };
    if (parsed.type !== "cloud_comment_reply" && parsed.type !== "cloud_comment_reference") return content;
    const title = typeof parsed.cloudTitle === "string" && parsed.cloudTitle ? parsed.cloudTitle : "Cloud";
    const comment = typeof parsed.comment === "string" ? parsed.comment : "";
    const response = typeof parsed.response === "string" ? parsed.response : "";
    return [`Comentário em ${title}`, comment, response ? `Resposta: ${response}` : ""].filter(Boolean).join("\n");
  } catch { return content; }
}

export function readableMessageText(content: string): string {
  return formatCloudCommentContent(parseForwardedContent(content).text);
}
