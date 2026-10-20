import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InviteCloudsButton } from "../app/components/InviteCloudsButton";

vi.mock("../app/components/session-user", () => ({ useSessionUser: () => ({ user: { id: "u1", email: "test@example.com", displayName: "Ana" } }) }));
beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ inviteUrl: `${window.location.origin}/entrenoclouds?ref=ABC1234` }) })));

afterEach(() => vi.unstubAllGlobals());

describe("InviteCloudsButton", () => {
  const invitationText = "Ana está te convidando para o Clouds! Descubra conversas acontecendo agora...";
  const inviteUrl = `${window.location.origin}/entrenoclouds?ref=ABC1234`;

  it("opens native sharing with the branded invitation link and text", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    render(<InviteCloudsButton />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoas para o Clouds" }));

    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: "Clouds",
      text: invitationText,
      url: inviteUrl,
    })));
  });

  it("copies the complete invitation when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<InviteCloudsButton compact />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoas para o Clouds" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${invitationText}\n${inviteUrl}`));
    expect(screen.getByRole("status")).toHaveTextContent("Link do convite copiado.");
  });

  it("retries with a compatible native payload when a browser rejects the full payload", async () => {
    const share = vi.fn()
      .mockRejectedValueOnce(new TypeError("unsupported payload"))
      .mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    render(<InviteCloudsButton compact />);

    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoas para o Clouds" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(share).toHaveBeenLastCalledWith({
      title: "Clouds",
      text: `${invitationText}\n${inviteUrl}`,
    });
  });
});
