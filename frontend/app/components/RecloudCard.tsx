import Link from "next/link";
import { useState } from "react";

export type Recloud = {
  id: string; title: string; duration: string; href: string;
  status: "active" | "ended"; scheduledAt: string | null;
  author: { name: string; username: string; avatarUrl: string | null };
};

export function RecloudCard({ cloud, onRemoved }: { cloud: Recloud; onRemoved?: (id: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState("");
  const remove = async () => {
    setRemoving(true);
    setError("");
    try {
      const response = await fetch(`/api/clouds/${encodeURIComponent(cloud.id)}/recloud`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      onRemoved?.(cloud.id);
    } catch {
      setError("Não foi possível desfazer o Recloud. Tente novamente.");
    } finally {
      setRemoving(false);
    }
  };
  const scheduled = cloud.scheduledAt && new Date(cloud.scheduledAt).getTime() > Date.now();
  return <article className="flex min-h-[180px] flex-col rounded-2xl border border-[#8B5CF6]/35 bg-[#1a0e3d]/75 p-4">
    <div className="flex items-start justify-between gap-3">
    <Link href={`/users/${encodeURIComponent(cloud.author.username)}`} className="flex items-center gap-2 text-sm text-white/80">
      <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#7C3AED] font-bold">{cloud.author.avatarUrl ? <img src={cloud.author.avatarUrl} alt="" className="h-full w-full object-cover" /> : cloud.author.name.slice(0, 1).toUpperCase()}</span>
      <span>{cloud.author.name}</span>
    </Link>
    {onRemoved && <div className="relative"><button type="button" aria-label="Opções da Cloud" aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)} className="rounded-full px-2 text-xl text-white/75 hover:bg-white/10">⋮</button>{menuOpen && <div className="absolute right-0 top-8 z-20 w-48 rounded-xl border border-white/10 bg-[#1a0e3d] py-1 shadow-xl"><button type="button" disabled={removing} onClick={() => void remove()} className="w-full px-4 py-2.5 text-left text-[13px] text-white/80 hover:bg-white/10 disabled:opacity-50">{removing ? "Desfazendo..." : "Desfazer Recloud"}</button></div>}</div>}
    </div>
    {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
    <Link href={cloud.href} className="flex flex-1 items-center justify-center py-5 text-center text-[24px] font-semibold text-white">{cloud.title}</Link>
    <p className="text-center text-xs text-white/60">{cloud.status === "ended" ? "Encerrada" : scheduled ? "Agendada" : "Ao vivo"}</p>
  </article>;
}
