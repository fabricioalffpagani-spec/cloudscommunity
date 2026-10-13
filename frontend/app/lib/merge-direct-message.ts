type MergeableMessage = {
  id: string;
  clientMessageId?: string | null;
  pending?: boolean;
  peaks?: number[] | null;
};

export function mergeDirectMessage<T extends MergeableMessage>(list: T[], next: T): T[] {
  const index = next.clientMessageId
    ? list.findIndex((item) => item.clientMessageId === next.clientMessageId)
    : -1;
  if (index >= 0) {
    const existing = list[index];
    return list.map((item, i) =>
      i === index
        ? { ...next, pending: false, peaks: next.peaks ?? existing.peaks ?? null }
        : item,
    );
  }
  if (list.some((item) => item.id === next.id)) return list;
  return [...list, next];
}
