"use client";

import { useState } from "react";
import { FlameIcon } from "../../components/FlameIcon";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function FireIcon({ filled }: { filled: boolean }) {
  return <FlameIcon s={26} filled={filled} />;
}

export default function CloudActions() {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(128);
  const [hyped, setHyped] = useState(false);
  const [hypes, setHypes] = useState(47);

  function toggleLike() {
    setLiked((v) => !v);
    setLikes((n) => (liked ? n - 1 : n + 1));
  }

  function toggleHype() {
    setHyped((v) => !v);
    setHypes((n) => (hyped ? n - 1 : n + 1));
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggleLike}
        aria-label={liked ? "Descurtir Cloud" : "Curtir Cloud"}
        className={`inline-flex items-center gap-1.5 rounded-3xl border px-4 py-2.5 text-sm font-semibold transition ${
          liked
            ? "border-[#F43F5E]/40 bg-[#F43F5E]/20 text-[#F43F5E]"
            : "border-white/10 bg-white/5 text-white/70 hover:border-[#F43F5E]/30 hover:bg-[#F43F5E]/10 hover:text-[#F43F5E]"
        }`}
      >
        <HeartIcon filled={liked} />
        <span>{likes}</span>
      </button>

      <button
        onClick={toggleHype}
        aria-label={hyped ? "Remover hype" : "Hypar Cloud"}
        className={`inline-flex items-center gap-1.5 rounded-3xl border px-4 py-2.5 text-sm font-semibold transition ${
          hyped
            ? "border-[#F97316]/40 bg-[#F97316]/20 text-[#F97316]"
            : "border-white/10 bg-white/5 text-white/70 hover:border-[#F97316]/30 hover:bg-[#F97316]/10 hover:text-[#F97316]"
        }`}
      >
        <FireIcon filled={hyped} />
        <span>Hype · {hypes}</span>
      </button>
    </div>
  );
}
