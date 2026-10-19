import { describe, expect, it } from "vitest";
import { cloudInvitation, cloudInvitationUrl, invitationCountdown } from "../app/lib/cloud-invitation";
import { generateMetadata } from "../app/cloud/[id]/layout";

describe("cloud invitations", () => {
  it("uses the same invitation with a single join link and correct singular", () => {
    expect(cloudInvitation({ title: "Teste do dia", remaining: "2:37", participants: 1, url: "https://cloudscommunity.com.br/cloud/123?join=1" })).toBe("*Teste do dia*\nFaltam *2:37* para participar.\n1 pessoa está discutindo este tema ao vivo.\nJunte-se a mim nessa conversa: https://cloudscommunity.com.br/cloud/123?join=1");
  });
  it("handles plural, missing details and existing query parameters", () => {
    expect(cloudInvitation({ title: "Teste", participants: 2, url: "https://example.com/cloud/1" })).toContain("2 pessoas estão discutindo este tema ao vivo.");
    expect(cloudInvitation({ title: "Teste", url: "https://example.com/cloud/1" })).not.toContain("Faltam");
    expect(cloudInvitationUrl("https://example.com/cloud/1?a=2")).toBe("https://example.com/cloud/1?a=2&join=1");
  });
  it("calculates the remaining time", () => {
    expect(invitationCountdown("2026-01-01T00:00:00Z", "5min", Date.parse("2026-01-01T00:02:23Z"))).toBe("2:37");
    expect(invitationCountdown("bad", "5min")).toBeUndefined();
  });
  it("identifies the shared cloud in Open Graph metadata", async () => {
    const metadata = await generateMetadata({ params: Promise.resolve({ id: "cloud-123" }) });
    expect(metadata.openGraph?.url).toContain("/cloud/cloud-123?join=1");
    expect(metadata.openGraph?.images).toBeDefined();
  });
});
