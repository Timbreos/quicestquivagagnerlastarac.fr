"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/Etoile";
import { IconClose } from "@/components/ui/Icons";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "starac-install-dismissed";
const DISMISS_DAYS = 14;

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
}
function recentlyDismissed(): boolean {
  try {
    const v = localStorage.getItem(DISMISS_KEY);
    return Boolean(v) && Date.now() - Number(v) < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Enregistre le service worker (installabilité + cache des assets). */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}

/**
 * Invitation à installer l'app, mobile seulement, une fois connecté.
 * Android/Chrome : bouton natif via beforeinstallprompt. iOS : le pas-à-pas
 * Partager → Sur l'écran d'accueil, Safari n'offrant pas d'API.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<null | "native" | "ios">(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("native");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const t = setTimeout(() => {
      if (isIos()) setMode((m) => m ?? "ios");
    }, 2500);
    const onInstalled = () => setMode(null);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* mode privé : on oublie, tant pis */
    }
    setMode(null);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") setMode(null);
    else dismiss();
  }

  if (!mode) return null;
  return (
    <div className="lg:hidden shrink-0 bg-gold-veil border-t border-gold px-3 py-2.5 flex items-center gap-3" role="region" aria-label="Installer l'application">
      <LogoMark size={36} bg="#3A1F8C" />
      <div className="flex-1 min-w-0 text-[13px] leading-[1.35]">
        <p className="m-0 font-display font-bold text-ink text-sm">Garde la Starac sous la main</p>
        {mode === "native" ? (
          <p className="m-0 text-gold-ink">Installe l&apos;app : plein écran, une icône, prête pour le samedi soir.</p>
        ) : (
          <p className="m-0 text-gold-ink">
            Tape <ShareIcon /> <strong>Partager</strong> puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>. Plein écran, sans la barre de Safari.
          </p>
        )}
      </div>
      {mode === "native" ? (
        <button type="button" onClick={install} className="btn-gold min-h-10 px-3 text-sm shrink-0">
          Installer
        </button>
      ) : null}
      <button type="button" onClick={dismiss} aria-label="Plus tard" className="w-10 h-10 shrink-0 grid place-items-center rounded-[10px] text-gold-ink hover:bg-gold-line">
        <IconClose size={18} />
      </button>
    </div>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" className="inline align-[-2px]" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 7l4-4 4 4" />
      <path d="M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}
