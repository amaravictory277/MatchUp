"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then(registration => registration.update());
  }, []);

  return null;
}
