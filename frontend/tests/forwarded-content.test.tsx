import { describe, expect, it } from "vitest";
import { cloudForwardMarker, parseForwardedContent, readableMessageText } from "../app/lib/forwarded-content";

describe("forwarded cloud messages", () => {
  it("preserves cloud names, ids and message text", () => {
    const origin = { id: "cloud/123", name: "Cloud de música & café ☁️" };
    expect(parseForwardedContent(`${cloudForwardMarker(origin)}\nOlá\nMundo`)).toEqual({ forwarded: true, origin, text: "Olá\nMundo" });
  });
  it("reads text after the server normalizes line breaks", () => {
    expect(parseForwardedContent(`${cloudForwardMarker({ id: "1", name: "Teste" })} Olá`).text).toBe("Olá");
  });
  it("recognizes a media marker with no text", () => {
    expect(parseForwardedContent(cloudForwardMarker({ id: "1", name: "Teste" })).origin).toEqual({ id: "1", name: "Teste" });
  });
  it("keeps older forwarded messages readable", () => {
    expect(parseForwardedContent("↗ Encaminhada de uma cloud\nTeste")).toMatchObject({ forwarded: true, legacyCloud: true, text: "Teste" });
    expect(parseForwardedContent("↗ Encaminhada\nTeste")).toMatchObject({ forwarded: true, text: "Teste" });
  });
  it("does not consume malformed metadata", () => {
    expect(parseForwardedContent("↗ Encaminhada [cloud:%ZZ:x]\nOlá").origin).toBeNull();
  });
});

describe("readable Cloud comment messages", () => {
  it("formats replies and legacy references without exposing JSON", () => {
    const reply = JSON.stringify({ type: "cloud_comment_reply", cloudTitle: "Conversa", comment: "Olá", response: "Tudo bem?" });
    expect(readableMessageText(reply)).toBe("Comentário em Conversa\nOlá\nResposta: Tudo bem?");
    expect(readableMessageText(`↗ Encaminhada\n${reply}`)).toBe("Comentário em Conversa\nOlá\nResposta: Tudo bem?");
    expect(readableMessageText(JSON.stringify({ type: "cloud_comment_reference", cloudTitle: "Conversa", comment: "Olá" }))).toBe("Comentário em Conversa\nOlá");
  });
  it("preserves ordinary text and unrelated JSON", () => {
    expect(readableMessageText("↗ Encaminhada\nOlá")).toBe("Olá");
    expect(readableMessageText('{"hello":"world"}')).toBe('{"hello":"world"}');
  });
});
