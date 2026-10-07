export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __cloudsInstallPrompt?: InstallPromptEvent | null;
  }
}

/** Keeps the browser's one-shot install event available across route changes. */
export function rememberInstallPrompt(event: InstallPromptEvent) {
  window.__cloudsInstallPrompt = event;
  window.dispatchEvent(new Event("clouds:pwa-install-ready"));
}

export function getRememberedInstallPrompt() {
  return window.__cloudsInstallPrompt ?? null;
}

export function clearRememberedInstallPrompt() {
  window.__cloudsInstallPrompt = null;
}
