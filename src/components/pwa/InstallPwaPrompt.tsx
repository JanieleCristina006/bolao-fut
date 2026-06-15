import { useEffect, useState } from "react";
import { Download, MonitorDown, Smartphone, X } from "lucide-react";
import {
  hasSeenPwaInstallPrompt,
  isPwaInstalled,
  markPwaInstalled,
  markPwaInstallPromptSeen,
  OPEN_PWA_INSTALL_PROMPT_EVENT,
  PWA_INSTALL_STATE_CHANGE_EVENT
} from "../../pwa";
import { Button } from "../ui/Button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

function isFirefoxBrowser(): boolean {
  return /firefox/i.test(window.navigator.userAgent);
}

function isIosBrowser(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent) || (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);
}

export function InstallPwaPrompt() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isPwaInstalled);

  useEffect(() => {
    let autoOpenTimer: number | null = null;
    const handleBeforeInstallPrompt = (event: Event) => {
      if (isPwaInstalled()) return;
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      if (!hasSeenPwaInstallPrompt()) {
        markPwaInstallPromptSeen();
        autoOpenTimer = window.setTimeout(() => setIsOpen(true), 900);
      }
    };
    const handleOpenInstallPrompt = () => {
      if (!isPwaInstalled()) setIsOpen(true);
    };
    const handleAppInstalled = () => {
      markPwaInstalled();
      setInstallPrompt(null);
      setIsOpen(false);
      setIsInstalled(true);
    };
    const handleInstallStateChange = () => {
      const nextInstalled = isPwaInstalled();
      setIsInstalled(nextInstalled);
      if (nextInstalled) setIsOpen(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener(OPEN_PWA_INSTALL_PROMPT_EVENT, handleOpenInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener(PWA_INSTALL_STATE_CHANGE_EVENT, handleInstallStateChange);
    return () => {
      if (autoOpenTimer) window.clearTimeout(autoOpenTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener(OPEN_PWA_INSTALL_PROMPT_EVENT, handleOpenInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener(PWA_INSTALL_STATE_CHANGE_EVENT, handleInstallStateChange);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;

    setIsInstalling(true);
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        markPwaInstalled();
        setIsInstalled(true);
      }
      setInstallPrompt(null);
      setIsOpen(false);
    } finally {
      setIsInstalling(false);
    }
  }

  if (!isOpen || isInstalled) return null;

  const installMode = installPrompt ? "native" : isFirefoxBrowser() ? "firefox" : isIosBrowser() ? "ios" : "manual";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 px-4 py-4 backdrop-blur-sm sm:items-center no-print">
      <section
        className="relative w-full max-w-md overflow-hidden rounded-xl bg-white shadow-[0_24px_80px_rgba(2,6,23,0.35)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-pwa-title"
      >
        <button
          type="button"
          className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-950/70 text-white transition hover:bg-slate-950"
          aria-label="Fechar"
          onClick={() => setIsOpen(false)}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="relative h-36 bg-slate-950">
          <img src="/banner.jpg" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/10 to-transparent" />
          <img
            src="/logo.jpg"
            alt="Futebol Inglês Brasil"
            className="absolute bottom-4 left-5 h-16 w-16 rounded-xl border border-white/20 object-cover shadow-lg"
          />
        </div>

        <div className="space-y-4 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-brand-600">Instalar aplicativo</p>
            <h2 id="install-pwa-title" className="mt-1 text-2xl font-black text-slate-950">
              Baixe o app do bolão
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Abra em tela cheia, acesse mais rápido pelo celular e acompanhe ranking, jogos e pagamentos com cara de app.
            </p>
          </div>

          {installMode === "firefox" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              O Firefox para computador não suporta instalação direta. Para baixar como app, abra este site no Chrome ou Edge e clique em
              <strong> Baixar app</strong>.
            </div>
          ) : null}

          {installMode === "ios" ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-6 text-blue-950">
              No iPhone ou iPad, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.
            </div>
          ) : null}

          {installMode === "manual" ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              Se o instalador nativo ainda não apareceu, use Chrome ou Edge e procure o ícone de instalação na barra de endereço.
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-100 p-3">
              <Smartphone className="h-5 w-5 text-brand-600" aria-hidden />
              <p className="mt-2 text-sm font-bold text-slate-950">No celular</p>
              <p className="text-xs leading-5 text-slate-600">Use a instalação do navegador ou adicione à tela inicial.</p>
            </div>
            <div className="rounded-lg bg-slate-100 p-3">
              <MonitorDown className="h-5 w-5 text-brand-600" aria-hidden />
              <p className="mt-2 text-sm font-bold text-slate-950">No computador</p>
              <p className="text-xs leading-5 text-slate-600">Instale pelo Chrome ou Edge e abra como aplicativo.</p>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {installMode === "native" ? (
              <Button
                className="w-full justify-center"
                icon={<Download className="h-4 w-4" aria-hidden />}
                disabled={isInstalling}
                onClick={handleInstall}
              >
                {isInstalling ? "Abrindo..." : "Instalar app"}
              </Button>
            ) : null}
            <Button variant="secondary" className="w-full justify-center" onClick={() => setIsOpen(false)}>
              {installMode === "native" ? "Agora não" : "Entendi"}
            </Button>
          </div>

          {installMode === "native" ? (
            <p className="text-center text-xs leading-5 text-slate-500">
              Se você já instalou o app, abra-o pelo atalho criado na área de trabalho ou tela inicial.
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
