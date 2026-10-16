import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteCloudsButton } from "../app/components/InviteCloudsButton";

afterEach(() => vi.unstubAllGlobals());

describe("InviteCloudsButton", () => {
  const invitationText = "Vem pro Clouds comigo! ☁️\nÉ uma plataforma de conversas públicas ao vivo.\nCriei meu perfil aqui:";
  const inviteUrl = `${window.location.origin}/entrenoclouds`;

  it("opens native sharing with the branded invitation link and text", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    render(<InviteCloudsButton />);

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

    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoas para o Clouds" }));

    await waitFor(() => expect(share).toHaveBeenCalledTimes(2));
    expect(share).toHaveBeenLastCalledWith({
      title: "Clouds",
      text: `${invitationText}\n${inviteUrl}`,
    });
  });
});
