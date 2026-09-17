"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { searchGifs, tenorKey, type Gif } from "@/lib/tenor";

export function GifSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (g: Gif) => void }) {
  const [q, setQ] = useState("");
  const [gifs, setGifs] = useState<Gif[]>([]);
  const [next, setNext] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setBusy(true);
      setError(null);
      try {
        const r = await searchGifs(q);
        setGifs(r.gifs);
        setNext(r.next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur Tenor");
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [q, open]);

  async function more() {
    if (!next) return;
    setBusy(true);
    try {
      const r = await searchGifs(q, next);
      setGifs((g) => [...g, ...r.gifs]);
      setNext(r.next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} label="Choisir un GIF" align="bottom" maxWidth={560}>
      <h2 className="m-0 mb-2.5 font-display font-extrabold italic text-lg">Un GIF</h2>
      {!tenorKey() ? (
        <p className="m-0 text-sm text-ko">La clé Tenor (NEXT_PUBLIC_TENOR_KEY) n&apos;est pas configurée dans ce build.</p>
      ) : (
        <>
          <label htmlFor="gif-q" className="sr-only-label">
            Rechercher un GIF
          </label>
          <input id="gif-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className="field mb-3" autoComplete="off" />
          {error ? <p className="m-0 mb-2 text-sm text-ko">{error}</p> : null}
          <div className="grid grid-cols-3 gap-1.5 max-h-[50vh] overflow-y-auto">
            {gifs.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => onPick(g)}
                className="aspect-square overflow-hidden rounded-[10px] border border-line bg-page cursor-pointer p-0"
                aria-label={g.description}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.preview} alt="" className="w-full h-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3 gap-2">
            <span className="text-[11px] text-ink-2">GIF via Tenor</span>
            {next ? (
              <button type="button" onClick={more} disabled={busy} className="btn-muted text-sm">
                {busy ? "…" : "Plus de GIF"}
              </button>
            ) : null}
          </div>
        </>
      )}
    </Modal>
  );
}
