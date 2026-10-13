type MergeableMessage = {
  id: string;
  clientMessageId?: string | null;
  pending?: boolean;
  failed?: boolean;
  peaks?: number[] | null;
};

export function mergeDirectMessage<T extends MergeableMessage>(
  list: T[],
  next: T,
): T[] {
  const index = next.clientMessageId
    ? list.findIndex((item) => item.clientMessageId === next.clientMessageId)
    : -1;
  if (index >= 0) {
    const existing = list[index];
    return list.map((item, i) =>
      i === index
        ? {
            ...next,
            pending: false,
            peaks: next.peaks ?? existing.peaks ?? null,
          }
        : item,
    );
  }
  if (list.some((item) => item.id === next.id)) return list;
  return [...list, next];
}

export function markDirectMessageFailed<T extends MergeableMessage>(
  list: T[],
  clientMessageId: string,
): T[] {
  return list.map((message) =>
    message.id === clientMessageId && message.pending
      ? { ...message, failed: true }
      : message,
  );
}

export function retryDirectMessage<T extends MergeableMessage>(
  list: T[],
  clientMessageId: string,
): T[] {
  return list.map((message) =>
    message.id === clientMessageId && message.failed
      ? { ...message, pending: true, failed: false }
      : message,
  );
}
