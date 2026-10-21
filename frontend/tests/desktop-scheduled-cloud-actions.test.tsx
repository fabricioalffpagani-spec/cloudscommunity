import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesktopScheduledCloudActions } from "../app/components/DesktopScheduledCloudActions";

describe("controles de Clouds agendadas no desktop", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("mostra a data e ativa o lembrete com confirmação", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    render(<DesktopScheduledCloudActions cloudId="cloud 1" title="Estreia" scheduledAt="2099-10-21T12:00:00Z" />);
    fireEvent.click(screen.getByRole("button", { name: "Ver data de estreia" }));
    expect(screen.getByText(/Estreia em/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Avisar-me na estreia" }));
    expect(await screen.findByRole("dialog")).toHaveTextContent("Você será notificado quando “Estreia” estrear.");
    expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud%201/join", { method: "POST" });
    expect(screen.getByRole("button", { name: "Lembrete ativado" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("informa falha e permite tentar novamente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    render(<DesktopScheduledCloudActions cloudId="1" title="Estreia" scheduledAt="2099-10-21T12:00:00Z" />);
    fireEvent.click(screen.getByRole("button", { name: "Avisar-me na estreia" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível ativar o lembrete."));
    expect(screen.getByRole("button", { name: "Avisar-me na estreia" })).toBeEnabled();
  });

  it("não mostra controles para Clouds ativas", () => {
    render(<DesktopScheduledCloudActions cloudId="1" title="Ativa" scheduledAt="2020-01-01T00:00:00Z" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
