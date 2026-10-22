import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecloudCard } from "../app/components/RecloudCard";

describe("RecloudCard", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("shows and links to the original creator", () => {
    render(<RecloudCard cloud={{ id: "cloud", title: "Uma Cloud", duration: "30min", href: "/cloud/cloud", status: "active", scheduledAt: null, author: { name: "Criadora", username: "criadora", avatarUrl: "/creator.png" } }} />);
    expect(screen.getByRole("link", { name: "Criadora" })).toHaveAttribute("href", "/users/criadora");
    expect(screen.getByRole("link", { name: "Criadora" }).querySelector("img")).toHaveAttribute("src", "/creator.png");
    expect(screen.getByRole("link", { name: "Uma Cloud" })).toHaveAttribute("href", "/cloud/cloud");
  });

  it("allows only the profile owner to undo a recloud and retains it on failure", async () => {
    const cloud = { id: "cloud", title: "Uma Cloud", duration: "30min", href: "/cloud/cloud", status: "active" as const, scheduledAt: null, author: { name: "Criadora", username: "criadora", avatarUrl: null } };
    const removed = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(<RecloudCard cloud={cloud} />);
    expect(screen.queryByRole("button", { name: "Opções da Cloud" })).not.toBeInTheDocument();
    rerender(<RecloudCard cloud={cloud} onRemoved={removed} />);
    fireEvent.click(screen.getByRole("button", { name: "Opções da Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: "Desfazer Recloud" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível desfazer");
    expect(removed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer Recloud" }));
    await waitFor(() => expect(removed).toHaveBeenCalledWith("cloud"));
    expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud/recloud", { method: "DELETE" });
  });
});
