// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { GET } from "../app/entrenoclouds/preview/route";

vi.mock("../app/lib/invitation-preview", () => ({ getInvitationPreview: vi.fn(async () => ({ displayName: "Ana", username: "ana", avatarUrl: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aXsAAAAASUVORK5CYII=" })) }));

describe("invitation preview image", () => {
  it("renders a PNG using the sender's profile photo", async () => {
    const response = await GET(new Request("https://clouds.test/entrenoclouds/preview?ref=ANA1234"));
    expect(response.headers.get("content-type")).toContain("image/png");
    const png = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(png.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  });
});
