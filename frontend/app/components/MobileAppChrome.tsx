"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SessionUserAvatar, useSessionUser } from "./session-user";

type FeedTab = "for-you" | "following" | "meet";

function SearchIcon() {
  return <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7.5" /><path d="m20 20-3.5-3.5" /></svg>;
}

function HomeIcon() {
  return <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>;
}

function MessageIcon() {
  return <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}

function FlameIcon() {
  return <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c4.1 0 7-2.8 7-6.7 0-3.1-1.8-5.1-4.1-7.6.1 2-1 3.8-2.9 4.8.3-3.1-1.2-5.8-3.7-8.3C7.6 7.5 5 10.4 5 14.5 5 18.8 8 22 12 22Z" /></svg>;
}

export function MobileFeedHeader(props: Parameters<typeof MobileFeedHeaderContent>[0]) {
  return <Suspense fallback={null}><MobileFeedHeaderContent {...props} /></Suspense>;
}

function MobileFeedHeaderContent({ active, onSearch }: { active: FeedTab; onSearch?: () => void }) {
  const searchParams = useSearchParams();
  const previewSuffix = searchParams.get("mobilePreview") === "1" ? "?mobilePreview=1" : "";
  const tabs: Array<{ id: FeedTab; label: string; href: string }> = [
    { id: "for-you", label: "Talk", href: "/" },
    { id: "following", label: "Read", href: "/read" },
    { id: "meet", label: "Meet", href: "/meet" },
  ];

  return (
    <header className="grid h-[76px] grid-cols-[48px_minmax(0,1fr)_48px] items-center px-5 pt-[max(.5rem,env(safe-area-inset-top))] md:hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo_clouds.png" alt="Clouds" className="h-[42px] w-[42px] object-contain" />
      <nav aria-label="Categorias do feed" className="flex min-w-0 items-center justify-center gap-4 whitespace-nowrap">
        {tabs.map((tab) => <Link key={tab.id} href={`${tab.href}${previewSuffix}`} className={`relative text-[16px] font-semibold ${active === tab.id ? "text-[#B44DFF]" : "text-white/60"}`}>{tab.label}{active === tab.id && <span className="absolute -bottom-3 left-1 right-1 h-1 rounded-full bg-[#A855F7]" />}</Link>)}
      </nav>
      {onSearch ? <button type="button" aria-label="Buscar" onClick={onSearch} className="justify-self-center text-white"><SearchIcon /></button> : <span />}
    </header>
  );
}

export function MobileAppNav(props: Parameters<typeof MobileAppNavContent>[0]) {
  return <Suspense fallback={null}><MobileAppNavContent {...props} /></Suspense>;
}

function MobileAppNavContent({ active, force = false }: { active?: "home" | "messages" | "trending" | "profile"; force?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user } = useSessionUser();
  const previewSuffix = searchParams.get("mobilePreview") === "1" ? "?mobilePreview=1" : "";
  const isActive = (id: NonNullable<typeof active>) => active === id || (id === "profile" && pathname.startsWith("/profile"));
  const color = (id: NonNullable<typeof active>) => isActive(id) ? "text-[#A855F7]" : "text-white";

  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 items-center border-t border-white/[.08] bg-[#060410]/95 px-4 py-5 backdrop-blur-md ${force ? "" : "md:hidden"}`} aria-label="Navegação móvel">
      <Link href={`/${previewSuffix}`} aria-label="Início" className={`mx-auto ${color("home")}`}><HomeIcon /></Link>
      <Link href={`/messages${previewSuffix}`} aria-label="Mensagens" className={`mx-auto ${color("messages")}`}><MessageIcon /></Link>
      <Link href={`/?create=1${previewSuffix ? "&mobilePreview=1" : ""}`} aria-label="Criar Cloud" className="mx-auto flex h-9 w-9 items-center justify-center rounded-full border-2 border-white text-white"><span className="text-[23px] font-light leading-none">+</span></Link>
      <Link href={`/trending${previewSuffix}`} aria-label="Em alta" className={`mx-auto ${color("trending")}`}><FlameIcon /></Link>
      <Link href={`/profile${previewSuffix}`} aria-label="Meu perfil" className={`mx-auto overflow-hidden rounded-full ${color("profile")}`}><SessionUserAvatar user={user} size={35} className="rounded-full" /></Link>
    </nav>
  );
}
