import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InviteCloudsButton } from "../app/components/InviteCloudsButton";

afterEach(() => vi.unstubAllGlobals());

describe("InviteCloudsButton", () => {
  it("opens native sharing with the signup link and invitation text", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    render(<InviteCloudsButton />);

    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoas para o Clouds" }));

    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({
      title: "Clouds",
      text: "Junte a galera no Clouds!",
      url: `${window.location.origin}/signup`,
    })));
  });

  it("copies the complete invitation when native sharing is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    render(<InviteCloudsButton compact />);

    fireEvent.click(screen.getByRole("button", { name: "Convidar pessoas para o Clouds" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`Junte a galera no Clouds!\n${window.location.origin}/signup`));
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
      text: `Junte a galera no Clouds!\n${window.location.origin}/signup`,
    });
  });
});
