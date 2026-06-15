export const OPEN_PWA_INSTALL_PROMPT_EVENT = "bolao:open-pwa-install-prompt";
export const PWA_INSTALL_STATE_CHANGE_EVENT = "bolao:pwa-install-state-change";

const PWA_INSTALLED_KEY = "bolao-pwa-installed";
const PWA_INSTALL_PROMPT_SEEN_KEY = "bolao-pwa-install-prompt-seen";

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isPwaInstalled(): boolean {
  if (typeof window === "undefined") return false;
  return isStandaloneMode() || getStorage()?.getItem(PWA_INSTALLED_KEY) === "true";
}

export function markPwaInstalled(): void {
  getStorage()?.setItem(PWA_INSTALLED_KEY, "true");
  window.dispatchEvent(new Event(PWA_INSTALL_STATE_CHANGE_EVENT));
}

export function hasSeenPwaInstallPrompt(): boolean {
  return getStorage()?.getItem(PWA_INSTALL_PROMPT_SEEN_KEY) === "true";
}

export function markPwaInstallPromptSeen(): void {
  getStorage()?.setItem(PWA_INSTALL_PROMPT_SEEN_KEY, "true");
}

export function openPwaInstallPrompt(): void {
  if (isPwaInstalled()) return;
  window.dispatchEvent(new Event(OPEN_PWA_INSTALL_PROMPT_EVENT));
}

export function registerPwaServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // The app still works normally if the browser blocks service workers.
    });
  });
}
