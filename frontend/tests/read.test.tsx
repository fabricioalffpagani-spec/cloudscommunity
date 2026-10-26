import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReadFeed, type ReadCloud } from "../app/components/ReadFeed";
import { CloudPreview } from "../app/components/CloudPreview";
import { ArchivedConversation } from "../app/components/ArchivedConversation";
import { SessionUserProvider } from "../app/components/session-user";
import { ReadOnlyCloudMessage } from "../app/components/ReadOnlyCloudMessage";

const { pushMock, backMock } = vi.hoisted(() => ({ pushMock: vi.fn(), backMock: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock, back: backMock }), useSearchParams: () => new URLSearchParams(window.location.search) }));

const cloud: ReadCloud = { id: "cloud-1", title: "Vamos conversar?", endedAt: "2026-09-20T12:00:00Z", messagesCount: 18, author: { id: "user-maria", name: "Maria", username: "maria", avatarUrl: null }, participantProfiles: [] };
const onDelete = vi.fn<(cloudId: string) => Promise<void>>().mockResolvedValue(undefined);

describe("Read", () => {
  it("mostra a indicação de edição no histórico", () => {
    render(<ReadOnlyCloudMessage message={{ id: "m1", type: "text", content: "Texto atualizado", mediaUrl: null, createdAt: "2026-10-23T10:00:00Z", editedAt: "2026-10-23T10:01:00Z", sender: { id: "ana", displayName: "Ana" } }} />);
    expect(screen.getByText("Editada")).toBeVisible();
  });
  it.each([375, 1280])("offers Recloud from the Read card menu at %ipx", async (width) => {
    vi.stubGlobal("innerWidth", width);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/recloud')) return { ok: true, json: async () => init?.method ? { ok: true } : { canRecloud: true, reclouded: false } };
      return { ok: true, json: async () => ({ userIds: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReadFeed clouds={[cloud]} currentUserId="viewer" onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais opções da Cloud" }));
    fireEvent.click(await screen.findByRole("button", { name: "Republicar Cloud" }));
    expect(await screen.findByRole("button", { name: "Desfazer Recloud" })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud-1/recloud", { method: "POST" });
    vi.unstubAllGlobals();
  });
  it("shows only connected participants and the overflow in the Read footer", async () => {
    const people = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `Pessoa ${i}`, username: `pessoa${i}`, avatarUrl: null }));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ userIds: people.slice(0, 7).map((p) => p.id) }) }));
    render(<ReadFeed clouds={[{ ...cloud, participantProfiles: people }]} currentUserId="viewer" onDelete={onDelete} />);
    expect(await screen.findByText("participaram dessa cloud")).toBeInTheDocument();
    expect(screen.getByText("+3")).toBeInTheDocument();
    expect(within(screen.getByLabelText("7 perfis")).getByText("+1")).toBeInTheDocument();
    expect(screen.queryByTitle("Pessoa 7")).not.toBeInTheDocument();
    expect(screen.queryByText(/Encerrada há/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("dismisses the options on outside click or Escape, while allowing menu interaction", () => {
    render(<ReadFeed clouds={[cloud, { ...cloud, id: "cloud-2", title: "Outra Cloud" }]} currentUserId="viewer" onDelete={onDelete} />);
    const [first, second] = screen.getAllByRole("button", { name: "Mais opções da Cloud" });
    fireEvent.click(first);
    const option = screen.getByRole("button", { name: "Enviar para" });
    fireEvent.click(option.parentElement as HTMLElement);
    expect(option).toBeInTheDocument();
    fireEvent.click(screen.getByText("Outra Cloud"));
    expect(screen.queryByRole("button", { name: "Enviar para" })).not.toBeInTheDocument();
    fireEvent.click(first);
    fireEvent.click(second);
    expect(first).toHaveAttribute("aria-expanded", "false");
    expect(second).toHaveAttribute("aria-expanded", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(second).toHaveAttribute("aria-expanded", "false");
  });
  it("shows an empty archive without a join action", () => {
    render(<ReadFeed clouds={[]} onDelete={onDelete} />);
    expect(screen.getByText(/Nenhuma cloud encerrada/)).toBeVisible();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
  it("keeps the footer free of the ended status across screen sizes", () => {
    const { container } = render(<ReadFeed clouds={[cloud, { ...cloud, id: "cloud-2", title: "Título extenso ".repeat(14) }]} onDelete={onDelete} />);
    for (const card of container.querySelectorAll("[data-cloud-page]")) {
      const action = card.querySelector(".read-card-action");
      const status = card.querySelector(".read-card-footer");
      expect(action).toBeNull();
      expect(status).not.toHaveTextContent(/Encerrad/);
      expect(status?.querySelector("button")).toBeNull();
      expect(card.querySelector(".read-card-center")?.nextElementSibling).toBe(status);
    }
  });
  it("offers sharing and reporting to other users and sends the report", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReadFeed clouds={[cloud]} currentUserId="viewer" onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais opções da Cloud" }));
    expect(screen.getByRole("button", { name: "Enviar para" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Excluir a Cloud" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar Cloud" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Denunciar" }));
    fireEvent.click(screen.getByRole("button", { name: /Spam ou publicidade/ }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar denúncia" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud-1/reports", expect.objectContaining({ method: "POST", body: JSON.stringify({ reportedId: "user-maria", reasons: ["Spam ou publicidade"] }) })));
    expect(await screen.findByText("Denúncia enviada")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("opens the editor from the creator's Read menu and applies the saved values", async () => {
    const saved = { id: cloud.id, title: "Atualizada", duration: "30min", description: "Nova", editCount: 3 };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ cloud: saved }) }));
    const onEdited = vi.fn();
    render(<ReadFeed clouds={[{ ...cloud, duration: "10min", description: "Antes", editCount: 2 }]} currentUserId="user-maria" onDelete={onDelete} onEdited={onEdited} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais opções da Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: "Editar Cloud" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Título/ }), { target: { value: "Atualizada" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar edição" }));
    await waitFor(() => expect(onEdited).toHaveBeenCalledWith(saved));
    expect(screen.queryByRole("dialog", { name: "Editar Cloud" })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("offers the creator deletion, but not reporting, and confirms before deleting", async () => {
    onDelete.mockClear();
    render(<ReadFeed clouds={[cloud]} currentUserId="user-maria" onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais opções da Cloud" }));
    expect(screen.queryByRole("button", { name: "Denunciar" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Excluir a Cloud" }));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /^Excluir$/ }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith("cloud-1"));
  });
  it("opens sharing from the mobile menu", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ users: [] }) }));
    render(<ReadFeed clouds={[cloud]} currentUserId="viewer" onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais opções da Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar para" }));
    expect(await screen.findByText("Compartilhar Cloud")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("shows the same contact loading error used by Talk", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<ReadFeed clouds={[cloud]} currentUserId="viewer" onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais opções da Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar para" }));
    expect(await screen.findByText("Não foi possível carregar os contatos.")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
  it("shares the archived conversation through native sharing and contacts", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/users/following?compact=1") return { ok: true, json: async () => ({ users: [{ id: "friend", username: "amigo", displayName: "Amigo", avatarUrl: null }] }) };
      if (url === "/api/direct-messages/conversations") return { ok: true, json: async () => ({ conversation: { id: "dm-1" } }) };
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ReadFeed clouds={[cloud]} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Mais opções da Cloud" }));
    fireEvent.click(screen.getByRole("button", { name: "Enviar para" }));
    expect(await screen.findByText("Amigo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar com…" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining(`/cloud/${cloud.id}/conversation?from=read`) })));
    fireEvent.click(screen.getByRole("button", { name: "Encaminhar" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/direct-messages/conversations/dm-1/link", expect.objectContaining({ body: expect.stringContaining(`/cloud/${cloud.id}/conversation?from=read`) })));
    vi.unstubAllGlobals();
  });
  it("does not open the read-only conversation with a mobile swipe", () => {
    render(<ReadFeed clouds={[cloud]} onDelete={onDelete} />);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    vi.stubGlobal("PointerEvent", MouseEvent);
    const topic = screen.getByLabelText(`Cloud ${cloud.title}. Toque ou clique duas vezes para ler a conversa.`);
    fireEvent.pointerDown(topic, { clientX: 160, clientY: 40 });
    fireEvent.pointerUp(topic, { clientX: 60, clientY: 45 });
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.queryByText("18 comentários")).not.toBeInTheDocument();
    expect(screen.queryByText(/Entrar/)).not.toBeInTheDocument();
  });
  it("opens the archived conversation after a double tap in the title area on mobile", () => {
    render(<ReadFeed clouds={[cloud]} onDelete={onDelete} />);
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
    vi.stubGlobal("PointerEvent", MouseEvent);
    const topic = screen.getByLabelText(`Cloud ${cloud.title}. Toque ou clique duas vezes para ler a conversa.`);
    fireEvent.pointerDown(topic, { clientX: 160, clientY: 40 });
    fireEvent.pointerUp(topic, { clientX: 160, clientY: 40 });
    fireEvent.pointerDown(topic, { clientX: 160, clientY: 40 });
    fireEvent.pointerUp(topic, { clientX: 160, clientY: 40 });
    expect(pushMock).toHaveBeenCalledWith("/cloud/cloud-1/conversation?from=read&scope=for-you");
  });
  it("opens the archived conversation by double click or keyboard on desktop", () => {
    pushMock.mockClear();
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    render(<ReadFeed clouds={[cloud]} scope="following" onDelete={onDelete} />);
    const topic = screen.getByRole("button", { name: /Toque ou clique duas vezes/ });
    fireEvent.doubleClick(topic);
    fireEvent.keyDown(topic, { key: "Enter" });
    expect(pushMock).toHaveBeenCalledTimes(2);
    expect(pushMock).toHaveBeenCalledWith("/cloud/cloud-1/conversation?from=read&scope=following");
    expect(screen.getByRole("button", { name: "Mais opções da Cloud" }).parentElement).not.toHaveClass("md:hidden");
    vi.unstubAllGlobals();
  });
  it("leaves desktop wheel scrolling native across archived topics", () => {
    const { container } = render(<ReadFeed clouds={[cloud, { ...cloud, id: "cloud-2", title: "Outro assunto" }]} onDelete={onDelete} />);
    const feed = container.querySelector(".desktop-cloud-feed") as HTMLDivElement;
    const scrollTo = vi.fn();
    feed.scrollTo = scrollTo;
    expect(container.querySelectorAll("article")).toHaveLength(2);
    expect(screen.getByText("Outro assunto")).toBeVisible();
    expect(feed).toHaveClass("cloud-feed-scroller");
    expect(container.querySelectorAll("article.snap-start")).toHaveLength(2);
    expect(fireEvent.wheel(feed, { deltaY: 100, deltaX: 0, cancelable: true })).toBe(true);
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it("navigates archived clouds with desktop arrows while keeping scroll available", () => {
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const { container } = render(<ReadFeed clouds={[cloud, { ...cloud, id: "cloud-2", title: "Outro assunto" }]} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Próxima Cloud" }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    expect(screen.getByRole("button", { name: "Cloud anterior" })).toBeEnabled();
    expect(container.querySelector(".cloud-feed-scroller")).toBeInTheDocument();
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
  it.each([375, 1280])("offers a direct Recloud button next to sharing in the archived chat at %ipx", async (width) => {
    vi.stubGlobal("innerWidth", width);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/me") return { ok: true, json: async () => ({ user: { id: "viewer", username: "viewer", displayName: "Viewer" } }) };
      if (url.endsWith("/recloud")) return { ok: true, json: async () => init?.method ? { ok: true } : { canRecloud: true, reclouded: false } };
      if (url.includes("/archive/messages")) return { ok: true, json: async () => ({ cloud: { ...cloud, authorId: "user-maria", visibility: "public", participantProfiles: [{ id: "friend", name: "Amiga", username: "amiga", avatarUrl: null }] }, messages: [] }) };
      return { ok: true, json: async () => ({ users: [] }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionUserProvider><ArchivedConversation cloudId="cloud-1" /></SessionUserProvider>);
    const button = await screen.findByRole("button", { name: "Republicar Cloud" });
    expect(screen.getByRole("button", { name: "Compartilhar Cloud" }).nextElementSibling).toBe(button);
    expect(screen.queryByRole("button", { name: "Ver participantes da Cloud" })).not.toBeInTheDocument();
    expect(within(screen.getByTestId("mobile-archive-status")).getByText(/Cloud encerrada há/)).toBeInTheDocument();
    fireEvent.click(button);
    const undo = await screen.findByRole("button", { name: "Desfazer Recloud" });
    expect(undo).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar Cloud" }));
    const shareModal = screen.getByRole("heading", { name: "Compartilhar Cloud" }).parentElement!.parentElement!;
    expect(await within(shareModal).findByRole("button", { name: "Desfazer Recloud" })).toBeInTheDocument();
    fireEvent.click(within(shareModal).getByRole("button", { name: "Fechar" }));
    fireEvent.click(undo);
    expect(await screen.findByRole("button", { name: "Republicar Cloud" })).toHaveAttribute("aria-pressed", "false");
    expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud-1/recloud", { method: "POST" });
    expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud-1/recloud", { method: "DELETE" });
    vi.unstubAllGlobals();
  });
  it("does not offer Recloud to someone who cannot republish", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/me") return { ok: true, json: async () => ({ user: { id: "viewer", username: "viewer", displayName: "Viewer" } }) };
      if (url.endsWith("/recloud")) return { ok: true, json: async () => ({ canRecloud: false, reclouded: false }) };
      if (url.includes("/archive/messages")) return { ok: true, json: async () => ({ cloud: { ...cloud, visibility: "public" }, messages: [] }) };
      return { ok: true, json: async () => ({}) };
    }));
    render(<SessionUserProvider><ArchivedConversation cloudId="cloud-1" /></SessionUserProvider>);
    await screen.findByRole("button", { name: "Compartilhar Cloud" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Republicar Cloud" })).not.toBeInTheDocument());
    vi.unstubAllGlobals();
  });
  it("does not offer description editing after the Cloud ends", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === "/api/auth/me") return { ok: true, json: async () => ({ user: { id: "user-maria", displayName: "Maria", username: "maria", avatarUrl: null } }) };
      if (String(input).includes("/archive/messages")) return { ok: true, json: async () => ({ cloud: { ...cloud, authorId: "user-maria", visibility: "private", description: "Antes" }, messages: [] }) };
      return { ok: false, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionUserProvider><ArchivedConversation cloudId={cloud.id} /></SessionUserProvider>);
    await screen.findByText("Nenhuma mensagem");
    expect(screen.queryByRole("button", { name: "Editar descrição" })).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith("/api/clouds/cloud-1", expect.objectContaining({ method: "PATCH" }));
    vi.unstubAllGlobals();
  });
  it("shares the archived Cloud from the conversation header", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/archive/messages")) return { ok: true, json: async () => ({ cloud, messages: [] }) };
      if (String(input) === "/api/users/following?compact=1") return { ok: true, json: async () => ({ users: [] }) };
      return { ok: true, json: async () => ({ user: null }) };
    }));
    render(<SessionUserProvider><ArchivedConversation cloudId={cloud.id} /></SessionUserProvider>);
    await screen.findByText("Nenhuma mensagem");
    fireEvent.click(screen.getByRole("button", { name: "Compartilhar Cloud" }));
    fireEvent.click(await screen.findByRole("button", { name: "Compartilhar com…" }));
    await waitFor(() => expect(share).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining(`/cloud/${cloud.id}/conversation?from=read`) })));
    vi.unstubAllGlobals();
  });
  it("loads the first archive page when entered from Read", async () => {
    window.history.replaceState(null, "", "/cloud/cloud-1/conversation?from=read");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/archive/messages")) return { ok: true, json: async () => ({ cloud, messages: [] }) };
      return { ok: true, json: async () => ({ user: null }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<SessionUserProvider><ArchivedConversation cloudId={cloud.id} /></SessionUserProvider>);
    await screen.findByText("Nenhuma mensagem");
    expect(fetchMock).toHaveBeenCalledWith("/api/clouds/cloud-1/archive/messages?take=100&fromStart=true", { cache: "no-store" });
  });
  it("uses browser history for the internal back button when opened from Read", async () => {
    window.history.replaceState(null, "", "/cloud/cloud-1/conversation?from=read&scope=following");
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/archive/messages")) return { ok: true, json: async () => ({ cloud, messages: [] }) };
      return { ok: true, json: async () => ({ user: null }) };
    }));
    render(<SessionUserProvider><ArchivedConversation cloudId={cloud.id} /></SessionUserProvider>);
    fireEvent.click(await screen.findByRole("button", { name: "Voltar para Read" }));
    expect(backMock).toHaveBeenCalledOnce();
  });

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
    expect(within(screen.getByTestId("mobile-archive-status")).getByText(/Cloud encerrada há/)).toBeVisible();
    expect(screen.getByText("Você")).toBeVisible();
    expect(screen.getAllByRole("link", { name: "Ver perfil de Maria" })[0]).toHaveAttribute("href", "/users/user-1");
    expect(screen.getByAltText("Imagem enviada")).toHaveAttribute("src", "/archive.png");
    expect(screen.getByRole("button", { name: "Reproduzir áudio" })).toBeVisible();
    expect(container.querySelector('audio[src="/archive.mp3"]')).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
  });
});
