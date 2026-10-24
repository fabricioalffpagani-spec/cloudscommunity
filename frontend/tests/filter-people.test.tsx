import { describe, expect, it } from "vitest";
import { filterPeople } from "../app/lib/filter-people";

describe("people search", () => {
  const people = Array.from({ length: 100 }, (_, index) => ({
    displayName: `Pessoa ${index}`,
    username: `usuario${index}`,
  }));

  it("matches partial names and usernames without case sensitivity", () => {
    expect(filterPeople(people, "PESSOA 42")).toEqual([people[42]]);
    expect(filterPeople(people, "@USUARIO42")).toEqual([people[42]]);
  });

  it("preserves an unfiltered list and returns an empty result", () => {
    expect(filterPeople(people, " ")).toHaveLength(100);
    expect(filterPeople(people, "inexistente")).toEqual([]);
  });
});
