"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

/** Brief in-app launch screen shown after the OS hands control to the PWA. */
export function MobileLaunchScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(false), 900);
    return () => window.clearTimeout(timer);
  }, []);

  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-[300] hidden flex-col items-center justify-center bg-[#05020d] md:hidden" aria-label="Abrindo Clouds">
      <Image src="/pwa-512x512.png" alt="Clouds" width={220} height={220} priority className="h-52 w-52 object-contain" />
      <div className="absolute bottom-[max(3rem,env(safe-area-inset-bottom))] text-center">
        <p className="text-[34px] font-black leading-none tracking-[0.04em] text-white">Clouds</p>
        <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.42em] text-[#A855F7]">Community</p>
      </div>
    </div>
  );
}
