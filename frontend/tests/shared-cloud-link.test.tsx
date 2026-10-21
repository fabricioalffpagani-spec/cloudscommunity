import { describe, expect, it } from "vitest";
import { sharedCloudLink } from "../app/lib/shared-cloud-link";

describe("shared Cloud links", () => {
  const origin = "https://clouds.test";
  it("recognizes Talk and Read links, including previously shared links", () => {
    expect(sharedCloudLink(`${origin}/cloud/123?join=1`, origin)).toBe("talk");
    expect(sharedCloudLink(`${origin}/cloud/123/conversation?from=read`, origin)).toBe("read");
    expect(sharedCloudLink("/read?cloud=123", origin)).toBe("read");
  });
  it("leaves unrelated and external links as ordinary links", () => {
    expect(sharedCloudLink("https://other.test/cloud/123", origin)).toBeNull();
    expect(sharedCloudLink(`${origin}/users/123`, origin)).toBeNull();
    expect(sharedCloudLink("invalid url", origin)).toBeNull();
  });
});
