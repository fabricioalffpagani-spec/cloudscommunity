import { describe, expect, it, vi } from "vitest";
import { requestCloudFeed } from "../app/lib/cloud-feed-request";

describe("cloud feed request deduplication", () => {
  it("shares concurrent loads but allows later revalidation", async () => {
    let resolveFirst!: (value: { ok: boolean; json: () => Promise<{ clouds: { id: string }[] }> }) => void;
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveFirst = resolve; }))
      .mockResolvedValue({ ok: true, json: async () => ({ clouds: [{ id: "cloud-2" }] }) });
    vi.stubGlobal("fetch", fetchMock);

    const first = requestCloudFeed<{ id: string }>("/api/clouds");
    const duplicate = requestCloudFeed<{ id: string }>("/api/clouds");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFirst({ ok: true, json: async () => ({ clouds: [{ id: "cloud-1" }] }) });
    await expect(Promise.all([first, duplicate])).resolves.toEqual([
      [{ id: "cloud-1" }],
      [{ id: "cloud-1" }],
    ]);

    await expect(requestCloudFeed<{ id: string }>("/api/clouds")).resolves.toEqual([
      { id: "cloud-2" },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
