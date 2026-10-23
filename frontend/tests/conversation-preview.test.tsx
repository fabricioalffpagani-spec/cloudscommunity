import { describe, expect, it, vi } from "vitest";
import { formatLinkPreview, getInboxConversationPreview } from "../app/lib/conversation-preview";

describe("inbox conversation preview", () => {
  it("stays empty for a new conversation with no messages", () => {
    const formatPreview = vi.fn(() => "Link compartilhado");

    expect(getInboxConversationPreview(null, formatPreview)).toBe("");
    expect(getInboxConversationPreview("   ", formatPreview)).toBe("");
    expect(formatPreview).not.toHaveBeenCalled();
  });

  it("keeps formatting the preview once a real message exists", () => {
    const formatPreview = vi.fn((value: string) => `Prévia: ${value}`);

    expect(getInboxConversationPreview("Olá", formatPreview)).toBe("Prévia: Olá");
    expect(formatPreview).toHaveBeenCalledWith("Olá");
  });
});

describe("structured link previews", () => {
  it("formats shared profiles in inbox and reply previews", () => {
    expect(formatLinkPreview(JSON.stringify({ type: "profile_share", name: "Rhuan Carlos", avatarUrl: "https://example.com/avatar" }))).toBe("Perfil: Rhuan Carlos");
    expect(formatLinkPreview('{"type":"profile_share","name":"Rhuan Carlos","avatarUrl":"long')).toBe("Perfil: Rhuan Carlos");
    expect(formatLinkPreview('{"type":"profile_share","name":"unfinished')).toBe("Perfil compartilhado");
  });
  it("preserves ordinary links and cloud invitations", () => {
    expect(formatLinkPreview("Olá" )).toBe("Olá");
    expect(formatLinkPreview(null, "https://example.com/a")).toBe("example.com");
    expect(formatLinkPreview(JSON.stringify({ type: "cloud_invitation", cloudTitle: "Teste" }))).toBe("☁️ Convite: Teste");
    expect(formatLinkPreview(JSON.stringify({ type: "forwarded_link", label: "Exemplo" }))).toBe("Exemplo");
  });
});
