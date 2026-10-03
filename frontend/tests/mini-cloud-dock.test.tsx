import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MiniCloudDock } from "../app/components/MiniCloudDock";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: { id: "viewer" } }) }));

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("clouds:minimized-cloud", JSON.stringify({ id: "cloud-1", title: "Teste", isAuthor: false }));
});

describe("Mini Cloud leave", () => {
  it("keeps the Cloud usable after a failed leave and allows retry without reload", async () => {
    let attempts = 0;
    const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
      if (input.endsWith("/leave") && init?.method === "POST") {
        attempts += 1;
        return { ok: attempts > 1 };
      }
      if (input.endsWith("/messages?take=12")) return { json: async () => ({ messages: [] }) };
      return { json: async () => ({ cloud: { createdAt: new Date().toISOString(), duration: "30min" } }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MiniCloudDock />);
    fireEvent.click(await screen.findByRole("button", { name: "Sair da Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: /^Sair$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Tente novamente");
    expect(screen.getByText("Teste")).toBeVisible();
    expect(localStorage.getItem("clouds:minimized-cloud")).toContain("cloud-1");
    expect(screen.getByRole("button", { name: /^Sair$/ })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    fireEvent.click(screen.getByRole("button", { name: "Sair da Cloud" }));
    expect(screen.getByRole("button", { name: /^Sair$/ })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /^Sair$/ }));
    await waitFor(() => expect(screen.queryByText("Teste")).not.toBeInTheDocument());
    expect(localStorage.getItem("clouds:minimized-cloud")).toBeNull();
    expect(attempts).toBe(2);
  });
});
