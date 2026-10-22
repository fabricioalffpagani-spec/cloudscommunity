import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../app/profile/page";
import { SessionUserProvider } from "../app/components/session-user";

vi.mock("../app/components/NotificationsPanel", () => ({
  NotificationsBell: () => null,
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/profile",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const cloud = (id: string, title: string) => ({
  id,
  authorId: "owner",
  title,
  description: null,
  duration: "10min",
  visibility: "public",
  createdAt: "2025-01-01T00:00:00.000Z",
  endedAt: "2025-01-01T00:10:00.000Z",
  scheduledAt: null,
  status: "ended",
  href: `/cloud/${id}`,
});

function setup(deleteSucceeds: boolean, profileClouds: Array<Record<string, unknown>> = [cloud("a", "Cloud A"), cloud("b", "Cloud B")]) {
  let deleted = false;
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/me")
        return {
          ok: true,
          status: 200,
          json: async () => ({
            ok: true,
            user: {
              id: "owner",
              username: "owner",
              name: "Owner",
              displayName: "Owner",
              avatarUrl: null,
              bio: null,
              location: null,
              cloudsCount: deleted ? 1 : 2,
              followersCount: 0,
              followingCount: 0,
              hypesCount: 0,
              createdAt: "2025-01-01T00:00:00.000Z",
            },
          }),
        };
      if (url === "/api/clouds/mine")
        return {
          ok: true,
          json: async () => ({
            ok: true,
            clouds: profileClouds,
          }),
        };
      if (url === "/api/clouds/a" && init?.method === "DELETE") {
        deleted = deleteSucceeds;
        return {
          ok: deleteSucceeds,
          json: async () =>
            deleteSucceeds ? { ok: true } : { message: "Falha na exclusão" },
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  render(
    <SessionUserProvider>
      <ProfilePage />
    </SessionUserProvider>,
  );
  return fetchMock;
}

async function requestDeletion() {
  await screen.findByText("Cloud A");
  fireEvent.click(
    screen.getAllByRole("button", { name: "Opções da Cloud" })[0],
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Excluir Cloud permanentemente" }),
  );
  const dialog = screen.getByRole("dialog", { name: "Excluir Cloud?" });
  fireEvent.click(within(dialog).getByRole("button", { name: "Excluir" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("profile Cloud deletion", () => {
  it.each([375, 1280])("opens Cloud participants on the owner profile at %ipx", async (width) => {
    vi.stubGlobal("innerWidth", width);
    setup(true, [{ ...cloud("a", "Cloud A"), participantProfiles: [{ id: "owner", name: "Owner", username: "owner", avatarUrl: null }, { id: "member", name: "Participante", username: "participante", avatarUrl: null }] }]);
    await screen.findByText("Cloud A");
    fireEvent.click(screen.getByRole("button", { name: "Ver participantes da Cloud" }));
    const dialog = screen.getByRole("dialog", { name: "Participantes" });
    expect(dialog.parentElement).toBe(document.body);
    expect(within(dialog).getByRole("link", { name: /Participante/ })).toHaveAttribute("href", "/users/member");
    fireEvent.click(within(dialog).getByRole("button", { name: "Fechar" }));
    expect(screen.queryByRole("dialog", { name: "Participantes" })).not.toBeInTheDocument();
  });

  it("shows Cloud information above the cards and closes it only on the backdrop", async () => {
    setup(true, [{ ...cloud("a", "Cloud A"), description: "Descrição longa ".repeat(100) }, cloud("b", "Cloud B")]);
    await screen.findByText("Cloud A");
    fireEvent.click(screen.getAllByRole("button", { name: "Opções da Cloud" })[0]);
    fireEvent.click(screen.getByRole("button", { name: "Informações da Cloud" }));
    const dialog = screen.getByRole("dialog", { name: "Informações da Cloud" });
    const backdrop = screen.getByTestId("cloud-details-backdrop");
    expect(backdrop.parentElement).toBe(document.body);
    expect(dialog).toHaveClass("overflow-y-auto");
    expect(dialog).toHaveTextContent("Descrição longa");
    fireEvent.click(dialog);
    expect(dialog).toBeInTheDocument();
    fireEvent.click(backdrop);
    expect(screen.queryByRole("dialog", { name: "Informações da Cloud" })).not.toBeInTheDocument();
  });
  it("closes the Cloud menu on an outside click without closing it on an inside click", async () => {
    setup(true);
    await screen.findByText("Cloud A");
    const trigger = screen.getAllByRole("button", { name: "Opções da Cloud" })[0];
    fireEvent.click(trigger);
    const option = screen.getByRole("button", { name: "Informações da Cloud" });
    fireEvent.click(option.parentElement as HTMLElement);
    expect(option).toBeInTheDocument();
    fireEvent.click(document.body);
    expect(screen.queryByRole("button", { name: "Informações da Cloud" })).not.toBeInTheDocument();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
  it("shows live, scheduled and ended Clouds in order with schedule controls", async () => {
    const active = { ...cloud("live", "Cloud ativa"), status: "active", createdAt: new Date().toISOString(), endedAt: null };
    const scheduled = { ...cloud("scheduled", "Cloud agendada"), status: "active", scheduledAt: new Date(Date.now() + 86400000).toISOString(), endedAt: null };
    setup(true, [cloud("ended", "Cloud encerrada"), scheduled, active]);
    await screen.findByText("Cloud ativa");
    const cards = screen.getAllByRole("article");
    expect(cards.map((card) => within(card).getByRole("heading").textContent)).toEqual(["Cloud ativa", "Cloud agendada", "Cloud encerrada"]);
    expect(within(cards[0]).getByText(/Ao vivo/)).toBeInTheDocument();
    expect(within(cards[1]).getByText(/Agendada/)).toBeInTheDocument();
    fireEvent.click(within(cards[1]).getByRole("button", { name: "Ver data de estreia" }));
    expect(within(cards[1]).getByText(/^Estreia em/)).toBeInTheDocument();
    expect(within(cards[1]).getByRole("button", { name: "Avisar-me na estreia" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Minhas Clouds" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Meus Convites" })).toBeInTheDocument();
  });
  it("shows the ended status and date without repeating the status", async () => {
    setup(true);
    const title = await screen.findByText("Cloud A");
    const card = title.closest("article");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText(/^Encerrada em /)).toBeInTheDocument();
    expect(within(card as HTMLElement).queryByText(/Encerrada Encerrada/)).not.toBeInTheDocument();
  });

  it("removes the Cloud and decrements the count after a successful deletion", async () => {
    setup(true);
    await requestDeletion();
    await waitFor(() =>
      expect(screen.queryByText("Cloud A")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Cloud B")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("keeps the Cloud and count when deletion fails", async () => {
    setup(false);
    await requestDeletion();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Falha na exclusão",
    );
    expect(screen.getByText("Cloud A")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });
});
