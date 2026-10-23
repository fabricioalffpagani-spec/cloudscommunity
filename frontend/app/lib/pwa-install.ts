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

export function isAppleMobileDevice(navigatorInfo: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">): boolean {
  return /iPad|iPhone|iPod/i.test(navigatorInfo.userAgent) || (/Mac/i.test(navigatorInfo.platform || navigatorInfo.userAgent) && navigatorInfo.maxTouchPoints > 1);
}

export function isMobileDevice(navigatorInfo: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">): boolean {
  return /Android|iPhone|iPad|iPod/i.test(navigatorInfo.userAgent) || isAppleMobileDevice(navigatorInfo);
}

export function isMacSafariBrowser(navigatorInfo: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">): boolean {
  return !isAppleMobileDevice(navigatorInfo) && /Macintosh|Mac OS X/i.test(navigatorInfo.userAgent) && /Safari/i.test(navigatorInfo.userAgent) && !/Chrome|Chromium|Edg|OPR|Firefox|FxiOS/i.test(navigatorInfo.userAgent);
}

const INSTALL_RECORDED_KEY = "clouds:pwa-install-recorded";
export function hasRecordedInstall(): boolean {
  try { return window.localStorage.getItem(INSTALL_RECORDED_KEY) === "true"; } catch { return false; }
}
export function recordInstall(): void {
  try { window.localStorage.setItem(INSTALL_RECORDED_KEY, "true"); } catch { /* Storage may be unavailable. */ }
}
export function forgetRecordedInstall(userId?: string, username?: string): void {
  try {
    window.localStorage.removeItem(INSTALL_RECORDED_KEY);
    if (userId) window.localStorage.removeItem(`clouds:pwa-install-manual-complete:${userId}`);
    if (username) window.localStorage.removeItem(`clouds:pwa-install-signup-complete:${username.toLowerCase()}`);
  } catch { /* Storage may be unavailable. */ }
}
