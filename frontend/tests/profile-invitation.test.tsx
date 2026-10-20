import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileInvitation } from "../app/components/ProfileInvitation";

const session = vi.hoisted(() => ({ user: { id: "u", email: "u@example.com", name: "Ana", displayName: "Ana", username: "ana" } }));
vi.mock("../app/components/session-user", () => ({ useSessionUser: () => session, UserAvatar: () => <span>Foto</span> }));

describe("profile invitation", () => {
  it("shows the user's code and shares the matching invitation", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: "ANA1234", inviteUrl: "https://clouds.test/entrenoclouds?ref=ANA1234" }) }));
    render(<ProfileInvitation />);
    expect(await screen.findByText(/ANA1234/)).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Chamar amigos" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: "Ana está te convidando para o Clouds! Descubra conversas acontecendo agora...", url: "https://clouds.test/entrenoclouds?ref=ANA1234" })));
  });

  it("never exposes the previous account's code while a new invitation loads", async () => {
    session.user = { id: "u", email: "u@example.com", name: "Ana", displayName: "Ana", username: "ana" };
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ code: "ANA1234", inviteUrl: "https://clouds.test/?ref=ANA1234" }) }).mockReturnValueOnce(new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const view = render(<ProfileInvitation />);
    expect(await screen.findByText(/ANA1234/)).toBeInTheDocument();
    session.user = { id: "v", email: "v@example.com", name: "Bia", displayName: "Bia", username: "bia" };
    view.rerender(<ProfileInvitation />);
    expect(screen.queryByText(/ANA1234/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chamar amigos" })).toBeDisabled();
  });
});
