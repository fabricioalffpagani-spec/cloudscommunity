"use client";

import { useEffect } from "react";

export default function EnterCloudsPage() {
  useEffect(() => {
    window.location.replace("/signup");
  }, []);

  return null;
}
