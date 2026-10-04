import { NextResponse } from "next/server";
import { resolveBackendOrigin } from "../_lib/nest-proxy";

export const runtime = "nodejs";

type CloudApiPayload = {
  id: string;
  title: string;
  duration: string;
  visibility: string;
  status: string;
  createdAt: string;
  hypesCount: number;
  membersCount: number;
  author?: {
    name?: string;
    username?: string;
    avatarUrl?: string | null;
    location?: string | null;
  };
};

const DURATION_SECONDS: Record<string, number> = {
  "10min": 10 * 60,
  "30min": 30 * 60,
  "2h": 2 * 60 * 60,
  "5h": 5 * 60 * 60,
  "24h": 24 * 60 * 60,
};

function isCloudActive(cloud: CloudApiPayload): boolean {
  const durationSecs = DURATION_SECONDS[cloud.duration] ?? 30 * 60;
  const elapsedSecs = (Date.now() - new Date(cloud.createdAt).getTime()) / 1000;
  return elapsedSecs < durationSecs;
}

function normalizeCountry(value?: string | null): string {
  return (value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export async function GET(req: Request) {
  try {
    const scope = new URL(req.url).searchParams.get("scope") === "nearby" ? "nearby" : "world";
    const backendOrigin = resolveBackendOrigin();
    const response = await fetch(`${backendOrigin}/clouds`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ ok: false, clouds: [] }, { status: 200 });
    }

    const payload = (await response.json()) as { clouds?: CloudApiPayload[] };
    const clouds = Array.isArray(payload?.clouds) ? payload.clouds : [];

    // Filtra apenas clouds ativas e públicas
    let activeClouds = clouds.filter(
      (c) => c.visibility === "public" && isCloudActive(c) && c.hypesCount > 0,
    );

    let nearbyUnavailable = false;
    if (scope === "nearby") {
      const profileResponse = await fetch(`${backendOrigin}/auth/me`, {
        headers: { cookie: req.headers.get("cookie") ?? "" },
        cache: "no-store",
      });
      const profilePayload = await profileResponse.json().catch(() => null) as { user?: { location?: string | null } } | null;
      const country = normalizeCountry(profilePayload?.user?.location);
      if (!country) {
        nearbyUnavailable = true;
        activeClouds = [];
      } else {
        activeClouds = activeClouds.filter((cloud) => normalizeCountry(cloud.author?.location) === country);
      }
    }

    // Hype é o sinal principal. Em empate, a Cloud mais recente aparece primeiro.
    const rankedClouds = activeClouds
      .sort((a, b) => b.hypesCount - a.hypesCount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.id.localeCompare(b.id))
      .slice(0, 25)
      .map((cloud, index) => ({ ...cloud, rank: index + 1 }));

    return NextResponse.json({ ok: true, clouds: rankedClouds, totalActiveClouds: activeClouds.length, nearbyUnavailable });
  } catch {
    return NextResponse.json({ ok: false, clouds: [] }, { status: 200 });
  }
}
