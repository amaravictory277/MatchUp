"use client";

import { useEffect, useState } from "react";

export function PwaLaunchScreen() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone || sessionStorage.getItem("matchup:pwa-launch-seen")) return;
    sessionStorage.setItem("matchup:pwa-launch-seen", "1");
    setVisible(true);
    const timer = window.setTimeout(() => setVisible(false), 850);
    return () => window.clearTimeout(timer);
  }, []);
  if (!visible) return null;
  return (
    <div className="pwa-launch-screen" role="status" aria-label="Opening MatchUp">
      <div className="pwa-launch-logo">
        <img src="/matchup-logo.svg" alt="MatchUp" />
      </div>
      <div className="pwa-launch-bar" aria-hidden="true"><span /></div>
    </div>
  );
}
