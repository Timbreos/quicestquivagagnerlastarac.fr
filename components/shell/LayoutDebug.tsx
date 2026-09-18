"use client";

import { useEffect, useState } from "react";

/**
 * Mode diagnostic : ouvrir n'importe quelle page avec ?debug=layout affiche
 * les dimensions du viewport et les éléments qui dépassent du bord droit.
 * Sert à traquer les débordements propres à un navigateur (Safari iOS).
 */
export function LayoutDebug() {
  const [report, setReport] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!/[?&]debug=layout/.test(window.location.search)) return;
    const measure = () => {
      const w = window.innerWidth;
      const vv = window.visualViewport;
      const lines: string[] = [
        `page ${window.location.pathname}`,
        `innerWidth ${w} · innerHeight ${window.innerHeight} · screen ${window.screen.width}×${window.screen.height}`,
        `html clientH ${document.documentElement.clientHeight} · coque ${Math.round(document.querySelector("[data-app-shell]")?.getBoundingClientRect().height ?? 0)}px de haut`,
        `visualViewport ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)} scale ${vv.scale.toFixed(2)} offset ${Math.round(vv.offsetLeft)},${Math.round(vv.offsetTop)}` : "n/a"}`,
        `html scrollW ${document.documentElement.scrollWidth} clientW ${document.documentElement.clientWidth} · body scrollW ${document.body.scrollWidth}`,
        `main scrollW ${document.querySelector("main")?.scrollWidth ?? "-"} clientW ${document.querySelector("main")?.clientWidth ?? "-"}`,
        "— éléments dont le bord droit dépasse —",
      ];
      const over: string[] = [];
      for (const el of Array.from(document.querySelectorAll<HTMLElement>("body *"))) {
        if (el.closest("[data-layout-debug]")) continue;
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.right > w + 1 || r.left < -1)) {
          const cls = String(el.className && typeof el.className === "string" ? el.className : "").split(" ").filter(Boolean).slice(0, 4).join(".");
          over.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} left=${Math.round(r.left)} right=${Math.round(r.right)} w=${Math.round(r.width)}`);
        }
      }
      lines.push(...(over.length ? over.slice(0, 20) : ["aucun"]));
      setReport(lines.join("\n"));
    };
    const t = setTimeout(measure, 1200);
    window.addEventListener("resize", measure);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
    };
  }, []);

  if (!report) return null;
  return (
    <div data-layout-debug className="fixed left-2 right-2 top-2 z-[100] bg-ink text-white rounded-sm p-2 text-[11px] leading-[1.35] font-mono max-h-[60vh] overflow-auto">
      <div className="flex gap-2 mb-1">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(report).then(() => setCopied(true));
          }}
          className="bg-gold text-ink rounded px-2 py-1 font-sans font-bold"
        >
          {copied ? "Copié" : "Copier"}
        </button>
        <button type="button" onClick={() => setReport(null)} className="bg-white/15 rounded px-2 py-1 font-sans">
          Fermer
        </button>
      </div>
      <pre className="m-0 whitespace-pre-wrap break-all">{report}</pre>
    </div>
  );
}
