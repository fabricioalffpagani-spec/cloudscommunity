import { afterEach, describe, expect, it, vi } from "vitest";
import { leaveCloud } from "../app/lib/leave-cloud";

afterEach(() => vi.unstubAllGlobals());

describe("Cloud exit", () => {
  it("uses the member endpoint and invalidates membership only after success", async () => {
    const changed = vi.fn();
    window.addEventListener("clouds:membership-changed", changed);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await leaveCloud("cloud-1", false);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/clouds/cloud-1/leave",
      expect.objectContaining({ method: "POST", credentials: "include" }),
    );
    expect(changed).toHaveBeenCalledOnce();
    window.removeEventListener("clouds:membership-changed", changed);
  });

  it("allows retry after an API error and uses the author endpoint", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: "Falha temporária" }),
      })
      .mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await expect(leaveCloud("cloud-1", true)).rejects.toThrow(
      "Falha temporária",
    );
    await expect(leaveCloud("cloud-1", true)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/clouds/cloud-1/exit",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
