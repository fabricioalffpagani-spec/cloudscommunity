"use client";

import { useEffect, useLayoutEffect } from "react";

type AccessibilityPreferences = {
  highContrast: boolean;
  reduceMotion: boolean;
  fontSize: "S" | "M" | "L";
};

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  highContrast: false,
  reduceMotion: false,
  fontSize: "M",
};

function readPreferences(): AccessibilityPreferences {
  try {
    const saved = window.localStorage.getItem("clouds-accessibility");
    const parsed = saved ? JSON.parse(saved) as Partial<AccessibilityPreferences> : {};
    const fontSize = parsed.fontSize === "S" || parsed.fontSize === "L" ? parsed.fontSize : "M";

    return {
      highContrast: Boolean(parsed.highContrast),
      reduceMotion: Boolean(parsed.reduceMotion),
      fontSize,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function applyPreferences(preferences: AccessibilityPreferences) {
  const root = document.documentElement;
  root.classList.toggle("a11y-high-contrast", preferences.highContrast);
  root.classList.toggle("a11y-reduce-motion", preferences.reduceMotion);
  root.classList.toggle("a11y-font-small", preferences.fontSize === "S");
  root.classList.toggle("a11y-font-large", preferences.fontSize === "L");
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const applyStoredPreferences = () => applyPreferences(readPreferences());

  useLayoutEffect(() => {
    applyStoredPreferences();
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "clouds-accessibility") {
        applyStoredPreferences();
      }
    };

    applyStoredPreferences();
    window.addEventListener("storage", handleStorage);
    window.addEventListener("clouds-accessibility-change", applyStoredPreferences);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("clouds-accessibility-change", applyStoredPreferences);
    };
  }, []);

  return <>{children}</>;
}
