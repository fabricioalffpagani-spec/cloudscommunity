import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecloudMenuItem } from "../app/components/RecloudAction";

afterEach(() => vi.unstubAllGlobals());
describe("Recloud menu", () => {
  it("publishes and undoes a participant's Recloud", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.method ? { ok: true } : { canRecloud: true, reclouded: false } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<RecloudMenuItem cloudId="cloud" />);
    fireEvent.click(await screen.findByRole("button", { name: "Republicar Cloud" }));
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer Recloud" }));
    expect(await screen.findByRole("button", { name: "Republicar Cloud" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud/recloud", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud/recloud", { method: "DELETE" });
  });
  it("does not offer the action when ineligible", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ canRecloud: false, reclouded: false }) }));
    const { container } = render(<RecloudMenuItem cloudId="cloud" />);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
  it("reports a failed publication without changing the state", async () => {
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => init?.method ? { ok: false, json: async () => ({ message: "Não foi possível republicar." }) } : { ok: true, json: async () => ({ canRecloud: true, reclouded: false }) }));
    render(<RecloudMenuItem cloudId="cloud" />);
    fireEvent.click(await screen.findByRole("button", { name: "Republicar Cloud" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível republicar.");
    expect(screen.getByRole("button", { name: "Republicar Cloud" })).toBeInTheDocument();
  });
});
