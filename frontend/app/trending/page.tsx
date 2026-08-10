"use client";

import { useEffect, useState } from "react";
import { HeaderBrand } from "../components/HeaderBrand";
import { SessionUserAvatar, useSessionUser } from "../components/session-user";

type TrendingTopic = {
  word: string;
  count: number;
  rank: number;
  trend: "up" | "down" | "same";
};

function SearchIcon({ s = 24 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  );
}

function BellIcon({ s = 24 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function GearIcon({ s = 24 }: { s?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function FireIcon({ s = 20 }: { s?: number }) {
  return (
    <svg viewBox="0 0 384 512" width={s} height={s} fill="currentColor" aria-hidden="true">
      <path d="M216 23.9c0-23.8-30.7-32.3-44.9-13.1C48.2 181.4 200 181.4 200 288c0 22.1-17.9 40-40 40s-40-17.9-40-40V192c0-17.7-21.5-26.5-33.9-14.1C33.8 240.2 0 306.8 0 384c0 70.7 57.3 128 128 128h128c70.7 0 128-57.3 128-128 0-129.2-128-177.5-168-360.1z"/>
    </svg>
  );
}

function TrendArrow({ trend }: { trend: "up" | "down" | "same" }) {
  if (trend === "up") {
    return (
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m18 15-6-6-6 6"/>
      </svg>
    );
  }
  if (trend === "down") {
    return (
      <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m6 9 6 6 6-6"/>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 12h8"/>
    </svg>
  );
}

// Mock data for trending topics - in production this would come from an API
const generateTrendingTopics = (): TrendingTopic[] => {
  const topics = [
    { word: "Tech", count: 2847, trend: "up" },
    { word: "Música", count: 2156, trend: "up" },
    { word: "Futebol", count: 1923, trend: "down" },
    { word: "Games", count: 1756, trend: "up" },
    { word: "Filmes", count: 1432, trend: "same" },
    { word: "Política", count: 1287, trend: "down" },
    { word: "Cripto", count: 1156, trend: "up" },
    { word: "Saúde", count: 1034, trend: "same" },
    { word: "Cinema", count: 923, trend: "up" },
    { word: "Educação", count: 876, trend: "down" },
    { word: "Sustentabilidade", count: 754, trend: "up" },
    { word: "Viagens", count: 698, trend: "same" },
    { word: "Gastronomia", count: 623, trend: "up" },
    { word: "Moda", count: 587, trend: "down" },
    { word: "Arte", count: 534, trend: "same" },
  ];

  return topics.map((topic, index) => ({
    ...topic,
    rank: index + 1,
  }));
};

export default function TrendingPage() {
  const user = useSessionUser();
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setTrendingTopics(generateTrendingTopics());
      setLoading(false);
    }, 500);
  }, []);

  return (
    <div className="flex h-screen flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(60,15,160,0.70) 0%, rgba(18,6,55,0.98) 45%, #060410 100%)" }}>

      {/* ── Header ── */}
      <header className="flex-none border-b border-white/[0.07] bg-transparent">
        <div className="mx-auto flex h-[80px] max-w-[1280px] items-end justify-between gap-4 px-8 pb-3">

          {/* Logo */}
          <a href="/" className="flex shrink-0 items-center gap-3 pb-1">
            <HeaderBrand />
          </a>

          {/* Nav */}
          <nav aria-label="Navegação" className="flex items-end gap-10 pb-1">
            <a href="/" className="inline-flex h-10 items-center text-[18px] font-semibold text-white/50 transition hover:text-white">
              For You
            </a>
            <a href="/following" className="inline-flex h-10 items-center text-[18px] font-semibold text-white/50 transition hover:text-white">
              Seguindo
            </a>
            <a href="/trending" className="relative inline-flex h-10 items-center text-[18px] font-semibold text-white">
              Trending
              <span className="absolute -bottom-0.5 left-0 right-0 h-[2.5px] rounded-full bg-[#A855F7]" />
            </a>
          </nav>

          {/* Right icons */}
          <div className="flex items-center gap-3 pb-1">
            <button type="button" aria-label="Buscar" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]">
              <SearchIcon s={24} />
            </button>
            <button type="button" aria-label="Notificações" className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]">
              <BellIcon s={24} />
              <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[#A855F7]" />
            </button>
            <a href="/settings" aria-label="Configurações" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.07] text-white transition hover:bg-white/[0.13]">
              <GearIcon s={24} />
            </a>
            <a href="/profile" aria-label="Meu perfil" className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-[#A855F7] text-[16px] font-bold text-white">
              <SessionUserAvatar user={user} size={48} />
            </a>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-[1280px] px-8 py-8">
          
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-[48px] font-extrabold tracking-tight text-white mb-2" style={{ fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif" }}>
              Trending
            </h1>
            <p className="text-[16px] text-white/60">
              Os tópicos mais discutidos da plataforma agora mesmo
            </p>
          </div>

          {/* Trending List */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-[16px] text-white/50">Carregando trending topics...</div>
            </div>
          ) : (
            <div className="grid gap-4">
              {trendingTopics.map((topic) => (
                <div
                  key={topic.word}
                  className="relative flex items-center gap-6 rounded-2xl border border-white/[0.08] bg-[#100828]/80 backdrop-blur-sm px-6 py-5 transition hover:border-[#A855F7]/30 hover:bg-[#180d38]/80"
                >
                  {/* Rank */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A855F7]/20 text-[#C084FC] font-bold text-[18px]">
                    {topic.rank}
                  </div>

                  {/* Topic Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[20px] font-semibold text-white mb-1">
                      {topic.word}
                    </h3>
                    <p className="text-[14px] text-white/50">
                      {topic.count.toLocaleString()} menções
                    </p>
                  </div>

                  {/* Trend Indicator */}
                  <div className="flex items-center gap-2">
                    <TrendArrow trend={topic.trend} />
                    <span className={`text-[14px] font-semibold ${
                      topic.trend === "up" ? "text-[#22C55E]" :
                      topic.trend === "down" ? "text-[#EF4444]" :
                      "text-white/50"
                    }`}>
                      {topic.trend === "up" ? "Em alta" :
                       topic.trend === "down" ? "Em queda" :
                       "Estável"}
                    </span>
                  </div>

                  {/* Join Button */}
                  <button
                    type="button"
                    className="shrink-0 rounded-full border border-[#A855F7]/70 bg-transparent px-6 py-2.5 text-[14px] font-semibold text-white transition hover:bg-[#A855F7]/20"
                  >
                    Ver Clouds
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── Bottom Navigation ── */}
      <nav className="flex-none border-t border-white/[0.07] bg-[#060410]" aria-label="Navegação inferior">
        <div className="mx-auto flex max-w-[480px] items-center justify-around px-4 py-5">

          {/* Home */}
          <a href="/" className="flex flex-col items-center gap-2 text-white/40 transition hover:text-white">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5Z"/>
              <path d="M9 21V12h6v9"/>
            </svg>
            <span className="text-[13px] font-semibold">Home</span>
          </a>

          {/* Messages */}
          <a href="/messages" className="flex flex-col items-center gap-2 text-white/40 transition hover:text-white">
            <svg viewBox="0 0 24 24" width={32} height={32} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span className="text-[13px] font-semibold">Messages</span>
          </a>

          {/* Trending */}
          <a href="/trending" className="flex flex-col items-center gap-2 text-[#A855F7]">
            <svg viewBox="0 0 384 512" width={30} height={30} fill="currentColor" aria-hidden="true">
              <path d="M216 23.9c0-23.8-30.7-32.3-44.9-13.1C48.2 181.4 200 181.4 200 288c0 22.1-17.9 40-40 40s-40-17.9-40-40V192c0-17.7-21.5-26.5-33.9-14.1C33.8 240.2 0 306.8 0 384c0 70.7 57.3 128 128 128h128c70.7 0 128-57.3 128-128 0-129.2-128-177.5-168-360.1z"/>
            </svg>
            <span className="text-[13px] font-semibold">Trending</span>
          </a>

        </div>
      </nav>

    </div>
  );
}
