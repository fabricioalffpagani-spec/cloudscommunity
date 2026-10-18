import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForwardToContactModal } from "../app/components/ForwardToContactModal";

afterEach(() => vi.unstubAllGlobals());

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
