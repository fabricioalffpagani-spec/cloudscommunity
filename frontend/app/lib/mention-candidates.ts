export type MentionCandidate = {
  userId: string;
  username: string;
  displayName: string;
  inCloud: boolean;
};

export function buildMentionCandidates(
  query: string | null,
  members: MentionCandidate[],
  followed: MentionCandidate[],
  viewerId?: string | null,
  limit = 8,
): MentionCandidate[] {
  if (query === null) return [];
  const term = query.toLocaleLowerCase("pt-BR");
  const unique = new Map<string, MentionCandidate>();
  for (const person of [...members, ...followed]) {
    if (person.userId !== viewerId && !unique.has(person.userId))
      unique.set(person.userId, person);
  }
  const rank = (person: MentionCandidate) => {
    const username = person.username.toLocaleLowerCase("pt-BR");
    const displayName = person.displayName.toLocaleLowerCase("pt-BR");
    return username.startsWith(term)
      ? 0
      : displayName.startsWith(term)
        ? 1
        : username.includes(term) || displayName.includes(term)
          ? 2
          : 3;
  };
  return [...unique.values()]
    .filter((person) => rank(person) < 3)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(b.inCloud) - Number(a.inCloud) ||
        a.username.localeCompare(b.username),
    )
    .slice(0, limit);
}
