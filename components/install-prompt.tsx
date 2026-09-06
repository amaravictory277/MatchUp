"use client";

import { useEffect, useState } from "react";
import { Download, Share, X, Plus, Home } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "matchup:install-dismissed";
const DISMISS_DAYS = 7;
const DAY_MS = 86_400_000;

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOSSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isWebkit = /WebKit/.test(ua);
  const notChrome = !/CriOS/.test(ua);
  const notFirefox = !/FxiOS/.test(ua);
  return isIOS && isWebkit && notChrome && notFirefox;
}

function shouldShowDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(DISMISS_KEY);
  if (!raw) return true;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return true;
  return Date.now() - dismissedAt >= DISMISS_DAYS * DAY_MS;
}

function dismissBanner(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || !shouldShowDismissed()) return;

    const isIOS = isIOSSafari();
    setIos(isIOS);

    if (isIOS) {
      const t = window.setTimeout(() => setVisible(true), 1200);
      return () => window.clearTimeout(t);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      window.setTimeout(() => setVisible(true), 1200);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    dismissBanner();
  };

  const handleInstall = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "dismissed") dismissBanner();
    } catch {
      dismissBanner();
    }
    setDeferred(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="install-overlay" role="dialog" aria-modal="true" aria-label="Install MatchUp">
      <div className="install-sheet">
        <button className="install-close" onClick={handleDismiss} aria-label="Close install prompt"><X size={18} /></button>
        <div className="install-icon"><span>M</span></div>
        <div className="install-body">
          <h3>Install MatchUp</h3>
          <p>{ios ? "Add MatchUp to your Home Screen for the full tournament experience." : "Get the full tournament experience right from your Home Screen."}</p>
        </div>
        {ios ? (
          <ol className="install-steps">
            <li><Share size={15} /> Tap the <strong>Share</strong> button</li>
            <li><Plus size={15} /> Select <strong>Add to Home Screen</strong></li>
            <li><Home size={15} /> Tap <strong>Add</strong> to install</li>
          </ol>
        ) : (
          <div className="install-actions">
            <button className="install-btn-primary" onClick={handleInstall}><Download size={16} /> Get the App</button>
            <button className="install-btn-secondary" onClick={handleDismiss}>Maybe Later</button>
          </div>
        )}
      </div>
    </div>
  );
}
