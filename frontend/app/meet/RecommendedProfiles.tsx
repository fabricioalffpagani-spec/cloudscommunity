"use client";

import Link from "next/link";
import { useRef } from "react";

type RankUser = {
  id: string;
  name: string;
  description: string;
  followersInCommon: string;
  initial: string;
  avatarSize: string;
  highlight?: boolean;
};

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

function ProfileCard({ user }: { user: RankUser }) {
  return (
    <article className="min-w-[260px] flex-shrink-0 rounded-[22px] border border-white/10 bg-[#111827] p-4 shadow-[0_18px_48px_rgba(0,0,0,0.22)]">
      <div className="flex items-center gap-3">
        <Link href={`/users/${user.id}`} className="shrink-0">
          <Avatar initial={user.initial} size="h-16 w-16" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-semibold text-white">{user.name}</h3>
            {user.highlight && (
              <span className="rounded-full bg-[#7C3AED]/20 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-[#C084FC]">
                Top
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] text-white/60">{user.description}</p>
        </div>
      </div>

      <div className="mt-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-3 py-3 text-xs text-white/75">
          <div className="font-semibold text-white">{user.followersInCommon}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-white/40">Seguidores em comum</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-full border border-white/10 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-white/5"
        >
          Ver perfil
        </button>
        <button
          type="button"
          className="inline-flex h-10 items-center rounded-full bg-[#9333EA] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[#7C3AED]"
        >
          Seguir
        </button>
      </div>
    </article>
  );
}

function ArrowButton({ direction, onClick }: { direction: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? "Voltar" : "Avançar"}
      className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-[#111827]/90 text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C084FC]"
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  );
}

export default function RecommendedProfiles({ profiles }: { profiles: RankUser[] }) {
  const carouselRef = useRef<HTMLDivElement>(null);

  const scroll = (offset: number) => {
    if (!carouselRef.current) return;
    carouselRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#120B1F]/80 p-5 shadow-[0_25px_80px_rgba(0,0,0,0.35)]">
      <div className="absolute left-0 top-0 z-20 h-full w-24 lg:block opacity-0 transition-opacity duration-200 hover:opacity-100">
        <div className="flex h-full items-center justify-center">
          <ArrowButton direction="left" onClick={() => scroll(-340)} />
        </div>
      </div>
      <div className="absolute right-0 top-0 z-20 h-full w-24 lg:block opacity-0 transition-opacity duration-200 hover:opacity-100">
        <div className="flex h-full items-center justify-center">
          <ArrowButton direction="right" onClick={() => scroll(340)} />
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[13px] font-semibold uppercase tracking-[0.34em] text-[#F59E0B]">Lista horizontal</div>
          <h2 className="mt-3 text-[28px] font-semibold text-white">Escolha quem seguir</h2>
        </div>
        <p className="max-w-[520px] text-[14px] text-white/65">
          Use as setas para navegar e encontrar perfis com conexões em comum.
        </p>
      </div>

      <div
        ref={carouselRef}
        className="mt-6 flex gap-4 overflow-x-auto pb-4 pr-4 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {profiles.map((user) => (
          <ProfileCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}
