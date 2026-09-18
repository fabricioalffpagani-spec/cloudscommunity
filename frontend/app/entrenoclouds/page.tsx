"use client";

import { useEffect } from "react";

export default function EnterCloudsPage() {
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    window.location.replace(ref ? `/signup?ref=${encodeURIComponent(ref)}` : "/signup");
  }, []);

  return null;
}
