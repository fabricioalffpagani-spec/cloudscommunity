export function messagesConversationHref(conversationId: string) {
  return `/messages?conversation=${encodeURIComponent(conversationId)}`;
}

export function requestedConversationId(searchParams: Pick<URLSearchParams, "get">) {
  return searchParams.get("conversation")?.trim() || null;
}
