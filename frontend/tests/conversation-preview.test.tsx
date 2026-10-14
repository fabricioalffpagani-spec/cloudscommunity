import { describe, expect, it, vi } from "vitest";
import { getInboxConversationPreview } from "../app/lib/conversation-preview";

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
