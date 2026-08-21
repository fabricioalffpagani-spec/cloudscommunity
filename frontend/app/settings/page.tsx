"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HeaderBrand } from "../components/HeaderBrand";
import { SearchModal } from "../components/SearchModal";
import {
  SessionUserAvatar,
  SessionUserLink,
  getSessionUserDisplayName,
  useSessionUser,
} from "../components/session-user";

type Section = "conta" | "perfil" | "privacidade" | "notificacoes" | "acessibilidade" | "seguranca" | "dados" | "sobre";

// ─── Icons ────────────────────────────────────────────────────────────────────
function SearchIcon() { return <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/><path d="M20 20l-3.5-3.5"/></svg>; }
function UploadIcon() { return <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M5 20h14"/></svg>; }
function BellIcon({ s = 20 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 17H5.5a1 1 0 0 1-.92-1.38l1.42-3.42A5 5 0 0 0 6.4 10V9a5.6 5.6 0 0 1 11.2 0v1c0 .69.14 1.38.4 2l1.42 3.42A1 1 0 0 1 18.5 17H15"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>; }
function GearIcon({ s = 20 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>; }
function UserIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>; }
function ShieldIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2l7 4v6c0 4.418-3.134 8.306-7 9-3.866-.694-7-4.582-7-9V6l7-4Z"/></svg>; }
function LockIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>; }
function EyeIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/></svg>; }
function AccessibilityIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="4" r="1"/><path d="m9 9 3-3 3 3"/><path d="m6 12 6-3 6 3"/><path d="M9 21v-6l3-3 3 3v6"/></svg>; }
function DatabaseIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>; }
function InfoIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>; }
function CameraIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z"/><circle cx="12" cy="13" r="3"/></svg>; }
function DownloadIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 4v12"/><path d="m7 14 5 5 5-5"/><path d="M5 20h14"/></svg>; }
function TrashIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>; }
function LogOutIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>; }
function CheckIcon({ s = 14 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>; }
function ChevronRightIcon() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>; }


// ─── Primitives ───────────────────────────────────────────────────────────────
function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-[#A855F7]" : "bg-white/10"}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}
function Field({ label, type="text", value, onChange, placeholder="" }: { label:string; type?:string; value:string; onChange:(v:string)=>void; placeholder?:string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-white">{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl bg-[#1a0e3d] border border-white/[0.08] px-4 py-3 text-[14px] text-[#F9FAFB] placeholder:text-[#6B7280] outline-none focus:border-[#A855F7] transition" />
    </div>
  );
}
function Card({ children, className="" }: { children: React.ReactNode; className?:string }) {
  return <div className={`rounded-2xl border border-white/[0.08] bg-[#120a2e] p-6 ${className}`}>{children}</div>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white">{children}</h3>;
}
function TRow({ label, desc, checked, onChange }: { label:string; desc?:string; checked:boolean; onChange:(v:boolean)=>void }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.06] last:border-0">
      <div><p className="text-[14px] font-medium text-white">{label}</p>{desc && <p className="text-[12px] text-white/60">{desc}</p>}</div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}


// ─── Panels ───────────────────────────────────────────────────────────────────
function PanelConta() {
  const { user, status, refresh } = useSessionUser();
  const [nome, setNome] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!user) return;
    setNome(user.displayName || user.name || "");
  }, [user]);

  const save = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: nome }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Não foi possível salvar.");
      await refresh();
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST", headers: { "Content-Type": "application/json" } });
      if (response.ok) window.location.assign("/login");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-[20px] font-bold text-white">Conta</h2>
      <Card><Sub>Informações</Sub>
        <div className="flex flex-col gap-4">
          <Field label="Nome de exibição" value={nome} onChange={setNome} placeholder="Seu nome" />
          <Field label="Email" type="email" value={user?.email ?? ""} onChange={() => {}} placeholder="—" />
          <p className="text-[11px] text-white/60">O email não pode ser alterado por aqui.</p>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
          <div className="flex justify-end">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#A855F7] px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-[#9333EA] transition disabled:opacity-60">
              {saved ? <><CheckIcon />Salvo!</> : saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </div>
      </Card>
      <Card><Sub>Detalhes</Sub>
        <div className="divide-y divide-white/[0.06]">
          {[
            ["ID da conta", user?.id ?? "—", true],
            ["Membro desde", user?.createdAt ? new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(user.createdAt)) : "—", false],
            ["Clouds criadas", String(user?.cloudsCount ?? 0), false],
            ["Status", user ? "Ativo" : status === "loading" ? "Carregando..." : "Desconectado", false],
          ].map(([k, v, mono]) => (
            <div key={k as string} className="flex items-center justify-between py-2.5">
              <span className="text-[13px] text-white">{k}</span>
              <span className={`text-[13px] ${mono ? "font-mono bg-[#1a0e3d] px-2.5 py-1 rounded-lg text-white/70" : "text-white"}`}>{v}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card><Sub>Sessão</Sub>
        <div className="flex items-center justify-between">
          <div><p className="text-[14px] font-medium text-white">Sair da conta</p><p className="text-[12px] text-white/60">Encerra sua sessão em todos os dispositivos.</p></div>
          <button type="button" onClick={handleLogout} disabled={loggingOut} className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-600/10 px-5 py-2.5 text-[13px] font-semibold text-red-400 hover:bg-red-600/20 transition disabled:cursor-not-allowed disabled:opacity-50">
            <LogOutIcon s={15} /> {loggingOut ? "Saindo..." : "Sair"}
          </button>
        </div>
      </Card>
    </div>
  );
}

const BR_STATES = ["Acre","Alagoas","Amapá","Amazonas","Bahia","Ceará","Distrito Federal","Espírito Santo","Goiás","Maranhão","Mato Grosso","Mato Grosso do Sul","Minas Gerais","Pará","Paraíba","Paraná","Pernambuco","Piauí","Rio de Janeiro","Rio Grande do Norte","Rio Grande do Sul","Rondônia","Roraima","Santa Catarina","São Paulo","Sergipe","Tocantins"];

function PanelPerfil() {
  const { user, refresh } = useSessionUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.displayName || user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [regiao, setRegiao] = useState(user?.location || "");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.avatarUrl ?? null);
  const [error, setError] = useState("");
  const displayName = getSessionUserDisplayName(user);

  useEffect(() => {
    if (!user) {
      return;
    }

    setName(user.displayName || user.name || "");
    setBio(user.bio || "");
    setRegiao(user.location || "");
    setAvatarUrl(user.avatarUrl ?? null);
  }, [user]);

  const save = async () => {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, bio, location: regiao, avatarUrl }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Não foi possível salvar o perfil.");
      await refresh(); setSaved(true); setTimeout(()=>setSaved(false),2000);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o perfil."); }
    finally { setSaving(false); }
  };
  const choosePhoto = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 3_000_000) { setError("Escolha uma imagem de até 3 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setAvatarUrl(typeof reader.result === "string" ? reader.result : null); setError(""); };
    reader.readAsDataURL(file);
  };
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-[20px] font-bold text-white">Perfil</h2>
      <Card>
        <div className="flex flex-col items-center gap-3 mb-6 pb-6 border-b border-white/[0.06]">
          <div className="relative"><SessionUserAvatar user={avatarUrl ? { ...user!, avatarUrl } : user} size={80} className="ring-4 ring-[#9333EA]/40" />
            <button type="button" onClick={() => fileInputRef.current?.click()} aria-label="Alterar foto" className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#A855F7] border-2 border-[#120a2e] text-white hover:bg-[#9333EA]"><CameraIcon s={13}/></button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => void choosePhoto(event.target.files?.[0])} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[13px] text-[#A855F7] hover:text-[#a855f7]">Alterar foto</button>
        </div>
        <div className="flex flex-col gap-4">
          <Field label="Nome de exibição" value={name || displayName} onChange={setName} />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Bio</label>
            <textarea value={bio} onChange={e=>setBio(e.target.value)} rows={3} className="w-full rounded-xl bg-[#1a0e3d] border border-white/[0.08] px-4 py-3 text-[14px] text-white placeholder:text-[#6B7280] outline-none focus:border-[#A855F7] resize-none transition" maxLength={500} />
            <span className="text-right text-[11px] text-white/50">{bio.length}/500</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Região</label>
            <select value={regiao} onChange={e=>setRegiao(e.target.value)} className="w-full rounded-xl bg-[#1a0e3d] border border-white/[0.08] px-4 py-3 text-[14px] text-white outline-none focus:border-[#A855F7]">
              <option value="">Selecione seu estado</option>
              {BR_STATES.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
          <div className="flex justify-end"><button onClick={save} disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-[#A855F7] px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-[#9333EA] transition disabled:opacity-60">{saved?<><CheckIcon/>Salvo!</>:saving?"Salvando...":"Salvar perfil"}</button></div>
        </div>
      </Card>
    </div>
  );
}


function PanelPrivacidade() {
  const { user, refresh } = useSessionUser();
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setIsPrivate(user.isPrivate ?? false);
  }, [user]);

  const handlePrivateToggle = async (value: boolean) => {
    setIsPrivate(value);
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivate: value }),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Erro ao salvar.");
      await refresh();
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setIsPrivate(!value); // revert on error
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-[20px] font-bold text-white">Privacidade</h2>
      <Card>
        <Sub>Visibilidade</Sub>
        <div className="flex items-center justify-between gap-4 py-3 border-b border-white/[0.06]">
          <div>
            <p className="text-[14px] font-medium text-white">Perfil privado</p>
            <p className="text-[12px] text-white/60">Apenas seus seguidores podem ver seu perfil e Clouds privadas.</p>
          </div>
          <Toggle checked={isPrivate} onChange={handlePrivateToggle} />
        </div>
        {saving && <p className="text-[12px] text-white/60 pt-2">Salvando...</p>}
        {saved && <p className="text-[12px] text-[#A855F7] pt-2">Salvo!</p>}
        {error && <p className="text-[12px] text-red-400 pt-2">{error}</p>}
      </Card>
      <Card><Sub>Usuários bloqueados</Sub><div className="flex flex-col items-center py-10 gap-3 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1a0e3d] text-white/40"><ShieldIcon s={22} /></div><p className="text-[14px] font-medium text-white">Nenhum usuário bloqueado</p></div></Card>
    </div>
  );
}

function PanelNotificacoes() {
  const [msg,setMsg]=useState(true);const [men,setMen]=useState(true);const [seg,setSeg]=useState(true);const [cl,setCl]=useState(false);const [em,setEm]=useState(true);const [push,setPush]=useState(true);
  return (<div className="flex flex-col gap-6"><h2 className="text-[20px] font-bold text-white">Notificações</h2>
    <Card><Sub>Atividade</Sub><TRow label="Novas mensagens" checked={msg} onChange={setMsg}/><TRow label="Menções" checked={men} onChange={setMen}/><TRow label="Novos seguidores" checked={seg} onChange={setSeg}/><TRow label="Clouds ativas" checked={cl} onChange={setCl}/></Card>
    <Card><Sub>Canais</Sub><TRow label="Email" checked={em} onChange={setEm}/><TRow label="Push" checked={push} onChange={setPush}/></Card>
  </div>);
}



function PanelAcessibilidade() {
  const [hc,setHc]=useState(false);const [ra,setRa]=useState(false);const [fs,setFs]=useState<"S"|"M"|"L">("M");
  return (<div className="flex flex-col gap-6"><h2 className="text-[20px] font-bold text-white">Acessibilidade</h2>
    <Card><Sub>Exibição</Sub><TRow label="Alto contraste" checked={hc} onChange={setHc}/><TRow label="Reduzir animações" checked={ra} onChange={setRa}/></Card>
    <Card><Sub>Tamanho de fonte</Sub><div className="flex gap-3">{(["S","M","L"] as const).map(s=>(
      <button key={s} onClick={()=>setFs(s)} className={`flex h-10 w-14 items-center justify-center rounded-full text-[13px] font-semibold transition ${fs===s?"bg-[#A855F7] text-white":"bg-[#1a0e3d] border border-white/[0.08] text-white/70 hover:text-white"}`}>{s}</button>
    ))}</div></Card>
  </div>);
}

function PanelSeguranca() {
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");
  const [cf, setCf] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const ok = cur && nw && nw === cf && nw.length >= 8;

  const save = async () => {
    if (!ok) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: nw }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.fieldErrors?.currentPassword ?? data?.message ?? "Não foi possível alterar a senha.");
      setSaved(true); setCur(""); setNw(""); setCf("");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível alterar a senha.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-[20px] font-bold text-white">Segurança</h2>
      <Card><Sub>Alterar senha</Sub>
        <div className="flex flex-col gap-4">
          <Field label="Senha atual" type="password" value={cur} onChange={setCur} placeholder="••••••••" />
          <Field label="Nova senha" type="password" value={nw} onChange={setNw} placeholder="••••••••" />
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Confirmar nova senha</label>
            <input type="password" value={cf} onChange={e => setCf(e.target.value)} placeholder="••••••••"
              className={`w-full rounded-xl bg-[#1a0e3d] border px-4 py-3 text-[14px] text-white placeholder:text-[#6B7280] outline-none transition ${cf && nw !== cf ? "border-red-500/60" : "border-white/[0.08] focus:border-[#A855F7]"}`} />
            {cf && nw !== cf && <span className="text-[12px] text-red-400">As senhas não coincidem.</span>}
          </div>
          {error && <p className="text-[12px] text-red-400">{error}</p>}
          <div className="flex justify-end">
            <button onClick={save} disabled={!ok || saving} className="inline-flex items-center gap-2 rounded-full bg-[#A855F7] px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-[#9333EA] transition disabled:opacity-40 disabled:cursor-not-allowed">
              {saved ? <><CheckIcon />Atualizada!</> : saving ? "Salvando..." : "Atualizar senha"}
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function PanelDados() {
  const [confirm,setConfirm]=useState(false);const [inp,setInp]=useState("");
  return (<div className="flex flex-col gap-6"><h2 className="text-[20px] font-bold text-white">Dados</h2>
    <Card><Sub>Exportar</Sub>
      <div className="flex items-center justify-between">
        <div><p className="text-[14px] font-medium text-white">Exportar meus dados</p><p className="text-[12px] text-white/60">Baixe uma cópia de todas suas informações.</p></div>
        <button className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.05] transition"><DownloadIcon s={15}/>Exportar</button>
      </div>
    </Card>
    <Card className="border-red-500/20"><Sub>Zona de perigo</Sub>
      {!confirm?(<div className="flex items-center justify-between">
        <div><p className="text-[14px] font-medium text-white">Excluir conta</p><p className="text-[12px] text-white/60">Permanente e irreversível.</p></div>
        <button onClick={()=>setConfirm(true)} className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-600/10 px-5 py-2.5 text-[13px] font-semibold text-red-400 hover:bg-red-600/20 transition"><TrashIcon s={15}/>Excluir</button>
      </div>):(<div className="flex flex-col gap-4">
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-300">⚠️ Ação <strong>permanente</strong>. Todos seus dados serão deletados.</div>
        <div><label className="text-[12px] text-white/80">Digite <span className="font-mono text-red-400">excluir minha conta</span> para confirmar:</label>
          <input value={inp} onChange={e=>setInp(e.target.value)} className="mt-2 w-full rounded-xl bg-[#1a0e3d] border border-red-500/30 px-4 py-3 text-[14px] text-white outline-none focus:border-red-500"/>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={()=>{setConfirm(false);setInp("");}} className="rounded-full bg-[#1a0e3d] border border-white/[0.08] px-5 py-2.5 text-[13px] text-white/80 hover:text-white transition">Cancelar</button>
          <button disabled={inp!=="excluir minha conta"} className="inline-flex items-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition"><TrashIcon s={15}/>Confirmar</button>
        </div>
      </div>)}
    </Card>
  </div>);
}

function PanelSobre() {
  return (<div className="flex flex-col gap-6"><h2 className="text-[20px] font-bold text-white">Sobre</h2>
    <Card><div className="flex flex-col items-center gap-4 py-4">
      <Image src="/logo_clouds.png" alt="Clouds Community" width={64} height={64} className="object-contain"/>
      <div className="text-center"><p className="text-[20px] font-bold text-white">Clouds Community</p><p className="text-[13px] text-white/60 mt-1">Versão 1.0.0 · Build 2026.06</p></div>
    </div></Card>
    <Card><Sub>Legal &amp; Suporte</Sub><div className="divide-y divide-white/[0.06]">
      {["Termos de uso","Política de privacidade","Suporte"].map(l=>(
        <a key={l} href="#" className="flex items-center justify-between py-3.5 text-[14px] text-white/80 hover:text-white transition">{l}<ChevronRightIcon/></a>
      ))}
    </div></Card>
    <p className="text-center text-[12px] text-white/50">Feito com ☁️ pela equipe Clouds Community</p>
  </div>);
}


// ─── Header + Page ────────────────────────────────────────────────────────────
const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key:"conta",          label:"Conta",          icon:<UserIcon/> },
  { key:"perfil",         label:"Perfil",          icon:<CameraIcon/> },
  { key:"privacidade",    label:"Privacidade",     icon:<EyeIcon/> },
  { key:"notificacoes",   label:"Notificações",    icon:<BellIcon s={17}/> },
  { key:"acessibilidade", label:"Acessibilidade",  icon:<AccessibilityIcon/> },
  { key:"seguranca",      label:"Segurança",       icon:<LockIcon/> },
  { key:"dados",          label:"Dados",           icon:<DatabaseIcon/> },
  { key:"sobre",          label:"Sobre",           icon:<InfoIcon/> },
];

function Header({ onSearchOpen }: { onSearchOpen: () => void }) {
  const { user } = useSessionUser();
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08]" style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(20,5,40,0.40) 0%, rgba(8,3,20,0.85) 45%, #030208 100%)" }}>
      <div className="mx-auto flex h-[108px] max-w-[1280px] items-center justify-between gap-4 px-3 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-4">
          <HeaderBrand />
        </Link>
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Buscar" onClick={onSearchOpen} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.12] text-white hover:bg-white/[0.20]"><SearchIcon s={28}/></button>
          <button type="button" aria-label="Notificações" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1C1C1F] text-white hover:bg-[#28282C]"><BellIcon s={28}/></button>
          <Link href="/settings" aria-label="Configurações" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#9333EA] text-white hover:bg-[#6D28D9]"><GearIcon s={28}/></Link>
          <Link href="/profile" aria-label="Meu perfil" className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#9333EA] text-[20px] font-bold text-white hover:bg-[#6D28D9]">
            <SessionUserAvatar user={user} size={56} />
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function SettingsPage() {
  const [active, setActive] = useState<Section>("conta");
  const [searchOpen, setSearchOpen] = useState(false);
  const panels: Record<Section, React.ReactNode> = {
    conta:<PanelConta/>, perfil:<PanelPerfil/>, privacidade:<PanelPrivacidade/>,
    notificacoes:<PanelNotificacoes/>, acessibilidade:<PanelAcessibilidade/>,
    seguranca:<PanelSeguranca/>, dados:<PanelDados/>, sobre:<PanelSobre/>
  };
  return (
    <div className="min-h-screen text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <Header onSearchOpen={() => setSearchOpen(true)} />
      <div className="mx-auto flex max-w-[1280px] gap-8 px-5 pb-24 pt-[128px] lg:px-8">
        {/* Sidebar */}
        <aside className="hidden w-[220px] shrink-0 md:flex flex-col gap-1 pt-8">
          <p className="mb-3 px-3 text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Settings</p>
          {NAV_ITEMS.map(({key,label,icon})=>(
            <button key={key} onClick={()=>setActive(key)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition border ${active===key?"bg-[#A855F7]/15 text-[#A855F7] border-[#A855F7]/25":"text-white hover:bg-white/[0.04] border-transparent"}`}>
              <span className={active===key?"text-[#A855F7]":"text-white/70"}>{icon}</span>{label}
            </button>
          ))}
        </aside>
        {/* Mobile pills */}
        <div className="md:hidden w-full -mt-4 mb-6 col-span-full">
          <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
            {NAV_ITEMS.map(({key,label})=>(
              <button key={key} onClick={()=>setActive(key)} className={`shrink-0 rounded-full px-4 py-1.5 text-[13px] font-semibold transition ${active===key?"bg-[#A855F7] text-white":"bg-[#1a0e3d] border border-white/[0.08] text-white/80"}`}>{label}</button>
            ))}
          </div>
        </div>
        <main className="flex-1 min-w-0 pt-8">{panels[active]}</main>
      </div>
    </div>
  );
}







