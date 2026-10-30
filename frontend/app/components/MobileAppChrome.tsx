"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FlameIcon } from "./FlameIcon";
import { SessionUserAvatar, useSessionUser } from "./session-user";
import { LongPressHint } from "./LongPressHint";
import { MessagesNavLink } from "./MessagesNavLink";

type FeedTab = "for-you" | "following" | "meet";

function isTextInput(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select"));
}

/** Horizontal mobile navigation that leaves vertical scrolling and controls alone. */
export function useMobileFeedTabSwipe() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const start = useRef<{ x: number; y: number } | null>(null);
  const swipeHandled = useRef(false);
  // Links and buttons deliberately participate: a confirmed swipe cancels their click below.

  useEffect(() => {
    ["/", "/read", "/meet"].filter((page) => page !== pathname).forEach((page) => router.prefetch(page));
  }, [pathname, router]);

  const completeSwipe = useCallback((target: EventTarget | null, x: number, y: number) => {
    const initial = start.current;
    start.current = null;
    if (swipeHandled.current || !initial || isTextInput(target) || !window.matchMedia("(max-width: 767px)").matches) return;
    const deltaX = x - initial.x;
    const deltaY = y - initial.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    const pages = ["/", "/read", "/meet"];
    const currentIndex = pages.indexOf(pathname);
    const nextIndex = currentIndex + (deltaX < 0 ? 1 : -1);
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= pages.length) return;
    swipeHandled.current = true;
    document.documentElement.dataset.mobileTabTransition = deltaX < 0 ? "forward" : "back";
    router.push(`${pages[nextIndex]}${searchParams.get("mobilePreview") === "1" ? "?mobilePreview=1" : ""}`);
    window.setTimeout(() => {
      swipeHandled.current = false;
      delete document.documentElement.dataset.mobileTabTransition;
    }, 360);
  }, [pathname, router, searchParams]);

  useEffect(() => {
    // Capture native touch events so a feed scroller cannot swallow the swipe.
    const onStart = (event: TouchEvent) => {
      const target = event.target;
      if (isTextInput(target) || (target instanceof Element && target.closest('[role="dialog"]'))) return;
      const touch = event.touches[0];
      if (touch) start.current = { x: touch.clientX, y: touch.clientY };
    };
    const onEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0];
      if (touch) completeSwipe(event.target, touch.clientX, touch.clientY);
    };
    document.addEventListener("touchstart", onStart, { capture: true, passive: true });
    document.addEventListener("touchend", onEnd, { capture: true, passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart, true);
      document.removeEventListener("touchend", onEnd, true);
    };
  }, [completeSwipe]);

  return {
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse" || isTextInput(event.target)) return;
      start.current = { x: event.clientX, y: event.clientY };
    },
    onPointerUp: (event: React.PointerEvent<HTMLElement>) => {
      if (event.pointerType !== "mouse") return;
      completeSwipe(event.target, event.clientX, event.clientY);
    },
    onPointerCancel: (event: React.PointerEvent<HTMLElement>) => { if (event.pointerType === "mouse") start.current = null; },
    onTouchCancel: () => { start.current = null; },
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (!swipeHandled.current) return;
      event.preventDefault();
      event.stopPropagation();
    },
  };
}

/** Desktop links remain immediate; the generous mobile title area opens after a double tap. */
export function MobileCloudEntryLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const lastTap = useRef(0);

  return <Link href={href} className={className} onClick={(event) => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const now = Date.now();
    if (now - lastTap.current < 350) {
      lastTap.current = 0;
      event.preventDefault();
      router.push(href);
      return;
    }
    lastTap.current = now;
    event.preventDefault();
  }}>{children}</Link>;
}

function SearchIcon() {
  return <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7.5" /><path d="m20 20-3.5-3.5" /></svg>;
}

function HomeIcon() {
  return <svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V12h6v10" /></svg>;
}

export function MobileFeedHeader(props: Parameters<typeof MobileFeedHeaderContent>[0]) {
  return <Suspense fallback={null}><MobileFeedHeaderContent {...props} /></Suspense>;
}

function MobileFeedHeaderContent({ active, onSearch }: { active?: FeedTab; onSearch?: () => void }) {
  const searchParams = useSearchParams();
  const previewSuffix = searchParams.get("mobilePreview") === "1" ? "?mobilePreview=1" : "";
  const tabs: Array<{ id: FeedTab; label: string; href: string; hint: string }> = [
    { id: "for-you", label: "Converse", href: "/", hint: "Converse: Clouds ao vivo para conversar agora." },
    { id: "following", label: "Leia", href: "/read", hint: "Leia: conversas encerradas disponíveis para leitura." },
    { id: "meet", label: "Conheça", href: "/meet", hint: "Conheça: descubra pessoas para seguir e conhecer." },
  ];

  return (
    <header className="grid h-[76px] grid-cols-[48px_minmax(0,1fr)_48px] items-center px-5 pt-[max(.5rem,env(safe-area-inset-top))] md:hidden">
      <Link href={`/${previewSuffix}`} aria-label="Ir para a página inicial" className="flex h-[42px] w-[42px] items-center justify-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo_clouds.png" alt="Clouds Community" className="h-[42px] w-[42px] object-contain" />
      </Link>
      <nav aria-label="Categorias do feed" className="flex min-w-0 items-center justify-center gap-8 whitespace-nowrap">
        {tabs.map((tab) => <LongPressHint key={tab.id} hint={tab.hint}><Link href={`${tab.href}${previewSuffix}`} className={`relative text-[11px] font-semibold ${active === tab.id ? "text-[#B44DFF]" : "text-white/60"}`}>{tab.label}{active === tab.id && <span className="absolute -bottom-3 left-1 right-1 h-1 rounded-full bg-[#A855F7]" />}</Link></LongPressHint>)}
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
  const [unreadNotifications, setUnreadNotifications] = useState(false);
  useEffect(() => {
    setUnreadNotifications(false);
    if (!user?.id) { setUnreadNotifications(false); return; }
    let active = true;
    let requestId = 0;
    const load = async () => {
      const currentRequest = ++requestId;
      try {
        const response = await fetch("/api/notifications", { cache: "no-store" });
        if (!response.ok) return;
        const payload = await response.json() as { unreadCount?: number };
        if (active && currentRequest === requestId) setUnreadNotifications((payload.unreadCount ?? 0) > 0);
      } catch { /* Keep the previous state until the next refresh. */ }
    };
    const refresh = () => void load();
    refresh();
    const timer = window.setInterval(refresh, 5000);
    window.addEventListener("focus", refresh);
    window.addEventListener("clouds:notifications-read", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("clouds:notifications-read", refresh); };
  }, [user?.id]);
  const previewSuffix = searchParams.get("mobilePreview") === "1" ? "?mobilePreview=1" : "";
  const isActive = (id: NonNullable<typeof active>) => active === id || (id === "profile" && pathname.startsWith("/profile"));
  const color = (id: NonNullable<typeof active>) => isActive(id) ? "text-[#A855F7]" : "text-white";

  return (
    <nav className={`fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 items-center border-t border-white/[.08] bg-[#060410]/95 px-4 py-4 backdrop-blur-md ${force ? "" : "md:hidden"}`} aria-label="Navegação móvel">
      <Link href={`/${previewSuffix}`} aria-label="Início" className={`mx-auto ${color("home")}`}><HomeIcon /></Link>
      <div className={`mx-auto ${color("messages")}`}><MessagesNavLink iconOnly active={isActive("messages")} href={`/messages${previewSuffix}`} /></div>
      <Link href={`/?create=1${previewSuffix ? "&mobilePreview=1" : ""}`} aria-label="Criar Cloud" className="mx-auto flex h-12 w-12 items-center justify-center"><img src="/ChatGPT%20Image%2024%20de%20set.%20de%202026%2C%2009_40_30.png" alt="" className="h-12 w-12 object-contain drop-shadow-[0_0_0.2px_white]" /></Link>
      <Link href={`/trending${previewSuffix}`} aria-label="Em alta" className={`mx-auto ${color("trending")}`}><FlameIcon s={27} /></Link>
      <Link href={`/profile${previewSuffix}`} aria-label={unreadNotifications ? "Meu perfil, notificações não visualizadas" : "Meu perfil"} className={`relative mx-auto rounded-full ${color("profile")}`}><SessionUserAvatar user={user} size={35} className="rounded-full" />{unreadNotifications && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[#A855F7] ring-2 ring-[#060410]" />}</Link>
    </nav>
  );
}
