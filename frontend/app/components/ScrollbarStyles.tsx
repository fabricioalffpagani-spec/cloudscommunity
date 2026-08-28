"use client";

import { useEffect } from "react";

export function ScrollbarStyles() {
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "scrollbar-overrides";
    style.textContent = `
      *::-webkit-scrollbar { width: 6px !important; height: 6px !important; }
      *::-webkit-scrollbar-track { background: #0e0520 !important; }
      *::-webkit-scrollbar-thumb { background: #7C3AED !important; border-radius: 999px !important; }
      *::-webkit-scrollbar-thumb:hover { background: #A855F7 !important; }
    `;
    // Remove any previous instance
    document.getElementById("scrollbar-overrides")?.remove();
    document.head.appendChild(style);
  }, []);

  return null;
}
