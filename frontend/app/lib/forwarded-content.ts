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
