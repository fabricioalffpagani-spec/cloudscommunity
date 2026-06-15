import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";

type RankUser = {
  position: number;
  name: string;
  description: string;
  hypes: string;
  initial: string;
  avatarSize: string;
  cardHeight?: string;
  highlight?: boolean;
};

type SuggestionUser = {
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
    position: 1,
    name: "Luna",
    description: "Criadora de threads",
    hypes: "12.4k hypes",
    initial: "L",
    avatarSize: "h-28 w-28 sm:h-32 sm:w-32",
    cardHeight: "min-h-[420px]",
    highlight: true,
  },
  {
    position: 2,
    name: "Kai",
    description: "Comentador em alta",
    hypes: "10.8k hypes",
    initial: "K",
    avatarSize: "h-20 w-20 sm:h-24 sm:w-24",
    cardHeight: "min-h-[360px]",
  },
  {
    position: 3,
    name: "Maya",
    description: "Perfil emergente",
    hypes: "10.1k hypes",
    initial: "M",
    avatarSize: "h-20 w-20 sm:h-24 sm:w-24",
    cardHeight: "min-h-[360px]",
  },
  {
    position: 4,
    name: "Theo",
    description: "Moderador da conversa",
    hypes: "8.7k hypes",
    initial: "T",
    avatarSize: "h-14 w-14",
  },
  {
    position: 5,
    name: "Nina",
    description: "Curadora de tópicos",
    hypes: "8.2k hypes",
    initial: "N",
    avatarSize: "h-14 w-14",
  },
];

const suggestions: SuggestionUser[] = [
  { name: "Aurora", description: "Sempre trazendo debates quentes", initial: "A" },
  { name: "Pedro", description: "Perfil em alta no momento", initial: "P" },
  { name: "Nina", description: "Curadora de tendências", initial: "N" },
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
            <Image src="/logo_clouds.png" alt="Clouds Community" width={44} height={44} className="h-11 w-11 object-contain" priority />
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
          <Link href="/" className="inline-flex h-12 items-center rounded-full bg-[#1A1A1D] px-6 text-[18px] font-bold text-white transition-colors hover:bg-[#232327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
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
          <button type="button" aria-label="Publicar" className="flex h-12 w-12 items-center justify-center rounded-full border border-transparent bg-[#2E1065] text-[#D8B4FE] transition-colors hover:bg-[#3B0764] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path d="M12 16V4m0 0-5 5m5-5 5 5M5 20h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" aria-label="Notificações" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#1C1C1C] text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 19a2 2 0 0 0 4 0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" aria-label="Configurações" className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#1C1C1C] text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M12 2.75v2.1M12 19.15v2.1M4.85 4.85l1.48 1.48M17.67 17.67l1.48 1.48M2.75 12h2.1M19.15 12h2.1M4.85 19.15l1.48-1.48M17.67 6.33l1.48-1.48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
          <button type="button" aria-label="Avatar do usuário" className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8B5CF6] text-[16px] font-extrabold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]">
            F
          </button>
        </div>
      </div>
    </header>
  );
}

function PodiumCard({ user }: { user: RankUser }) {
  const cardGradient =
    user.position === 1
      ? "bg-gradient-to-b from-[#854D0E] via-[#A16207] to-[#CA8A04]"
      : user.position === 2
        ? "bg-gradient-to-b from-[#475569] via-[#64748B] to-[#94A3B8]"
        : "bg-gradient-to-b from-[#7C2D12] via-[#9A3412] to-[#C2410C]";

  const positionOpacity = user.position === 1 ? "text-white/55" : user.position === 2 ? "text-white/50" : "text-white/45";

  return (
    <article
      className={`rounded-[24px] border border-white/8 px-5 py-6 text-center shadow-[0_0_0_1px_rgba(255,255,255,0.02)] ${cardGradient} ${
        user.cardHeight ?? "min-h-[320px]"
      }`}
    >
      <div className="flex h-full flex-col items-center justify-between gap-5">
        <div className="flex flex-1 flex-col items-center justify-center">
          <div className={`flex items-center justify-center rounded-full bg-[#8B5CF6] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)] ${user.avatarSize}`}>
            <span className={`${user.highlight ? "text-[40px]" : "text-[28px]"} font-extrabold`}>{user.initial}</span>
          </div>
          <h3 className="mt-5 text-[20px] font-semibold text-white">{user.name}</h3>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#F59E0B] bg-[#6B4A00] px-4 py-2 text-[14px] font-semibold text-[#F97316]">
            <FlameIcon className="h-4 w-4" />
            <span>{user.hypes}</span>
          </div>
        </div>

        <div className="flex w-full items-end justify-center">
          <div className={`text-[56px] font-extrabold leading-none tracking-[-0.06em] sm:text-[64px] ${positionOpacity}`}>
            {user.position}
          </div>
        </div>

        <div className="flex w-full gap-3">
          <div className="flex-1">
            <OutlinedButton>Ver perfil</OutlinedButton>
          </div>
          <div className="flex-1">
            <PrimaryButton>Seguir</PrimaryButton>
          </div>
        </div>
      </div>
    </article>
  );
}

function RankRow({ user }: { user: RankUser }) {
  return (
    <article className="rounded-[24px] border border-white/8 bg-[#131826] px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <div className="min-w-[34px] text-[22px] font-semibold text-white/35">0{user.position}</div>
          <Avatar initial={user.initial} size="h-12 w-12" />
          <div>
            <h4 className="text-[18px] font-semibold text-white">{user.name}</h4>
            <p className="text-[14px] text-white/55">{user.description}</p>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-[14px] font-semibold text-[#F97316]">
            <FlameIcon className="h-4 w-4" />
            <span>{user.hypes}</span>
          </div>
          <div className="flex gap-3">
            <OutlinedButton>Ver perfil</OutlinedButton>
            <PrimaryButton>Seguir</PrimaryButton>
          </div>
        </div>
      </div>
    </article>
  );
}

function SuggestionCard({ user }: { user: SuggestionUser }) {
  return (
    <article className="rounded-[24px] border border-white/8 bg-[#131826] px-5 py-6 text-center">
      <div className="flex h-full flex-col items-center justify-between gap-4">
        <div className="flex flex-col items-center">
          <Avatar initial={user.initial} size="h-16 w-16" />
          <h3 className="mt-4 text-[18px] font-semibold text-white">{user.name}</h3>
          <p className="mt-2 text-[14px] leading-6 text-white/55">{user.description}</p>
        </div>
        <div className="flex w-full gap-3 pt-2">
          <div className="flex-1">
            <OutlinedButton>Ver perfil</OutlinedButton>
          </div>
          <div className="flex-1">
            <PrimaryButton>Seguir</PrimaryButton>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function MeetPage() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <Navbar />

      <main className="mx-auto max-w-[1280px] px-4 pb-20 pt-[132px] sm:px-6 lg:px-8">
        <section className="grid gap-6 rounded-[28px] border border-white/8 bg-gradient-to-r from-[#2A0F44] via-[#130F18] to-[#09090B] px-6 py-6 lg:grid-cols-[1fr_auto] lg:items-start lg:px-8 lg:py-8">
          <div className="max-w-[860px]">
            <div className="text-[18px] font-extrabold uppercase tracking-[0.34em] text-[#F59E0B]">RANKING</div>
            <div className="mt-5 flex items-center gap-3">
              <h1 className="text-[46px] font-extrabold tracking-[-0.05em] text-white sm:text-[58px] lg:text-[68px]">Meet</h1>
              <FlameIcon className="h-11 w-11 text-[#F97316] sm:h-12 sm:w-12" />
            </div>
            <p className="mt-5 max-w-[900px] text-[16px] leading-7 text-white/72 sm:text-[18px]">
              Os perfis mais hypados da plataforma. Quanto mais hypes recebidos, maior o posto no ranking.
            </p>
          </div>

          <aside className="rounded-[20px] border border-white/8 bg-[#131826] px-6 py-5 lg:w-[250px]">
            <div className="text-[13px] uppercase tracking-[0.26em] text-white/45">Perfis ativos</div>
            <div className="mt-3 text-[48px] font-extrabold tracking-[-0.05em] text-[#F59E0B]">128</div>
            <p className="mt-2 text-[14px] text-white/55">Usuarios engajados agora</p>
          </aside>
        </section>

        <section className="mt-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {regions.map((region) => (
              <button
                key={region.name}
                type="button"
                className={`inline-flex h-11 items-center rounded-full border px-4 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC] ${
                  region.active
                    ? "border-white/20 bg-white text-[#111827]"
                    : "border-[#F59E0B]/70 bg-[#F59E0B]/10 text-white/72 hover:bg-[#F59E0B]/15"
                }`}
              >
                {region.name}
              </button>
            ))}
          </div>

          <div className="w-full lg:w-[330px]">
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
        </section>

        <section className="mt-12">
          <div className="mb-4 text-center text-[13px] font-extrabold uppercase tracking-[0.34em] text-[#F59E0B]">
            TOP HYPADOS
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr_1fr] lg:items-end">
            <div className="lg:translate-y-6">
              <PodiumCard user={ranking[1]} />
            </div>

            <div>
              <PodiumCard user={ranking[0]} />
            </div>

            <div className="lg:translate-y-6">
              <PodiumCard user={ranking[2]} />
            </div>
          </div>
        </section>

        <section className="mt-8 space-y-4">
          {ranking.slice(3).map((user) => (
            <RankRow key={user.position} user={user} />
          ))}
        </section>

        <section className="mt-12">
          <h2 className="text-[22px] font-medium text-white">Pessoas que talvez voce conheça</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {suggestions.map((user) => (
              <SuggestionCard key={user.name} user={user} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
