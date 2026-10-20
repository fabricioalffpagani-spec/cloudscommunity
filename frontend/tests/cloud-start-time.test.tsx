import { describe, expect, it } from "vitest";
import { cloudElapsedSeconds } from "../app/lib/cloud-start-time";

describe("cloud countdown", () => {
  it("counts from the scheduled start instead of the earlier creation", () => {
    const cloud = { createdAt: "2026-01-01T09:00:00Z", startedAt: "2026-01-01T10:00:00Z" };
    expect(cloudElapsedSeconds(cloud, Date.parse("2026-01-01T10:02:00Z"))).toBe(120);
  });
  it("uses creation time for older clouds without a start time", () => {
    expect(cloudElapsedSeconds({ createdAt: "2026-01-01T10:00:00Z", startedAt: null }, Date.parse("2026-01-01T10:02:00Z"))).toBe(120);
  });
});
