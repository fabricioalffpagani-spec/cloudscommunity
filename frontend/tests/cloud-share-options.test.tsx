import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CloudShareOptions } from "../app/components/CloudShareOptions";

describe("opções para compartilhar Cloud", () => {
  it.each([375, 1280])("mantém apps, mensageiro e cópia do link em %ipx", (width) => {
    vi.stubGlobal("innerWidth", width);
    const onShare = vi.fn();
    const onContacts = vi.fn();
    const onCopy = vi.fn();
    const { rerender } = render(<CloudShareOptions onShare={onShare} onContacts={onContacts} onCopy={onCopy} copied={false} />);
    const apps = screen.getByRole("button", { name: /Compartilhar com apps/ });
    expect(apps.querySelectorAll("svg circle")).toHaveLength(3);
    expect(screen.queryByText("Enviar para fora")).not.toBeInTheDocument();
    fireEvent.click(apps);
    fireEvent.click(screen.getByRole("button", { name: /Enviar no mensageiro/ }));
    fireEvent.click(screen.getByRole("button", { name: "Copiar link" }));
    expect(onShare).toHaveBeenCalledOnce();
    expect(onContacts).toHaveBeenCalledOnce();
    expect(onCopy).toHaveBeenCalledOnce();
    rerender(<CloudShareOptions onShare={onShare} onContacts={onContacts} onCopy={onCopy} copied />);
    expect(screen.getByText("Link copiado!")).toBeVisible();
    vi.unstubAllGlobals();
  });
});
