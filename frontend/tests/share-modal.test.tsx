import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareModal } from "../app/components/ShareModal";

afterEach(() => vi.unstubAllGlobals());

describe("Cloud sharing contacts", () => {
  it("shows an empty contact list without repeated requests", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () =>
        String(input) === "/api/users/following"
          ? { users: [] }
          : { cloud: null },
    }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <ShareModal
        cloudId="cloud-1"
        cloudTitle="Conversa"
        cloudUrl="/cloud/cloud-1"
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: /Enviar no mensageiro/ }),
    );
    await screen.findByText("Você ainda não segue ninguém");
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(
          ([input]) => String(input) === "/api/users/following",
        ),
      ).toHaveLength(1),
    );
  });
  it.each([375, 1280])(
    "filters a long contact list at %ipx and keeps sending available",
    async (width) => {
      vi.stubGlobal("innerWidth", width);
      const users = Array.from({ length: 60 }, (_, index) => ({
        id: String(index),
        displayName: `Pessoa ${index}`,
        username: `usuario${index}`,
        avatarUrl: null,
      }));
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => ({
          ok: true,
          json: async () =>
            String(input) === "/api/users/following"
              ? { users }
              : { cloud: null },
        })),
      );
      render(
        <ShareModal
          cloudId="cloud-1"
          cloudTitle="Conversa"
          cloudUrl="/cloud/cloud-1"
          onClose={vi.fn()}
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: /Enviar no mensageiro/ }),
      );
      expect(await screen.findByText("Pessoa 59")).toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Enviar" })).toHaveLength(
        60,
      );
      const search = screen.getByRole("searchbox", {
        name: "Pesquisar contatos",
      });
      fireEvent.change(search, { target: { value: "@USUARIO59" } });
      expect(screen.getByText("Pessoa 59")).toBeInTheDocument();
      expect(screen.queryByText("Pessoa 0")).not.toBeInTheDocument();
      expect(screen.getAllByRole("button", { name: "Enviar" })).toHaveLength(1);
      fireEvent.change(search, { target: { value: "inexistente" } });
      expect(
        screen.getByText("Nenhum resultado encontrado."),
      ).toBeInTheDocument();
    },
  );
});
