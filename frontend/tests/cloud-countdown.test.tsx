import { describe, expect, it } from "vitest";
import { cloudRemainingSeconds } from "../app/lib/cloud-countdown";

describe("Cloud countdown", () => {
  it("recalculates from the original start when the duration is edited", () => {
    const start = new Date("2026-10-21T12:00:00Z");
    const now = start.getTime() + 5 * 60_000;
    const cloud = { createdAt: start, duration: "10min" };
    expect(cloudRemainingSeconds(cloud, now)).toBe(300);
    expect(cloudRemainingSeconds({ ...cloud, duration: "30min" }, now)).toBe(1500);
    expect(cloudRemainingSeconds({ ...cloud, duration: "2h" }, now)).toBe(6900);
  });

  it("uses the actual start for scheduled Clouds and never returns a negative time", () => {
    const createdAt = new Date("2026-10-21T10:00:00Z");
    const startedAt = "2026-10-21T12:00:00Z";
    const cloud = { createdAt, startedAt, duration: "10min" };
    expect(cloudRemainingSeconds(cloud, Date.parse("2026-10-21T12:05:00Z"))).toBe(300);
    expect(cloudRemainingSeconds(cloud, Date.parse("2026-10-21T12:15:00Z"))).toBe(0);
    expect(cloudRemainingSeconds(cloud, Date.parse("2026-10-21T11:55:00Z"))).toBe(600);
  });
});
