import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReadFeed, type ReadCloud } from "../app/components/ReadFeed";
import { CloudPreview } from "../app/components/CloudPreview";
import { ArchivedConversation } from "../app/components/ArchivedConversation";
import { SessionUserProvider } from "../app/components/session-user";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

const cloud: ReadCloud = { id: "cloud-1", title: "Vamos conversar?", endedAt: "2026-09-20T12:00:00Z", messagesCount: 18, author: { name: "Maria", username: "maria", avatarUrl: null }, participantProfiles: [] };

describe("Read", () => {
  it("shows an empty archive without a join action", () => {
    render(<ReadFeed clouds={[]} />);
    expect(screen.getByText(/Nenhuma cloud encerrada/)).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("opens the read-only preview and displays real message counts", () => {
    render(<ReadFeed clouds={[cloud]} />);
    expect(screen.getByRole("link", { name: /Ver prévia/ })).toHaveAttribute("href", "/cloud/cloud-1/preview");
    expect(screen.getByText("18 comentários")).toBeVisible();
    expect(screen.queryByText(/Entrar/)).not.toBeInTheDocument();
  });
  it("navigates across archived topics on desktop after the slide transition", async () => {
    render(<ReadFeed clouds={[cloud, { ...cloud, id: "cloud-2", title: "Outro assunto" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima Cloud" }));
    await waitFor(() => expect(screen.getByLabelText("Cloud 2 de 2")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Cloud anterior" }));
    await waitFor(() => expect(screen.getByLabelText("Cloud 1 de 2")).toBeInTheDocument());
  });
});

describe("Cloud preview", () => {
  beforeEach(() => pushMock.mockClear());

  it("renders the first messages in server order without composer or join requests", async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ id: `${i}`, type: "text", content: `Mensagem ${i + 1}`, mediaUrl: null, createdAt: "2026-09-20T12:00:00Z", sender: { id: "user-maria", displayName: "Maria" } }));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cloud, messages }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CloudPreview cloudId={cloud.id} />);
    expect(await screen.findByText("Mensagem 10")).toBeVisible();
    expect(screen.getAllByRole("article")).toHaveLength(10);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/clouds/cloud-1/preview");
    expect(screen.getAllByRole("link", { name: "Ver perfil de Maria" })[0]).toHaveAttribute("href", "/users/user-maria");
    expect(screen.getByRole("link", { name: /Voltar para Read/ })).toHaveAttribute("href", "/read");
    expect(screen.getByRole("link", { name: "Ver conversa completa" })).toHaveAttribute("href", "/cloud/cloud-1/conversation");
  });
  it("closes the desktop modal when its backdrop is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cloud, messages: [] }) }));
    render(<CloudPreview cloudId={cloud.id} />);
    await screen.findByText(/encerrada sem mensagens/);
    expect(screen.getByRole("dialog", { name: "Prévia da Cloud encerrada" })).toBeVisible();
    fireEvent.click(screen.getByTestId("preview-backdrop"));
    expect(pushMock).toHaveBeenCalledWith("/read");
  });
  it("handles archives without messages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cloud, messages: [] }) }));
    render(<CloudPreview cloudId={cloud.id} />);
    expect(await screen.findByText(/encerrada sem mensagens/)).toBeVisible();
  });
  it("shows access errors and retries successfully", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ message: "Cloud não encontrada." }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ cloud, messages: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<CloudPreview cloudId={cloud.id} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Cloud não encontrada.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByText(/encerrada sem mensagens/)).toBeVisible();
  });
  it("renders image and audio messages as read-only media", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cloud, messages: [
      { id: "image", type: "image", mediaUrl: "/image.png", createdAt: "2026-09-20T12:00:00Z", sender: null },
      { id: "audio", type: "audio", mediaUrl: "/audio.mp3", createdAt: "2026-09-20T12:00:00Z", sender: null },
    ] }) }));
    const { container } = render(<CloudPreview cloudId={cloud.id} />);
    expect(await screen.findByAltText("Imagem enviada")).toHaveAttribute("src", "/image.png");
    expect(screen.getByRole("button", { name: "Reproduzir áudio" })).toBeVisible();
    expect(container.querySelector("audio")).toHaveAttribute("src", "/audio.mp3");
  });
});

describe("Archived cloud conversation", () => {
  it("uses the active messenger layout without writing or editing controls", async () => {
    const archiveMessages = [
      { id: "text", type: "text", content: "Minha mensagem", mediaUrl: null, createdAt: "2026-09-20T12:00:00Z", sender: { id: "user-1", displayName: "Maria", username: "maria", avatarUrl: null } },
      { id: "image", type: "image", content: null, mediaUrl: "/archive.png", createdAt: "2026-09-20T12:01:00Z", sender: { id: "user-2", displayName: "João", username: "joao", avatarUrl: null } },
      { id: "audio", type: "audio", content: null, mediaUrl: "/archive.mp3", createdAt: "2026-09-20T12:02:00Z", sender: { id: "user-2", displayName: "João", username: "joao", avatarUrl: null } },
    ];
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") return { ok: true, json: async () => ({ user: { id: "user-1", displayName: "Maria", username: "maria", avatarUrl: null } }) };
      if (url.includes("/archive/messages")) return { ok: true, json: async () => ({ cloud, messages: archiveMessages }) };
      return { ok: false, arrayBuffer: async () => new ArrayBuffer(0), json: async () => ({}) };
    }));

    const { container } = render(<SessionUserProvider><ArchivedConversation cloudId={cloud.id} /></SessionUserProvider>);

    expect(await screen.findByText("Minha mensagem")).toBeVisible();
    expect(screen.getByText("Cloud encerrada")).toBeVisible();
    expect(screen.getByText("Você")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Ver perfil de Maria" })[0]).toHaveAttribute("href", "/users/user-1");
    expect(screen.getByAltText("Imagem enviada")).toHaveAttribute("src", "/archive.png");
    expect(screen.getByRole("button", { name: "Reproduzir áudio" })).toBeVisible();
    expect(container.querySelector('audio[src="/archive.mp3"]')).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
  });
});
