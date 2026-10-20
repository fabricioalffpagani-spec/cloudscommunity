import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InvitePopup } from "../app/components/InvitePopup";

const session = vi.hoisted(() => ({ user: { id: "owner", email: "owner@example.com", displayName: "Ana" } }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ status: "authenticated", user: session.user }) }));
afterEach(() => window.history.replaceState({}, "", "/"));

describe("invitation popup", () => {
  it("shares the personalized link with the sender's code", async () => {
    session.user = { id: "owner", email: "owner@example.com", displayName: "Ana" };
    window.history.replaceState({}, "", "/?invitePreview=1");
    const url = "https://clouds.test/entrenoclouds?ref=ABC1234";
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, inviteUrl: url }) }));
    render(<InvitePopup />);
    const button = await screen.findByRole("button", { name: "Compartilhar convite" });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ url, text: "Ana está te convidando para o Clouds! Descubra conversas acontecendo agora..." })));
  });

  it("does not reuse a previous user's invitation after switching accounts", async () => {
    session.user = { id: "owner", email: "owner@example.com", displayName: "Ana" };
    window.history.replaceState({}, "", "/?invitePreview=1");
    vi.stubGlobal("navigator", { ...navigator, share: vi.fn() });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ inviteUrl: "https://clouds.test/?ref=ANA1234" }) }).mockReturnValueOnce(new Promise(() => {})));
    const view = render(<InvitePopup />);
    expect(await screen.findByRole("button", { name: "Compartilhar convite" })).toBeEnabled();
    session.user = { id: "other", email: "other@example.com", displayName: "Bia" };
    view.rerender(<InvitePopup />);
    expect(screen.queryByRole("button", { name: "Compartilhar convite" })).toBeNull();
  });
});
