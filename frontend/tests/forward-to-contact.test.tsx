import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForwardToContactModal } from "../app/components/ForwardToContactModal";

afterEach(() => vi.unstubAllGlobals());

describe("republicar pelo encaminhamento", () => {
  it("oferece a ação e mostra o estado atualizado e erros", () => {
    const toggle = vi.fn();
    const props = { title: "Encaminhar Cloud", url: "/cloud/1", label: "Cloud", contacts: [], onClose: vi.fn() };
    const { rerender } = render(<ForwardToContactModal {...props} recloud={{ reclouded: false, busy: false, error: "", onToggle: toggle }} />);
    const republicar = screen.getByRole("button", { name: "Republicar Cloud" });
    expect(republicar).toHaveAttribute("aria-pressed", "false");
    expect(republicar.querySelector("svg")).toBeInTheDocument();
    fireEvent.click(republicar);
    expect(toggle).toHaveBeenCalledOnce();
    rerender(<ForwardToContactModal {...props} recloud={{ reclouded: true, busy: true, error: "Falha ao republicar", onToggle: toggle }} />);
    expect(screen.getByRole("button", { name: "Desfazer Recloud" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desfazer Recloud" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Falha ao republicar");
    rerender(<ForwardToContactModal {...props} />);
    expect(screen.queryByRole("button", { name: /Republicar|Recloud/ })).not.toBeInTheDocument();
  });
});

describe("forwarded message origin", () => {
  it.each([
    ["cloud", "↗ Encaminhada de uma cloud\nConteúdo original"],
    [undefined, "↗ Encaminhada\nConteúdo original"],
  ] as const)(
    "sends the %s origin with the original text",
    async (forwardedOrigin, expected) => {
      const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
        ok: true,
        json: async () =>
          String(input).endsWith("/conversations")
            ? { ok: true, conversation: { id: "conversation-1" } }
            : { ok: true },
      }));
      vi.stubGlobal("fetch", fetchMock);
      render(
        <ForwardToContactModal
          title="Encaminhar mensagem"
          preview="Conteúdo original"
          url=""
          label="Conteúdo original"
          messageContent="Conteúdo original"
          forwardedOrigin={forwardedOrigin}
          contacts={[
            {
              id: "contact-1",
              displayName: "Contato",
              username: "contato",
              avatarUrl: null,
            },
          ]}
          onClose={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Encaminhar" }));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: "Enviado" }),
        ).toBeInTheDocument(),
      );
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const [url, init] = fetchMock.mock.calls[1] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe(
        "/api/direct-messages/conversations/conversation-1/messages",
      );
      expect(JSON.parse(String(init.body)).content).toBe(expected);
    },
  );
});
