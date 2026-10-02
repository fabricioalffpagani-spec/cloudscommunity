"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { HeaderBrand } from "../components/HeaderBrand";
import { SearchModal } from "../components/SearchModal";
import { NotificationsBell } from "../components/NotificationsPanel";
import {
  SessionUserAvatar,
  SessionUserLink,
  getSessionUserDisplayName,
  useSessionUser,
} from "../components/session-user";
import { MobileAppNav } from "../components/MobileAppChrome";

type Section = "conta" | "perfil" | "privacidade" | "notificacoes" | "aplicativo" | "acessibilidade" | "seguranca" | "dados" | "sobre";

// ─── Icons ────────────────────────────────────────────────────────────────────
function SearchIcon({ s = 20 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7.5"/><path d="M20 20l-3.5-3.5"/></svg>; }
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
function DeviceIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M10 18h4"/></svg>; }
function TrashIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>; }
function LogOutIcon({ s = 17 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>; }
function CheckIcon({ s = 14 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 13 4 4L19 7"/></svg>; }
function ChevronRightIcon() { return <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>; }
function SendIcon({ s = 16 }: { s?: number }) { return <svg viewBox="0 0 24 24" width={s} height={s} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>; }


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
  return <div className={`rounded-2xl border border-white/[0.08] bg-[#120a2e] p-4 sm:p-6 ${className}`}>{children}</div>;
}
function Sub({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-white">{children}</h3>;
}
function TRow({ label, desc, checked, onChange }: { label:string; desc?:string; checked:boolean; onChange:(v:boolean)=>void }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] py-3 sm:items-center sm:gap-4 last:border-0">
      <div className="min-w-0"><p className="text-[14px] font-medium text-white">{label}</p>{desc && <p className="text-[12px] text-white/60">{desc}</p>}</div>
      <span className="mt-0.5 shrink-0 sm:mt-0"><Toggle checked={checked} onChange={onChange} /></span>
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
      if (response.ok) {
        window.localStorage.removeItem("clouds:minimized-cloud");
        window.dispatchEvent(new Event("clouds:minimized-cloud-changed"));
        window.location.assign("/login");
      }
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

const COUNTRIES = [
  ["Brasil", "🇧🇷"], ["Argentina", "🇦🇷"], ["Chile", "🇨🇱"], ["Colômbia", "🇨🇴"], ["México", "🇲🇽"], ["Peru", "🇵🇪"], ["Uruguai", "🇺🇾"], ["Venezuela", "🇻🇪"],
  ["Estados Unidos", "🇺🇸"], ["Canadá", "🇨🇦"], ["Portugal", "🇵🇹"], ["Espanha", "🇪🇸"], ["França", "🇫🇷"], ["Itália", "🇮🇹"], ["Alemanha", "🇩🇪"], ["Reino Unido", "🇬🇧"],
  ["Irlanda", "🇮🇪"], ["Países Baixos", "🇳🇱"], ["Suíça", "🇨🇭"], ["Suécia", "🇸🇪"], ["Noruega", "🇳🇴"], ["Dinamarca", "🇩🇰"], ["Finlândia", "🇫🇮"], ["Grécia", "🇬🇷"],
  ["Austrália", "🇦🇺"], ["Nova Zelândia", "🇳🇿"], ["China", "🇨🇳"], ["Japão", "🇯🇵"], ["Coreia do Sul", "🇰🇷"], ["Índia", "🇮🇳"], ["Indonésia", "🇮🇩"], ["Israel", "🇮🇱"],
  ["África do Sul", "🇿🇦"], ["Egito", "🇪🇬"], ["Marrocos", "🇲🇦"], ["Nigéria", "🇳🇬"], ["Angola", "🇦🇴"], ["Moçambique", "🇲🇿"], ["Outro país", "🌍"],
] as const;

function getCountry(value: string) {
  return COUNTRIES.find(([name]) => name === value) ?? null;
}

const COUNTRY_CODES: Record<string, string> = {
  Brasil: "br", Argentina: "ar", Chile: "cl", Colômbia: "co", México: "mx", Peru: "pe", Uruguai: "uy", Venezuela: "ve",
  "Estados Unidos": "us", Canadá: "ca", Portugal: "pt", Espanha: "es", França: "fr", Itália: "it", Alemanha: "de", "Reino Unido": "gb",
  Irlanda: "ie", "Países Baixos": "nl", Suíça: "ch", Suécia: "se", Noruega: "no", Dinamarca: "dk", Finlândia: "fi", Grécia: "gr",
  Austrália: "au", "Nova Zelândia": "nz", China: "cn", Japão: "jp", "Coreia do Sul": "kr", Índia: "in", Indonésia: "id", Israel: "il",
  "África do Sul": "za", Egito: "eg", Marrocos: "ma", Nigéria: "ng", Angola: "ao", Moçambique: "mz",
};

function CountryFlag({ country, fallback }: { country: string; fallback: string }) {
  const code = COUNTRY_CODES[country];

  return code ? (
    <span
      className="h-6 w-6 shrink-0 rounded-full bg-cover bg-center bg-no-repeat shadow-sm ring-1 ring-white/10"
      style={{ backgroundImage: `url(https://flagcdn.com/w80/${code}.png)` }}
      role="img"
      aria-label={`Bandeira de ${country}`}
    />
  ) : (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[16px] leading-none" aria-hidden="true">{fallback}</span>
  );
}

function normalizeCountry(value: string | null | undefined) {
  if (!value) return "";
  const country = value.split(",")[0]?.trim() || "";
  return BR_STATES.includes(country) ? "Brasil" : country;
}

function locationCity(value: string | null | undefined) {
  return value?.split(",").slice(1).join(",").trim() || "";
}

function PanelPerfil() {
  const { user, refresh } = useSessionUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user?.displayName || user?.name || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [pais, setPais] = useState(normalizeCountry(user?.location));
  const [cidade, setCidade] = useState(locationCity(user?.location));
  const [countryMenuOpen, setCountryMenuOpen] = useState(false);
  const [locating, setLocating] = useState(false);
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
    setPais(normalizeCountry(user.location));
    setCidade(locationCity(user.location));
    setAvatarUrl(user.avatarUrl ?? null);
  }, [user]);

  const save = async () => {
    if ((pais && !cidade.trim()) || (!pais && cidade.trim())) {
      setError("Informe país e cidade para salvar a região.");
      return;
    }
    setSaving(true); setError("");
    try {
      const location = pais && cidade.trim() ? `${pais}, ${cidade.trim()}` : "";
      const response = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: name, bio, location, avatarUrl }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Não foi possível salvar o perfil.");
      await refresh(); setSaved(true); setTimeout(()=>setSaved(false),2000);
    } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível salvar o perfil."); }
    finally { setSaving(false); }
  };
  const choosePhoto = async (file?: File) => {
    if (!file) return;
    // Base64 expands the original image before it is persisted. Keep the
    // source below the server's 4 MB payload ceiling so a valid selection
    // cannot fail only when the user saves the profile.
    if (!file.type.startsWith("image/") || file.size > 2_800_000) { setError("Escolha uma imagem de até 2,8 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => { setAvatarUrl(typeof reader.result === "string" ? reader.result : null); setError(""); };
    reader.readAsDataURL(file);
  };
  const useDeviceLocation = async () => {
    if (!navigator.geolocation) { setError("A localização não é suportada neste dispositivo."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}&zoom=10&addressdetails=1`);
        const payload = await response.json() as { address?: { country?: string; city?: string; town?: string; village?: string; municipality?: string } };
        const address = payload.address;
        const city = address?.city ?? address?.town ?? address?.village ?? address?.municipality;
        if (!address?.country || !city) throw new Error("Não foi possível identificar cidade e país.");
        setPais(address.country); setCidade(city);
      } catch (locationError) { setError(locationError instanceof Error ? locationError.message : "Não foi possível identificar sua localização."); }
      finally { setLocating(false); }
    }, (positionError) => { setError(positionError.code === positionError.PERMISSION_DENIED ? "Permita a localização para definir sua cidade." : "Não foi possível obter sua localização."); setLocating(false); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
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
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">País</label>
            <div className="relative">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={countryMenuOpen}
                onClick={() => setCountryMenuOpen((open) => !open)}
                className="flex w-full items-center justify-between rounded-xl border border-white/[0.08] bg-[#1a0e3d] px-4 py-3 text-left text-[14px] text-white outline-none transition hover:border-white/20 focus:border-[#A855F7]"
              >
                <span className="flex items-center gap-3">
                  {getCountry(pais) ? (
                    <CountryFlag country={pais} fallback={getCountry(pais)?.[1] ?? "🌍"} />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/[0.08] text-white/35" aria-hidden="true">🌍</span>
                  )}
                  <span className={pais ? "text-white" : "text-white/40"}>{pais || "Selecione seu país"}</span>
                </span>
                <ChevronRightIcon />
              </button>
              {countryMenuOpen && (
                <div role="listbox" aria-label="País" className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-64 overflow-y-auto rounded-xl border border-white/[0.1] bg-[#1a0e3d] p-1 shadow-2xl shadow-black/40">
                  <button type="button" role="option" aria-selected={!pais} onClick={() => { setPais(""); setCountryMenuOpen(false); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] text-white/50 transition hover:bg-white/[0.08]">Selecione seu país</button>
                  {COUNTRIES.map(([countryName, flag]) => (
                    <button key={countryName} type="button" role="option" aria-selected={pais === countryName} onClick={() => { setPais(countryName); setCountryMenuOpen(false); }} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] transition hover:bg-white/[0.08] ${pais === countryName ? "bg-[#A855F7]/15 text-white" : "text-white/75"}`}>
                      <CountryFlag country={countryName} fallback={flag} />
                      {countryName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Localização</label>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#1a0e3d] px-4 py-3 text-[14px] text-white">
              <span className={pais && cidade ? "truncate" : "text-white/40"}>{pais && cidade ? `${pais}, ${cidade}` : "Use a localização do dispositivo"}</span>
              <button type="button" onClick={() => void useDeviceLocation()} disabled={locating} className="shrink-0 rounded-full bg-[#9333EA] px-3 py-1.5 text-[12px] font-semibold disabled:opacity-60">{locating ? "Localizando…" : "Usar localização"}</button>
            </div>
            <span className="text-[11px] text-white/50">A cidade é definida pela localização nativa do dispositivo.</span>
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
  const [showHypesCount, setShowHypesCount] = useState(true);
  const [showArchivedClouds, setShowArchivedClouds] = useState(true);
  const [showParticipatingNow, setShowParticipatingNow] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    setIsPrivate(user.isPrivate ?? false);
    setShowHypesCount(user.showHypesCount ?? true);
    setShowArchivedClouds(user.showArchivedClouds ?? true);
    setShowParticipatingNow(user.showParticipatingNow ?? true);
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

  const handleHypesVisibilityToggle = async (value: boolean) => {
    setShowHypesCount(value); setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showHypesCount: value }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Erro ao salvar.");
      await refresh(); setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) { setShowHypesCount(!value); setError(err instanceof Error ? err.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  };

  const handleArchivedCloudsVisibilityToggle = async (value: boolean) => {
    setShowArchivedClouds(value); setSaving(true); setError("");
    try {
      const response = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showArchivedClouds: value }) });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Erro ao salvar.");
      await refresh(); setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch (err) { setShowArchivedClouds(!value); setError(err instanceof Error ? err.message : "Erro ao salvar."); }
    finally { setSaving(false); }
  };
  const handleParticipatingNowVisibilityToggle = async (value: boolean) => {
    setShowParticipatingNow(value); setSaving(true); setError("");
    try { const response = await fetch("/api/auth/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showParticipatingNow: value }) }); if (!response.ok) throw new Error((await response.json().catch(() => null))?.message ?? "Erro ao salvar."); await refresh(); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (err) { setShowParticipatingNow(!value); setError(err instanceof Error ? err.message : "Erro ao salvar."); } finally { setSaving(false); }
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
        <div className="flex items-center justify-between gap-4 py-3">
          <div><p className="text-[14px] font-medium text-white">Mostrar total de hypes</p><p className="text-[12px] text-white/60">Você continuará vendo o total; visitantes não verão o número nem a lista de hypes.</p></div>
          <Toggle checked={showHypesCount} onChange={handleHypesVisibilityToggle} />
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] py-3">
          <div><p className="text-[14px] font-medium text-white">Mostrar Clouds encerradas no perfil</p><p className="text-[12px] text-white/60">Você continuará vendo suas Clouds; visitantes deixam de vê-las no seu perfil.</p></div>
          <Toggle checked={showArchivedClouds} onChange={handleArchivedCloudsVisibilityToggle} />
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-white/[0.06] py-3">
          <div><p className="text-[14px] font-medium text-white">Mostrar “Participando agora”</p><p className="text-[12px] text-white/60">Exibe no seu perfil a Cloud ao vivo em que você está participando.</p></div>
          <Toggle checked={showParticipatingNow} onChange={handleParticipatingNowVisibilityToggle} />
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

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function PanelAplicativo() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [canInstall, setCanInstall] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showRemovalInstructions, setShowRemovalInstructions] = useState(false);

  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(isStandalone);
    setCanInstall(window.isSecureContext || window.location.hostname === "localhost");
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => { setInstalled(true); setInstallPrompt(null); };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installPrompt) {
      setShowInstructions(true);
      return;
    }
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") setInstalled(true);
    setInstallPrompt(null);
  };

  const isIos = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
  return <div className="flex flex-col gap-6"><h2 className="text-[20px] font-bold text-white">Aplicativo</h2>
    <Card><Sub>Clouds no seu dispositivo</Sub>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[14px] font-medium text-white">Instalar Clouds</p><p className="mt-1 text-[12px] leading-5 text-white/60">Crie um atalho com ícone na tela inicial ou área de trabalho e abra o Clouds como aplicativo.</p></div>
        {installed ? <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#9333EA]/20 px-4 py-2.5 text-[13px] font-semibold text-[#E9D5FF]"><CheckIcon />Instalado</span> : <button type="button" onClick={install} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#9333EA] px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#7C3AED]"><DeviceIcon s={16} />Adicionar atalho para o Clouds</button>}
      </div>
      {!installed && (isIos || showInstructions) && <p className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[12px] leading-5 text-white/65">{isIos ? "No iPhone ou iPad, abra no Safari, toque em Compartilhar e escolha “Adicionar à Tela de Início”." : canInstall ? "No menu do navegador, escolha “Instalar aplicativo” ou “Adicionar à área de trabalho”." : "O atalho será instalado automaticamente quando o Clouds estiver publicado em HTTPS. Enquanto isso, você pode usar o menu do navegador para criar um atalho."}</p>}
    </Card>
    <Card className="border-red-500/20"><Sub>Remover do dispositivo</Sub>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-[14px] font-medium text-white">Remover atalho do Clouds</p><p className="mt-1 text-[12px] leading-5 text-white/60">Remove apenas o ícone e o acesso rápido deste dispositivo; sua conta e seus dados não serão apagados.</p></div>
        <button type="button" onClick={() => setShowRemovalInstructions((open) => !open)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-red-400/40 bg-red-500/10 px-5 py-2.5 text-[13px] font-semibold text-red-200 transition hover:bg-red-500/20"><TrashIcon s={15} />Remover atalho</button>
      </div>
      {showRemovalInstructions && <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/[0.06] px-3 py-2.5 text-[12px] leading-5 text-white/70">{isIos ? "Na Tela de Início, mantenha pressionado o ícone do Clouds e toque em “Remover App”." : "Abra o Clouds instalado, use o menu de três pontos da janela e escolha “Desinstalar Clouds”. No Android, mantenha o ícone pressionado e toque em “Desinstalar” ou “Remover”."}</p>}
    </Card>
  </div>;
}



function PanelAcessibilidade() {
  const [preferences] = useState(() => {
    if (typeof window === "undefined") return { highContrast: false, reduceMotion: false, fontSize: "M" as const };
    try {
      const saved = window.localStorage.getItem("clouds-accessibility");
      const parsed = saved ? JSON.parse(saved) as { highContrast?: boolean; reduceMotion?: boolean; fontSize?: "S" | "M" | "L" } : {};
      return { highContrast: Boolean(parsed.highContrast), reduceMotion: Boolean(parsed.reduceMotion), fontSize: parsed.fontSize && ["S", "M", "L"].includes(parsed.fontSize) ? parsed.fontSize : "M" as const };
    } catch {
      return { highContrast: false, reduceMotion: false, fontSize: "M" as const };
    }
  });
  const [hc,setHc]=useState(preferences.highContrast);const [ra,setRa]=useState(preferences.reduceMotion);const [fs,setFs]=useState<"S"|"M"|"L">(preferences.fontSize);
  useEffect(() => {
    window.localStorage.setItem("clouds-accessibility", JSON.stringify({ highContrast: hc, reduceMotion: ra, fontSize: fs }));
    window.dispatchEvent(new Event("clouds-accessibility-change"));
  }, [hc, ra, fs]);
  return (<div className="flex flex-col gap-6"><h2 className="text-[20px] font-bold text-white">Acessibilidade</h2>
    <Card><Sub>Exibição</Sub><TRow label="Alto contraste" desc="Aumenta a diferença entre texto e fundo." checked={hc} onChange={setHc}/><TRow label="Reduzir animações" desc="Desativa transições e animações decorativas." checked={ra} onChange={setRa}/></Card>
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
  const { user } = useSessionUser();
  const [confirm,setConfirm]=useState(false);const [inp,setInp]=useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const exportData = () => {
    if (!user || exporting) return;
    setExporting(true);
    setExportError("");
    try {
    const lines = [
      "CLOUDS COMMUNITY - DADOS DA CONTA",
      "",
      `Nome: ${user.displayName || user.name || "-"}`,
      `Nome de usuário: ${user.username || "-"}`,
      `E-mail: ${user.email || "-"}`,
      `ID da conta: ${user.id}`,
      `Data de nascimento: ${user.birthDate || "-"}`,
      `Biografia: ${user.bio || "-"}`,
      `Localização: ${user.location || "-"}`,
      `Website: ${user.website || "-"}`,
      `Perfil privado: ${user.isPrivate ? "Sim" : "Não"}`,
      `Status: ${user.status || "-"}`,
      `Membro desde: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString("pt-BR") : "-"}`,
      `Clouds criadas: ${user.cloudsCount ?? 0}`,
      `Seguidores: ${user.followersCount ?? 0}`,
      `Seguindo: ${user.followingCount ?? 0}`,
    ];
    // This lightweight PDF writer uses Helvetica's WinAnsi-safe subset. Keeping
    // stream data ASCII also makes the byte offsets in the xref table reliable.
    const escapePdfText = (value: string) => value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\x20-\x7E]/g, "?")
      .replace(/\\/g, "\\\\")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)");
    const content = ["BT", "/F1 16 Tf", "50 790 Td", `(${escapePdfText(lines[0])}) Tj`, "/F1 10 Tf", ...lines.slice(1).map((line) => `0 -20 Td (${escapePdfText(line)}) Tj`), "ET"].join("\\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
      `<< /Length ${content.length} >>\\nstream\\n${content}\\nendstream`,
    ];
    let pdf = "%PDF-1.4\\n";
    const offsets = [0];
    objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\\n${object}\\nendobj\\n`; });
    const xref = pdf.length;
    pdf += `xref\\n0 ${objects.length + 1}\\n0000000000 65535 f \\n`;
    offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \\n`; });
    pdf += `trailer\\n<< /Size ${objects.length + 1} /Root 1 0 R >>\\nstartxref\\n${xref}\\n%%EOF`;
    const link = document.createElement("a");
    const objectUrl = URL.createObjectURL(new Blob([pdf], { type: "application/pdf" }));
    link.href = objectUrl;
    link.download = "clouds-community-dados-da-conta.pdf";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch {
      setExportError("Não foi possível gerar o PDF. Tente novamente.");
    } finally {
      setExporting(false);
    }
  };
  return (<div className="flex flex-col gap-6"><h2 className="text-[20px] font-bold text-white">Dados</h2>
    <Card><Sub>Exportar</Sub>
      <div className="flex items-center justify-between">
        <div><p className="text-[14px] font-medium text-white">Exportar meus dados</p><p className="text-[12px] text-white/60">Baixe uma cópia de todas suas informações.</p></div>
        <button onClick={exportData} disabled={!user || exporting} className="inline-flex items-center gap-2 rounded-full border border-white/[0.15] px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.05] transition disabled:cursor-not-allowed disabled:opacity-50"><DownloadIcon s={15}/>{exporting ? "Gerando..." : "Exportar PDF"}</button>
      </div>
      {exportError && <p role="alert" className="mt-3 text-[12px] text-red-300">{exportError}</p>}
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
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const sendFeedback = async () => {
    const trimmedMessage = message.trim();
    if (trimmedMessage.length < 10) {
      setFeedbackStatus({ type: "error", text: "Escreva uma mensagem com pelo menos 10 caracteres." });
      return;
    }

    setSending(true);
    setFeedbackStatus(null);
    try {
      const response = await fetch("/api/auth/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: trimmedMessage }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Não foi possível enviar sua mensagem agora.");
      setMessage("");
      setFeedbackStatus({ type: "success", text: "Mensagem enviada. Obrigado por ajudar a melhorar o Clouds!" });
    } catch (error) {
      setFeedbackStatus({ type: "error", text: error instanceof Error ? error.message : "Não foi possível enviar sua mensagem agora." });
    } finally {
      setSending(false);
    }
  };

  return (<div className="flex flex-col gap-6"><h2 className="text-[20px] font-bold text-white">Sobre</h2>
    <Card><div className="flex flex-col items-center gap-4 py-4">
      <Image src="/logo_clouds.png" alt="Clouds Community" width={64} height={64} className="object-contain"/>
      <div className="text-center"><p className="text-[20px] font-bold text-white">Clouds Community</p><p className="mt-1 text-[12px] text-white/75">Uma produção de Fabrício A. Pagani e Vicente L. Seganfredo</p><p className="text-[13px] text-white/60 mt-1">Versão 1.0.0 · Build 2026.06</p></div>
    </div></Card>
    <Card><Sub>Legal</Sub><div className="divide-y divide-white/[0.06]">
      {[
        { label: "Termos de Uso",                    href: "/legal/termos-de-uso.pdf" },
        { label: "Política de Privacidade",          href: "/legal/politica-de-privacidade.pdf" },
        { label: "Política de Cookies",              href: "/legal/politica-de-cookies.pdf" },
        { label: "Política de Denúncia e Moderação", href: "/legal/politica-de-denuncia-e-moderacao.pdf" },
        { label: "Regras da Comunidade",             href: "/legal/regras-da-comunidade.pdf" },
      ].map(({ label, href }) => (
        <a key={label} href={href} target="_blank" rel="noreferrer" className="flex items-center justify-between py-3.5 text-[14px] text-white/80 hover:text-white transition">{label}<ChevronRightIcon/></a>
      ))}
    </div></Card>
    <Card><Sub>Sugestões e suporte</Sub><p className="text-[13px] leading-6 text-white/70">Envie sugestões, melhorias, atualizações ou reclamações sobre o site e a plataforma.</p>
      <div className="mt-4">
        <label htmlFor="feedback-message" className="sr-only">Sua sugestão ou reclamação</label>
        <textarea id="feedback-message" value={message} onChange={event => setMessage(event.target.value)} maxLength={4000} placeholder="Escreva sua sugestão ou reclamação..." className="min-h-28 w-full resize-y rounded-xl border border-white/[0.08] bg-[#1a0e3d] px-4 py-3 text-[14px] text-white outline-none transition placeholder:text-[#6B7280] focus:border-[#A855F7]" />
        <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[12px] text-white/45">{message.length}/4000</span><button type="button" onClick={sendFeedback} disabled={sending || !message.trim()} className="inline-flex items-center gap-2 rounded-full bg-[#9333EA] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#A855F7] disabled:cursor-not-allowed disabled:opacity-50"><SendIcon/>{sending ? "Enviando..." : "Enviar sugestão"}</button></div>
        {feedbackStatus && <p className={`mt-3 text-[13px] ${feedbackStatus.type === "success" ? "text-emerald-400" : "text-red-400"}`}>{feedbackStatus.text}</p>}
      </div>
      </Card>
    <p className="text-center text-[12px] text-white/50">Feito com ☁️ pela equipe Clouds Community</p>
  </div>);
}


// ─── Header + Page ────────────────────────────────────────────────────────────
const NAV_ITEMS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key:"conta",          label:"Conta",          icon:<UserIcon/> },
  { key:"perfil",         label:"Perfil",          icon:<CameraIcon/> },
  { key:"privacidade",    label:"Privacidade",     icon:<EyeIcon/> },
  { key:"notificacoes",   label:"Notificações",    icon:<BellIcon s={17}/> },
  { key:"aplicativo",     label:"Aplicativo",      icon:<DeviceIcon/> },
  { key:"acessibilidade", label:"Acessibilidade",  icon:<AccessibilityIcon/> },
  { key:"seguranca",      label:"Segurança",       icon:<LockIcon/> },
  { key:"dados",          label:"Dados",           icon:<DatabaseIcon/> },
  { key:"sobre",          label:"Sobre",           icon:<InfoIcon/> },
];

function Header({ onSearchOpen }: { onSearchOpen: () => void }) {
  const { user } = useSessionUser();
  return (
    <header className="relative z-50 hidden shrink-0 bg-transparent md:block">
      <div className="mx-auto flex h-[100px] max-w-[1280px] items-end justify-between gap-4 px-3 pb-4 lg:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-4">
          <HeaderBrand />
        </Link>
        <div className="flex items-center gap-4">
          <button type="button" aria-label="Buscar" onClick={onSearchOpen} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.12] text-white hover:bg-white/[0.20]"><SearchIcon s={28}/></button>
          <NotificationsBell buttonClassName="flex h-14 w-14 items-center justify-center rounded-full bg-[#1C1C1F] text-white hover:bg-[#28282C]" />
          <Link href="/profile" aria-label="Meu perfil" className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-white/[0.08] bg-[#9333EA] text-[20px] font-bold text-white hover:bg-[#6D28D9]">
            <SessionUserAvatar user={user} size={56} />
          </Link>
          <Link href="/settings" aria-label="Configurações" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#9333EA] text-white hover:bg-[#6D28D9]"><GearIcon s={28}/></Link>
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
    notificacoes:<PanelNotificacoes/>, aplicativo:<PanelAplicativo/>, acessibilidade:<PanelAcessibilidade/>,
    seguranca:<PanelSeguranca/>, dados:<PanelDados/>, sobre:<PanelSobre/>
  };
  return (
    <div className="flex h-[100dvh] min-h-screen flex-col overflow-hidden text-white"
      style={{ background: "radial-gradient(ellipse at 50% 30%, rgba(40,10,120,0.60) 0%, rgba(12,4,40,0.98) 45%, #030208 100%)" }}>
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <Header onSearchOpen={() => setSearchOpen(true)} />
      <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-white/[0.08] px-5 md:hidden">
        <Link href="/profile" className="text-[14px] font-semibold text-white/65">‹ Perfil</Link>
        <h1 className="text-[17px] font-bold text-white">Configurações</h1>
        <button type="button" aria-label="Buscar" onClick={() => setSearchOpen(true)} className="text-white"><SearchIcon s={23}/></button>
      </header>
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 flex-col overflow-y-auto px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-0 md:flex-row md:gap-8 md:px-5 md:pb-24 md:pt-4 lg:px-8">
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
        <div className="order-1 -mx-4 border-b border-white/[0.08] bg-[#09031d]/95 px-4 py-3 backdrop-blur-md md:hidden">
          <div className="grid grid-cols-2 gap-2">
            {NAV_ITEMS.map(({key,label,icon})=>(
              <button key={key} type="button" onClick={()=>setActive(key)} aria-pressed={active===key} className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-semibold transition ${active===key?"bg-[#A855F7] text-white shadow-[0_4px_14px_rgba(168,85,247,.28)]":"border border-white/[0.08] bg-[#1a0e3d] text-white/80 active:bg-white/[0.10]"}`}>
                <span className="shrink-0">{icon}</span>{label}
              </button>
            ))}
          </div>
        </div>
        <main className="order-2 min-w-0 w-full flex-1 py-5 md:w-auto md:pt-8">{panels[active]}</main>
      </div>
      <MobileAppNav active="profile" />
    </div>
  );
}







