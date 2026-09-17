"use client";

import { useState } from "react";

export function Panel({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="card p-4 flex flex-col gap-3">
      <div>
        <h2 className="card-title text-base">{title}</h2>
        {sub ? <p className="m-0 mt-0.5 text-[13px] text-ink-2 [text-wrap:pretty]">{sub}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Bouton à confirmation en deux taps, pour les actions qui coûtent. */
export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  className = "btn-muted",
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  if (armed) {
    return (
      <span className="inline-flex gap-1.5">
        <button
          type="button"
          onClick={async () => {
            setArmed(false);
            await onConfirm();
          }}
          className="btn bg-ko-veil text-ko border border-[#E7B4AD] text-sm"
        >
          {confirmLabel}
        </button>
        <button type="button" onClick={() => setArmed(false)} className="btn-muted text-sm">
          Annuler
        </button>
      </span>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={() => setArmed(true)} className={`${className} text-sm`}>
      {label}
    </button>
  );
}

export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run(fn: () => Promise<{ error: { message: string } | null } | void>) {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (r && r.error) setError(r.error.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run, setError };
}
