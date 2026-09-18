"use client";

import { useEffect } from "react";

/**
 * Safari iOS ignore user-scalable=no depuis iOS 10 : on bloque le pinch via les
 * événements gesture* (propres à WebKit) et le double-tap via touch-action en CSS.
 */
export function NoZoom() {
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", prevent, { passive: false });
    document.addEventListener("gesturechange", prevent, { passive: false });
    document.addEventListener("gestureend", prevent, { passive: false });
    return () => {
      document.removeEventListener("gesturestart", prevent);
      document.removeEventListener("gesturechange", prevent);
      document.removeEventListener("gestureend", prevent);
    };
  }, []);
  return null;
}
