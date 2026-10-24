export function filterPeople<
  T extends { displayName: string; username: string },
>(people: T[], query: string): T[] {
  const needle = query.trim().replace(/^@/, "").toLocaleLowerCase();
  if (!needle) return people;
  return people.filter(
    (person) =>
      person.displayName.toLocaleLowerCase().includes(needle) ||
      person.username.toLocaleLowerCase().includes(needle),
  );
}
