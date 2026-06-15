import Link from "next/link";
import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

type Category = {
  name: string;
  bg: string;
  text?: string;
  active?: boolean;
};

type CloudCardData = {
  badge: string;
  badgeBg: string;
  title: string;
  description: string;
  timer: string;
  people: string;
  avatars: string[];
  liveLabel?: string;
  liveDot?: string;
  mode: "audio" | "text";
  timeLabel: string;
  waveform?: number[];
};

const categories: Category[] = [
  { name: "For You", bg: "#FFFFFF", text: "#111827", active: true },
  { name: "Trending", bg: "#E11DFF" },
  { name: "Drama", bg: "#FF3B59" },
  { name: "Funny", bg: "#F2B705" },
  { name: "Sports", bg: "#22C55E" },
  { name: "Real Life", bg: "#3B82F6" },
  { name: "Pop", bg: "#7C6BFF" },
  { name: "Politics", bg: "#1DA1F2" },
  { name: "Tech", bg: "#14B8A6" },
  { name: "Gaming", bg: "#F97316" },
  { name: "Music", bg: "#38BDF8" },
  { name: "Movies", bg: "#84CC16" },
  { name: "Memes", bg: "#FF2D6F" },
];

const cloudCards: CloudCardData[] = [
  {
    badge: "TRENDING",
    badgeBg: "linear-gradient(90deg, #7C3AED 0%, #EC4899 100%)",
    title: "Áudio de Fabrício Alff Pagani",
    description: "Opiniões divididas. Entre na conversa é a sua.",
    timer: "29:57 restantes",
    people: "1 pessoas agora",
    avatars: ["A", "B", "C", "+5"],
    liveLabel: "AO VIVO",
    liveDot: "#22C55E",
    mode: "audio",
    timeLabel: "0:00 / 0:02",
    waveform: [
      10, 18, 28, 24, 12, 18, 30, 26, 10, 22, 18, 16, 12, 18, 24, 20, 16, 14,
      28, 10, 16, 34, 18, 20, 24, 22, 16, 12, 18, 24, 14, 20, 26, 16, 14, 18,
      22, 34, 18, 12, 16, 28, 14, 18, 24, 12,
    ],
  },
  {
    badge: "DRAMA",
    badgeBg: "#FF3B59",
    title: "Quando uma conversa pública muda tudo o que parecia resolvido.",
    description: "Linhas cruzadas, versões diferentes e muita gente tentando entender o que aconteceu.",
    timer: "12:14 restantes",
    people: "7 pessoas agora",
    avatars: ["D", "E", "F", "+2"],
    liveLabel: "AO VIVO",
    liveDot: "#22C55E",
    mode: "text",
    timeLabel: "Agora",
  },
  {
    badge: "TECH",
    badgeBg: "#14B8A6",
    title: "IA generativa vai continuar acelerando trabalho criativo?",
    description: "O que hoje parece ferramenta, amanhã vira padrão de produção para quase tudo.",
    timer: "05:08 restantes",
    people: "3 pessoas agora",
    avatars: ["G", "H", "I", "+1"],
    liveLabel: "AO VIVO",
    liveDot: "#22C55E",
    mode: "text",
    timeLabel: "Agora",
  },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Icon({
  name,
  className,
  strokeWidth = 2,
}: {
  name: "search" | "upload" | "bell" | "settings" | "cloud" | "list" | "mic" | "plus" | "chevron-right" | "share" | "heart" | "play" | "spark" | "x";
  className?: string;
  strokeWidth?: number;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "search":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="11" cy="11" r="7.5" {...common} />
          <path d="M20 20l-3.5-3.5" {...common} />
        </svg>
      );
    case "upload":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 16V4" {...common} />
          <path d="m7 9 5-5 5 5" {...common} />
          <path d="M5 20h14" {...common} />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15" {...common} />
          <path d="M10 19a2 2 0 0 0 4 0" {...common} />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="3.5" {...common} />
          <path d="M12 2.75v2.1M12 19.15v2.1M4.85 4.85l1.48 1.48M17.67 17.67l1.48 1.48M2.75 12h2.1M19.15 12h2.1M4.85 19.15l1.48-1.48M17.67 6.33l1.48-1.48" {...common} />
        </svg>
      );
    case "cloud":
      return (
        <svg viewBox="0 0 32 24" className={className} aria-hidden="true">
          <path d="M9.5 20.5a5 5 0 1 1 0-10 7 7 0 0 1 13.3 2.4 4.6 4.6 0 0 1-1.2 9.1H9.5Z" {...common} />
        </svg>
      );
    case "list":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M5 7h14" {...common} />
          <path d="M5 12h14" {...common} />
          <path d="M5 17h14" {...common} />
        </svg>
      );
    case "mic":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" {...common} />
          <path d="M19 12a7 7 0 0 1-14 0" {...common} />
          <path d="M12 19v3" {...common} />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 5v14" {...common} />
          <path d="M5 12h14" {...common} />
        </svg>
      );
    case "chevron-right":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="m9 6 6 6-6 6" {...common} />
        </svg>
      );
    case "share":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 16V4" {...common} />
          <path d="m7 9 5-5 5 5" {...common} />
          <path d="M5 20h14" {...common} />
        </svg>
      );
    case "heart":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M20.5 8.2c0 4.5-8.5 9.5-8.5 9.5s-8.5-5-8.5-9.5A4.7 4.7 0 0 1 12 4.4a4.7 4.7 0 0 1 8.5 3.8Z" {...common} />
        </svg>
      );
    case "play":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M9 7.5 17 12 9 16.5Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M12 3l1.7 5.2L19 10l-5.3 1.8L12 17l-1.7-5.2L5 10l5.3-1.8L12 3Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case "x":
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <path d="M6 6l12 12" {...common} />
          <path d="M18 6 6 18" {...common} />
        </svg>
      );
  }
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <Image src="/logo_clouds.png" alt="Clouds Community" width={44} height={44} className="h-11 w-11 object-contain" priority />
      <div className="leading-none">
        <div className="text-[28px] font-extrabold tracking-[-0.04em] text-white sm:text-[32px]">Clouds</div>
        <div className="text-[14px] font-medium uppercase tracking-[0.44em] text-white/60">Community</div>
      </div>
    </div>
  );
}

function NavIconButton({ label, active = false, children }: { label: string; active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        "flex h-12 w-12 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]",
        active
          ? "border-transparent bg-[#2E1065] text-[#D8B4FE] hover:bg-[#3B0764]"
          : "border-white/10 bg-[#1C1C1C] text-white hover:bg-white/8",
      )}
    >
      {children}
    </button>
  );
}

function CategoryPill({ category }: { category: Category }) {
  return (
    <button
      type="button"
      className={cx(
        "whitespace-nowrap rounded-full px-4 py-3 text-[14px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]",
        category.active
          ? "border border-white/25 bg-white text-[#111827] hover:bg-white/95"
          : "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)] hover:opacity-95",
      )}
      style={
        category.active
          ? undefined
          : ({
              backgroundColor: category.bg,
              color: "#FFFFFF",
            } as CSSProperties)
      }
      aria-pressed={category.active}
    >
      {category.name}
    </button>
  );
}

function AvatarStack({ avatars, people }: { avatars: string[]; people: string }) {
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center">
        {avatars.map((avatar, index) => {
          const isPlus = avatar.startsWith("+");
          return (
            <div
              key={`${avatar}-${index}`}
              className={cx(
                "flex h-10 w-10 items-center justify-center rounded-full border border-[#242845] text-[15px] font-bold text-white shadow-[0_0_0_1px_rgba(0,0,0,0.25)]",
                index === 0 ? "bg-[#C83CFF]" : index === 1 ? "bg-[#A245F5] -ml-2" : index === 2 ? "bg-[#C94AB7] -ml-2" : "bg-[#434A66] -ml-2 text-[14px]",
              )}
            >
              {isPlus ? <span className="text-[14px] font-semibold">{avatar}</span> : avatar}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 text-[12px] text-white/62">
        <span className="h-2 w-2 rounded-full bg-[#FF4569]" aria-hidden="true" />
        <span>{people}</span>
      </div>
    </div>
  );
}

function LiveIndicator({ timer }: { timer: string }) {
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <div className="flex items-center gap-2 text-[14px] font-semibold text-[#22C55E]">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22C55E] opacity-70" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22C55E]" />
        </span>
        <span>AO VIVO</span>
      </div>
      <div className="text-[12px] tracking-[0.14em] text-white/50">{timer}</div>
    </div>
  );
}

function Waveform({ bars = [] }: { bars?: number[] }) {
  return (
    <div className="mt-5 flex h-10 items-end gap-1 overflow-hidden">
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-2 rounded-full bg-white/18"
          style={{ height: `${Math.max(8, height)}px` }}
          aria-hidden="true"
        />
      ))}
      <span className="ml-1 h-8 w-4 rounded-full bg-white" aria-hidden="true" />
    </div>
  );
}

function AudioPlayer({ waveform, timeLabel }: { waveform?: number[]; timeLabel: string }) {
  return (
    <div className="overflow-hidden rounded-[18px] border border-white/10 bg-gradient-to-r from-[#2B0B4D] via-[#30143C] to-[#20113F] p-4">
      <div className="flex items-start gap-4">
        <button
          type="button"
          aria-label="Reproduzir áudio"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-[#B83CF7] text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition-transform hover:scale-[1.02]"
        >
          <Icon name="play" className="h-5 w-5 translate-x-[1px]" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-semibold text-white">Áudio de Fabrício Alff Pagani</div>
          <div className="text-[13px] text-white/52">Fabrício Alff Pagani</div>
          <div className="text-[12px] tracking-[0.12em] text-white/72">{timeLabel}</div>
          <Waveform bars={waveform} />
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  icon,
  active = false,
  className,
}: {
  children: ReactNode;
  icon: "share" | "heart" | "plus" | "spark";
  active?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex h-12 items-center gap-2 rounded-full border px-5 text-[14px] font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]",
        active
          ? "border-transparent bg-[#9333EA] text-white hover:bg-[#7C3AED] active:bg-[#6D28D9]"
          : "border-white/18 bg-[#0B0D1A] text-white hover:border-white/30 hover:bg-white/6",
        className,
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
      <span>{children}</span>
    </button>
  );
}

function CloudCard({ card }: { card: CloudCardData }) {
  return (
    <article className="rounded-[24px] border border-white/9 bg-[#101624] px-6 py-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <span
          className="inline-flex w-fit items-center rounded-full px-3 py-1 text-[12px] font-extrabold text-white"
          style={{ background: card.badgeBg }}
        >
          <span className="mr-2 inline-block h-3 w-3 rounded-full bg-white" aria-hidden="true" />
          {card.badge}
        </span>

        <div className="flex items-start justify-between gap-5 lg:flex-col lg:items-end lg:gap-3">
          <LiveIndicator timer={card.timer} />
          <AvatarStack avatars={card.avatars} people={card.people} />
        </div>
      </div>

      <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.03em] text-white sm:text-[27px]">
        {card.title}
      </h2>

      <div className={cx("mt-4", card.mode === "audio" ? "max-w-[760px]" : "max-w-[760px]")}>
        {card.mode === "audio" ? (
          <AudioPlayer waveform={card.waveform} timeLabel={card.timeLabel} />
        ) : (
          <div className="rounded-[18px] border border-white/10 bg-[#161D2E] p-5 text-[14px] leading-7 text-white/70">
            {card.description}
          </div>
        )}
      </div>

      <p className="mt-4 max-w-[760px] text-[13px] leading-6 text-white/48">
        {card.description}
      </p>

      <div className="mt-5 border-t border-white/10 pt-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-3">
            <ActionButton icon="share">Compartilhar</ActionButton>
            <ActionButton icon="heart">Hypar 0</ActionButton>
          </div>

          <button
            type="button"
            className="inline-flex h-14 items-center justify-center gap-2 rounded-full bg-[#9333EA] px-7 text-[15px] font-extrabold text-white transition-colors hover:bg-[#7C3AED] active:bg-[#6D28D9] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]"
          >
            <Icon name="plus" className="h-4 w-4" />
            <span>Entrar na conversa</span>
            <Icon name="chevron-right" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function FloatingAction({ label, icon, active = false }: { label: string; icon: "cloud" | "list" | "mic" | "x"; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cx(
        "flex h-12 w-12 items-center justify-center rounded-full border transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]",
        active
          ? "border-transparent bg-[#8B5CF6] text-white shadow-[0_0_20px_rgba(139,92,246,0.35)]"
          : "border-white/10 bg-[#171A22] text-white/90",
      )}
    >
      <Icon name={icon} className="h-5 w-5" />
    </button>
  );
}

export default function Page() {
  return (
    <div className="min-h-screen bg-[#09090B] text-white">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#0F1117]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[92px] max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a href="#feed" className="shrink-0">
            <Logo />
          </a>

          <nav aria-label="Navegação principal" className="hidden items-center gap-4 md:flex">
            <a
              href="#feed"
              className="inline-flex h-12 items-center rounded-full bg-[#1A1A1D] px-6 text-[18px] font-bold text-white transition-colors hover:bg-[#232327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]"
            >
              Home
            </a>
            <a
              href="#feed"
              className="inline-flex h-12 items-center rounded-full bg-[#1A1A1D] px-6 text-[18px] font-bold text-white transition-colors hover:bg-[#232327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]"
            >
              Messages
            </a>
            <Link
              href="/meet"
              className="inline-flex h-12 items-center rounded-full bg-[#1A1A1D] px-6 text-[18px] font-bold text-white transition-colors hover:bg-[#232327] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]"
            >
              Meet
            </Link>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <NavIconButton label="Buscar">
              <Icon name="search" className="h-6 w-6" />
            </NavIconButton>
            <NavIconButton label="Publicar" active>
              <Icon name="upload" className="h-6 w-6" />
            </NavIconButton>
            <NavIconButton label="Notificações">
              <Icon name="bell" className="h-6 w-6" />
            </NavIconButton>
            <NavIconButton label="Configurações">
              <Icon name="settings" className="h-6 w-6" />
            </NavIconButton>
            <button
              type="button"
              aria-label="Avatar do usuário"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8B5CF6] text-[16px] font-extrabold text-white shadow-[0_0_0_1px_rgba(255,255,255,0.12)] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]"
            >
              F
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 pb-24 pt-[126px] sm:px-6 lg:px-8">
        <section id="feed" className="scroll-mt-32">
          <div className="max-w-[980px]">
            <div className="text-[18px] font-extrabold uppercase tracking-[0.34em] text-[#FF5C3C]">
              FEED
            </div>
            <h1 className="mt-5 max-w-[900px] text-[46px] font-extrabold leading-[0.98] tracking-[-0.05em] text-white sm:text-[58px] lg:text-[68px]">
              Descubra conversas acontecendo agora.
            </h1>
            <p className="mt-6 max-w-[920px] text-[16px] leading-7 text-white/72 sm:text-[18px]">
              Explore topics quentes, navegue por categorias e seja o primeiro a iniciar uma conversa.
            </p>
          </div>

          <div className="mt-10 flex items-center gap-2 overflow-x-auto pb-2 pr-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categories.map((category) => (
              <CategoryPill key={category.name} category={category} />
            ))}
            <button
              type="button"
              aria-label="Mais categorias"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#A94BF2] text-white shadow-[0_0_22px_rgba(169,75,242,0.35)] transition-transform hover:scale-[1.02] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]"
            >
              <Icon name="chevron-right" className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-10 space-y-5">
            {cloudCards.map((card) => (
              <CloudCard key={card.title} card={card} />
            ))}
          </div>
        </section>
      </main>

      <div className="fixed bottom-6 right-4 z-40 flex flex-col items-center gap-3 sm:right-6 lg:right-8">
        <FloatingAction label="Criar cloud" icon="cloud" />
        <FloatingAction label="Listar clouds" icon="list" />
        <FloatingAction label="Gravar áudio" icon="mic" />
        <FloatingAction label="Fechar ações" icon="x" active />
      </div>
    </div>
  );
}
