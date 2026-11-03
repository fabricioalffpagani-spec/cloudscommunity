import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionUserProvider } from "../app/components/session-user";

describe("session revalidation performance", () => {
  it("coalesces focus and visibility revalidation into one auth/me request", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SessionUserProvider><div>conteúdo</div></SessionUserProvider>);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.focus(window);
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => window.setTimeout(resolve, 75));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
