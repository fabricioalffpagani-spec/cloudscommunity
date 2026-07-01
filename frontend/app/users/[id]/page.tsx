"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

function Avatar({ initials, size = 80, color = "#3B82F6" }: { initials: string; size?: number; color?: string }) {
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold" style={{ width: size, height: size, backgroundColor: color, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

type User = {
  id: string;
  name: string;
  bio: string;
  color: string;
  followers: number;
  following: number;
  hypes: number;
};

export default function UserProfile() {
  const params = useParams();
  let raw = params?.id ?? "unknown";
  const id = Array.isArray(raw) ? raw[0] : raw;

  // mocked user store
  const seeded: Record<string, User> = {
    joao: { id: "joao", name: "João Silva", bio: "Apaixonado por clouds e meetups.", color: "#8B5CF6", followers: 240, following: 80, hypes: 120 },
    ana: { id: "ana", name: "Ana Costa", bio: "Criadora de conteúdo áudio.", color: "#3B82F6", followers: 180, following: 40, hypes: 90 },
    pedro: { id: "pedro", name: "Pedro Lima", bio: "Designer e curioso.", color: "#22C55E", followers: 90, following: 120, hypes: 20 },
  } as Record<string, any>;
  const [user, setUser] = useState<User>(seeded[id] ?? { id, name: id, bio: "", color: "#6B7280", followers: 0, following: 0, hypes: 0 });
  const [hypped, setHypped] = useState(false);

  useEffect(() => {
    setUser(seeded[id] ?? { id, name: id, bio: "", color: "#6B7280", followers: 0, following: 0, hypes: 0 });
    setHypped(false);
  }, [id]);

  function doHypar() {
    if (hypped) return;
    setHypped(true);
    setUser((u: User) => ({ ...u, hypes: u.hypes + 1 }));
    // In a real app, call API to record hype and influence Meet ranking.
  }

  return (
    <div className="min-h-screen bg-[#09090B] text-white p-6">
      <div className="mx-auto max-w-[900px] rounded-2xl bg-[#0D0D10] border border-white/[0.04] p-8">
        <div className="flex items-center gap-6">
          <Avatar initials={user.name.slice(0,2).toUpperCase()} color={user.color} />
          <div className="flex-1">
            <h1 className="text-[22px] font-extrabold">{user.name}</h1>
            <p className="mt-2 text-white/60 max-w-[680px]">{user.bio}</p>
            <div className="mt-4 flex items-center gap-6 text-[13px] text-white/60">
              <div><strong className="text-white">{user.followers}</strong> seguidores</div>
              <div><strong className="text-white">{user.following}</strong> seguindo</div>
              <div><strong className="text-white">{user.hypes}</strong> hypes</div>
            </div>
          </div>
          <div>
            <button onClick={doHypar} disabled={hypped}
              className={`rounded-full px-4 py-2 font-semibold ${hypped ? 'bg-white/6 text-white/50' : 'bg-[#FF5C3C] text-white'}`}>
              {hypped ? 'Hyparado' : 'Hypar'}
            </button>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-[16px] font-bold mb-2">Hypes recebidos</h2>
          <p className="text-white/50">Total de hypes: <strong className="text-white">{user.hypes}</strong></p>
        </div>
      </div>

      <div className="mt-6 max-w-[900px] mx-auto text-white/60">
        <Link href="/meet" className="underline">Voltar para Meet</Link>
      </div>
    </div>
  );
}
