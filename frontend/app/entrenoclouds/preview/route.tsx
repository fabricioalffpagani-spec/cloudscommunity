import { ImageResponse } from "next/og";
import { getInvitationPreview } from "../../lib/invitation-preview";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("ref") ?? "";
  const profile = await getInvitationPreview(code);
  // Profile photos uploaded in Clouds are stored as data URLs. Do not fetch
  // arbitrary user-supplied remote URLs from the server.
  const avatar = profile?.avatarUrl?.match(/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i) ? profile.avatarUrl : null;
  const initial = (profile?.displayName || profile?.username || "C").trim().charAt(0).toUpperCase();
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#16052f" }}>
      <div style={{ width: 500, height: 500, borderRadius: 250, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", background: "#7c3aed", color: "white", fontSize: 240, fontWeight: 700 }}>
        {avatar ? <img src={avatar} width={500} height={500} style={{ objectFit: "cover" }} /> : initial}
      </div>
    </div>,
    { width: 600, height: 600, headers: { "Cache-Control": "public, max-age=300" } },
  );
}
