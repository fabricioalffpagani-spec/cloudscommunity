import { describe, expect, it } from "vitest";
import {
  buildMentionCandidates,
  type MentionCandidate,
} from "../app/lib/mention-candidates";

const member: MentionCandidate = {
  userId: "member",
  username: "alex",
  displayName: "Alex",
  inCloud: true,
};
const followed: MentionCandidate = {
  userId: "followed",
  username: "alexandra",
  displayName: "Alexandra",
  inCloud: false,
};
const similar: MentionCandidate = {
  userId: "similar",
  username: "maria_alex",
  displayName: "Maria",
  inCloud: false,
};

describe("mention suggestions", () => {
  it("combines members and followed people once, with username prefixes first", () => {
    expect(
      buildMentionCandidates(
        "ale",
        [member],
        [{ ...member, inCloud: false }, followed, similar],
        "viewer",
      ),
    ).toEqual([member, followed, similar]);
  });

  it("matches display names, excludes the viewer and ignores unknown users", () => {
    expect(
      buildMentionCandidates(
        "maria",
        [member],
        [similar, { ...followed, userId: "viewer" }],
        "viewer",
      ),
    ).toEqual([similar]);
    expect(
      buildMentionCandidates("ninguém", [member], [followed], "viewer"),
    ).toEqual([]);
    expect(
      buildMentionCandidates(null, [member], [followed], "viewer"),
    ).toEqual([]);
  });
});
