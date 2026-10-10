"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function Modal({
  open,
  onClose,
  label,
  align = "center",
  children,
  maxWidth = 440,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  align?: "center" | "bottom";
  children: ReactNode;
  maxWidth?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = ref.current?.querySelector<HTMLElement>("textarea, input, button, select");
    first?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  // Rendue dans <body> : un parent animé (transform) piégerait sinon le position: fixed dans sa boîte.
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-center p-4 ${align === "bottom" ? "items-end" : "items-center"}`}
      style={{ background: "rgba(32,23,54,.55)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="w-full bg-surface rounded-xl p-[18px] max-h-[90vh] overflow-y-auto animate-prime-in"
        style={{ maxWidth }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
