"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BrandWordmark } from "./HeaderBrand";

const PWA_SPLASH_SESSION_KEY = "clouds:pwa-splash-shown";

function isStandaloneMobilePwa() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches
    || ("standalone" in navigator && navigator.standalone === true);
  const mobileViewport = window.matchMedia("(max-width: 767px)").matches;
  return standalone && mobileViewport;
}

/** Brief in-app launch screen shown after the OS hands control to the PWA. */
export function MobileLaunchScreen() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isStandaloneMobilePwa()) return;
    if (window.sessionStorage.getItem(PWA_SPLASH_SESSION_KEY) === "1") return;

    window.sessionStorage.setItem(PWA_SPLASH_SESSION_KEY, "1");
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-[#060410] px-6 md:hidden" aria-label="Abrindo Clouds Community">
      <div className="flex max-w-full flex-col items-center gap-5 text-center">
        <Image src="/pwa-512x512.png" alt="Clouds" width={220} height={220} priority className="h-[min(52vw,13rem)] w-[min(52vw,13rem)] object-contain" />
        <BrandWordmark centered />
      </div>
    </div>
  );
}
