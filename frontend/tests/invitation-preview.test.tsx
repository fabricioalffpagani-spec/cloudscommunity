import { describe, expect, it, vi } from "vitest";
import { generateMetadata } from "../app/entrenoclouds/page";

vi.mock("../app/lib/invitation-preview", () => ({ getInvitationPreview: vi.fn(async (code: string) => code === "ANA1234" ? { displayName: "Ana", username: "ana", avatarUrl: "data:image/png;base64,AAAA" } : null) }));

describe("invitation link preview", () => {
  it("uses the sender's name and an image tied to the invitation code", async () => {
    const metadata = await generateMetadata({ searchParams: Promise.resolve({ ref: "ANA1234" }) });
    expect(metadata.description).toBe("Ana está te convidando para o Clouds! Descubra conversas acontecendo agora...");
    expect(metadata.openGraph?.images).toEqual([{ url: "/entrenoclouds/preview?ref=ANA1234", width: 600, height: 600 }]);
  });
});
