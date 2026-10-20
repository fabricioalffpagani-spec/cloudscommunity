import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConversationListPreview } from "../app/components/ConversationListPreview";

describe("conversation list preview", () => {
  it("shows typing temporarily and restores the last message", () => {
    const { rerender } = render(<ConversationListPreview isTyping={false} lastMessage="Olá" />);
    expect(screen.getByText("Olá")).toBeInTheDocument();
    rerender(<ConversationListPreview isTyping lastMessage="Olá" />);
    expect(screen.getByText("Digitando...")).toBeInTheDocument();
    expect(screen.queryByText("Olá")).not.toBeInTheDocument();
    rerender(<ConversationListPreview isTyping={false} lastMessage="Olá" />);
    expect(screen.getByText("Olá")).toBeInTheDocument();
  });

  it("preserves the empty conversation fallback", () => {
    render(<ConversationListPreview isTyping={false} lastMessage="" />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });
});
