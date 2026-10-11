import { proxyJsonRequest } from "../_lib/nest-proxy";

export const runtime = "nodejs";

const OFFICIAL_CLOUDS_STICKERS = [
  "alegria",
  "risada",
  "amor",
  "piscadinha",
  "festa",
  "oi",
  "surpresa",
  "sono",
  "triste",
  "choro",
  "bravo",
  "confuso",
  "pensativo",
  "silencioso",
  "beijo",
  "legal",
  "brilho",
  "nervoso",
  "coracao",
  "vitoria",
].map((name) => ({
  id: `clouds-official-${name}`,
  mediaUrl: `/api/stickers/system/${name}?v=2`,
}));

export async function GET(req: Request) {
  const backendResponse = await proxyJsonRequest(req, "/clouds/stickers");
  if (!backendResponse.ok) return backendResponse;

  const payload = (await backendResponse.json().catch(() => null)) as {
    ok?: boolean;
    stickers?: Array<{
      id: string;
      mediaUrl: string;
      createdAt?: string;
      lastUsedAt?: string | null;
    }>;
  } | null;
  const databaseStickers = (
    Array.isArray(payload?.stickers) ? payload.stickers : []
  ).filter((sticker) => !sticker.mediaUrl.startsWith("/api/stickers/system/"));
  const officialUsage = new Map(
    (payload?.stickers ?? [])
      .filter((sticker) => sticker.mediaUrl.startsWith("/api/stickers/system/"))
      .map((sticker) => [sticker.mediaUrl, sticker]),
  );

  // The official starter pack is available immediately after frontend deploy.
  // The database migration persists the same records later, without duplicate
  // items in the picker.
  return Response.json({
    ...(payload ?? { ok: true }),
    stickers: [
      ...OFFICIAL_CLOUDS_STICKERS.map((sticker) => ({
        ...sticker,
        createdAt: null as string | null,
        lastUsedAt: officialUsage.get(sticker.mediaUrl)?.lastUsedAt ?? null,
      })),
      ...databaseStickers,
    ].sort((a, b) => {
      const recent = (Date.parse(b.lastUsedAt ?? "") || 0) - (Date.parse(a.lastUsedAt ?? "") || 0);
      if (recent !== 0) return recent;
      const saved = (Date.parse(b.createdAt ?? "") || 0) - (Date.parse(a.createdAt ?? "") || 0);
      return saved || a.id.localeCompare(b.id);
    }),
  });
}

export async function POST(req: Request) {
  return proxyJsonRequest(req, "/clouds/stickers");
}

export async function DELETE(req: Request) {
  return proxyJsonRequest(req, "/clouds/stickers");
}
