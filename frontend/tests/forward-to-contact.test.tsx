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
  it("filters contacts by name and @username while preserving forwarding", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({ ok: true, json: async () => String(input).endsWith("/conversations") ? { conversation: { id: "conversation-1" } } : { ok: true } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ForwardToContactModal title="Compartilhar Cloud" url="/cloud/1" label="Cloud" contacts={[{ id: "a", displayName: "Ana Maria", username: "aninha", avatarUrl: null }, { id: "b", displayName: "Bruno", username: "bruninho", avatarUrl: null }]} onClose={vi.fn()} />);
    const search = screen.getByRole("searchbox", { name: "Pesquisar contatos" });
    fireEvent.change(search, { target: { value: "@ANIN" } });
    expect(screen.getByText("Ana Maria")).toBeInTheDocument();
    expect(screen.queryByText("Bruno")).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "ninguém" } });
    expect(screen.getByText("Nenhum resultado encontrado.")).toBeInTheDocument();
    fireEvent.change(search, { target: { value: "maria" } });
    fireEvent.click(screen.getByRole("button", { name: "Encaminhar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviado" })).toBeInTheDocument());
  });
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

describe("Cloud contact sharing state", () => {
  const contact = { id: "contact-1", displayName: "Contato", username: "contato", avatarUrl: null };

  it("resets loading after an error and permits retry", async () => {
    let sendAttempts = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/conversations")) return { ok: true, json: async () => ({ conversation: { id: "conversation-1" } }) };
      sendAttempts += 1;
      return sendAttempts === 1
        ? { ok: false, json: async () => ({ message: "Falha simulada" }) }
        : { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ForwardToContactModal title="Compartilhar Cloud" url="/cloud/1" label="Cloud" contacts={[contact]} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Encaminhar" }));
    expect(await screen.findByText("Falha simulada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Encaminhar" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Encaminhar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviado" })).toBeInTheDocument());
  });

  it("sends the Cloud and optional note to the selected conversation", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => String(input).endsWith("/conversations") ? { conversation: { id: "conversation-correct" } } : { ok: true },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(<ForwardToContactModal title="Compartilhar Cloud" url="/cloud/1" label="Cloud" forwarded={false} contacts={[contact]} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Recado opcional"), { target: { value: "Veja esta Cloud" } });
    fireEvent.click(screen.getByRole("button", { name: "Encaminhar" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviado" })).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toBe("/api/direct-messages/conversations/conversation-correct/link");
    expect(String(fetchMock.mock.calls[2][0])).toBe("/api/direct-messages/conversations/conversation-correct/messages");
    const [, noteRequest] = fetchMock.mock.calls[2] as unknown as [RequestInfo | URL, RequestInit];
    expect(JSON.parse(String(noteRequest.body)).content).toBe("Veja esta Cloud");
  });

  it("ignores a repeated click while the same contact is sending", async () => {
    let releaseSend!: () => void;
    const pendingSend = new Promise<void>((resolve) => { releaseSend = resolve; });
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/conversations")) return { ok: true, json: async () => ({ conversation: { id: "conversation-1" } }) };
      await pendingSend;
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ForwardToContactModal title="Compartilhar Cloud" url="/cloud/1" label="Cloud" contacts={[contact]} onClose={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Encaminhar" });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    releaseSend();
    await waitFor(() => expect(screen.getByRole("button", { name: "Enviado" })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("keeps the Cloud marked as sent when only the optional note fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const target = String(input);
      if (target.endsWith("/conversations")) return { ok: true, json: async () => ({ conversation: { id: "conversation-1" } }) };
      if (target.endsWith("/messages")) return { ok: false, json: async () => ({ message: "Recado indisponível" }) };
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ForwardToContactModal title="Compartilhar Cloud" url="/cloud/1" label="Cloud" contacts={[contact]} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Recado opcional"), { target: { value: "Meu recado" } });
    fireEvent.click(screen.getByRole("button", { name: "Encaminhar" }));

    expect(await screen.findByText("Recado indisponível")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviado" })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
