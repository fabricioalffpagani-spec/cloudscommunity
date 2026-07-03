import Link from "next/link";
import Image from "next/image";
import RecommendedProfiles from "./RecommendedProfiles";
import Footer from "../components/Footer";
import type { ReactNode } from "react";


type RankUser = {
  id: string;
  name: string;
  description: string;
  hypes: string;
  followersInCommon: string;
  initial: string;
  avatarSize: string;
  highlight?: boolean;
};

type SuggestionUser = {
  id: string;
  name: string;
  description: string;
  initial: string;
};

const regions = [
  { name: "Todas as regiões", active: true },
  { name: "Norte" },
  { name: "Nordeste" },
  { name: "Centro-Oeste" },
  { name: "Sudeste" },
  { name: "Sul" },
];

const ranking: RankUser[] = [
  {
    id: "luna",
    name: "Luna",
    description: "Criadora de threads",
    hypes: "12.4k hypes",
    followersInCommon: "42 seguidores em comum",
    initial: "L",
    avatarSize: "h-20 w-20 sm:h-24 sm:w-24",
    highlight: true,
  },
  {
    id: "kai",
    name: "Kai",
    description: "Comentador em alta",
    hypes: "10.8k hypes",
    followersInCommon: "37 seguidores em comum",
    initial: "K",
    avatarSize: "h-20 w-20 sm:h-24 sm:w-24",
  },
  {
    id: "maya",
    name: "Maya",
    description: "Perfil emergente",
    hypes: "10.1k hypes",
    followersInCommon: "31 seguidores em comum",
    initial: "M",
    avatarSize: "h-20 w-20 sm:h-24 sm:w-24",
  },
  {
    id: "theo",
    name: "Theo",
    description: "Moderador da conversa",
    hypes: "8.7k hypes",
    followersInCommon: "29 seguidores em comum",
    initial: "T",
    avatarSize: "h-20 w-20 sm:h-24 sm:w-24",
  },
  {
    id: "nina",
    name: "Nina",
    description: "Curadora de tópicos",
    hypes: "8.2k hypes",
    followersInCommon: "24 seguidores em comum",
    initial: "N",
    avatarSize: "h-20 w-20 sm:h-24 sm:w-24",
  },
];

function FlameIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="currentColor"
        d="M13.5 2.5c.5 3-1.2 4.7-3.2 6.6-1.5 1.4-3.1 2.9-3.1 5.3 0 3.4 2.7 6.1 6.1 6.1s6.1-2.7 6.1-6.1c0-2.8-1.6-4.9-3.1-6.5-.6 1.7-1.8 2.6-3 3.3.4-1.9.2-4.1.2-4.7 0-1.4-.5-2.6-1.1-4z"
      />
    </svg>
  );
}

function SearchIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Avatar({ initial, size = "h-16 w-16" }: { initial: string; size?: string }) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-[#8B5CF6] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)] ${size}`}
      aria-label={`Avatar de ${initial}`}
    >
      <span className="text-[22px] font-extrabold">{initial}</span>
    </div>
  );
}

function OutlinedButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-11 items-center rounded-full border border border-[#9333EA] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]"
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      className="inline-flex h-11 items-center rounded-full bg-[#9333EA] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#7C3AED] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]"
    >
      {children}
    </button>
  );
}

function Navbar() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#0F1117]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-[92px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="shrink-0">
          <div className="flex items-center gap-3">
            <Image src="/logo_clouds.png" alt="Clouds Community" width={64} height={64} className="h-16 w-16 object-contain" priority />
            <div className="leading-none">
              <div className="text-[28px] font-extrabold tracking-[-0.04em] text-white sm:text-[32px]">Clouds</div>
              <div className="text-[14px] font-medium uppercase tracking-[0.44em] text-white/60">Community</div>
            </div>
          </div>
        </Link>

        <nav aria-label="Navegação principal" className="hidden items-center gap-4 md:flex">
          <Link href="/" className="inline-flex h-12 items-center rounded-full bg-[#1A1A1D] px-6 text-[18px] font-bold text-white transition-colors hover:bg-[#232327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            Home
          </Link>
          <Link href="/messages" className="inline-flex h-12 items-center rounded-full bg-[#1A1A1D] px-6 text-[18px] font-bold text-white transition-colors hover:bg-[#232327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            Messages
          </Link>
          <Link href="/meet" className="inline-flex h-12 items-center rounded-full bg-[#1A1A1D] px-6 text-[18px] font-bold text-white transition-colors hover:bg-[#232327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            Meet
          </Link>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <button type="button" aria-label="Buscar" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#1C1C1C] text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            <SearchIcon className="h-6 w-6" />
          </button>
          <button type="button" aria-label="Notificações" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#1C1C1C] text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/settings" aria-label="Configurações" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#1C1C1C] text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>
            </svg>
          </Link>
          <Link href="/profile" aria-label="Meu perfil" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8B5CF6] text-[16px] font-extrabold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            F
          </Link>
        </div>
      </div>
    </header>
  );
}

function ProfileCard({ user }: { user: RankUser }) {
  return (
    <article className="min-w-[280px] flex-shrink-0 rounded-[24px] border border-white/10 bg-[#111827] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-4">
        <Link href={`/users/${user.id}`} className="shrink-0">
          <Avatar initial={user.initial} size={user.avatarSize} />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[18px] font-semibold text-white">{user.name}</h3>
            {user.highlight && <span className="rounded-full bg-[#7C3AED]/20 px-2 py-1 text-[11px] uppercase tracking-[0.2em] text-[#C084FC]">Top</span>}
          </div>
          <p className="mt-1 text-sm text-white/60">{user.description}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
          <div className="font-semibold text-white">{user.hypes}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/40">Hypes</div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
          <div className="font-semibold text-white">{user.followersInCommon}</div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.22em] text-white/40">Seguidores em comum</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <OutlinedButton>Ver perfil</OutlinedButton>
        <PrimaryButton>Seguir</PrimaryButton>
      </div>
    </article>
  );
}

export default function MeetPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <Navbar />

      <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-[132px] sm:px-6 lg:px-8">
        <section className="rounded-[28px] border border-white/8 bg-[#120B1F]/80 p-6 lg:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[740px]">
              <div className="text-[13px] font-semibold uppercase tracking-[0.3em] text-[#F59E0B]">
                Conheça sua comunidade
              </div>
              <h1 className="mt-4 text-[38px] font-bold tracking-[-0.04em] text-white sm:text-[48px]">
                Perfis recomendados para você
              </h1>
              <p className="mt-4 max-w-[760px] text-[15px] leading-7 text-white/70">
                Uma seleção simples e direta de perfis com alto hype e conexão real com seus seguidores.
              </p>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-[#111827] px-5 py-4 text-center">
              <div className="text-[13px] uppercase tracking-[0.3em] text-white/45">Ativos agora</div>
              <div className="mt-3 text-[40px] font-semibold text-[#F59E0B]">128</div>
              <p className="mt-2 text-sm text-white/60">usuários prontos para conexão</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {regions.map((region) => (
                <button
                  key={region.name}
                  type="button"
                  className={`inline-flex h-11 items-center rounded-full border px-4 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC] ${
                    region.active
                      ? "border-white/20 bg-white text-[#111827]"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {region.name}
                </button>
              ))}
            </div>

            <div className="w-full lg:w-[360px]">
              <label className="sr-only" htmlFor="meet-search">
                Buscar perfil
              </label>
              <div className="flex h-12 items-center gap-3 rounded-full border border-white/10 bg-[#171A22] px-4 text-white/55">
                <SearchIcon className="h-5 w-5 shrink-0" />
                <input
                  id="meet-search"
                  type="search"
                  placeholder="Buscar perfil..."
                  className="w-full bg-transparent text-[14px] text-white placeholder:text-white/45 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10">
          <RecommendedProfiles profiles={ranking} />
        </section>
      </main>

      <Footer />
    </div>
  );
}
