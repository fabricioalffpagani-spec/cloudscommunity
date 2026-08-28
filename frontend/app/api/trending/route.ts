import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Palavras irrelevantes que devem ser ignoradas na análise
const STOP_WORDS = new Set([
  "a", "as", "o", "os", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das", "no", "na", "nos", "nas",
  "em", "por", "para", "com", "sem", "que", "se", "e", "ou",
  "ao", "à", "aos", "às", "pelo", "pela", "pelos", "pelas",
  "como", "mais", "mas", "sua", "seu", "seus", "suas",
  "meu", "minha", "meus", "minhas", "esse", "essa", "esses", "essas",
  "este", "esta", "estes", "estas", "neste", "nessa", "isto", "isso",
  "aqui", "ali", "já", "não", "sim", "vai", "vem", "vão",
  "é", "são", "foi", "ser", "tem", "ter", "the", "of", "and", "in",
  "vs", "vs.", "x", "ft", "ft.", "ep", "ep.",
]);

type CloudApiPayload = {
  id: string;
  title: string;
  duration: string;
  visibility: string;
  status: string;
  createdAt: string;
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

function extractWords(title: string): string[] {
  return title
    .toLowerCase()
    // remove pontuação e caracteres especiais, mantendo letras e acentos
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

export type TrendingTopic = {
  word: string;
  count: number;
  rank: number;
  cloudIds: string[];
};

export async function GET(req: Request) {
  try {
    const backendOrigin = process.env.CLOUDS_BRIDGE_URL?.replace(/\/+$/, "") ?? "http://localhost:3001";
    const response = await fetch(`${backendOrigin}/clouds`, {
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json({ ok: false, topics: [] }, { status: 200 });
    }

    const payload = (await response.json()) as { clouds?: CloudApiPayload[] };
    const clouds = Array.isArray(payload?.clouds) ? payload.clouds : [];

    // Filtra apenas clouds ativas e públicas
    const activeClouds = clouds.filter(
      (c) => c.visibility === "public" && isCloudActive(c),
    );

    // Conta quantas clouds distintas contêm cada palavra (uma ocorrência por cloud)
    const wordMap = new Map<string, { count: number; cloudIds: Set<string> }>();

    for (const cloud of activeClouds) {
      const words = extractWords(cloud.title);
      // deduplica dentro do mesmo título para não inflar uma cloud com palavra repetida
      const uniqueWords = Array.from(new Set(words));
      for (const word of uniqueWords) {
        const entry = wordMap.get(word) ?? { count: 0, cloudIds: new Set() };
        entry.count += 1;
        entry.cloudIds.add(cloud.id);
        wordMap.set(word, entry);
      }
    }

    // Ordena por contagem decrescente; empate desfeito alfabeticamente para ranking estável
    const topics: TrendingTopic[] = Array.from(wordMap.entries())
      .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
      .slice(0, 10)
      .map(([word, { count, cloudIds }], index) => ({
        word: word.charAt(0).toUpperCase() + word.slice(1),
        count,
        rank: index + 1,
        cloudIds: Array.from(cloudIds),
      }));

    return NextResponse.json({ ok: true, topics, totalActiveClouds: activeClouds.length });
  } catch {
    return NextResponse.json({ ok: false, topics: [] }, { status: 200 });
  }
}
