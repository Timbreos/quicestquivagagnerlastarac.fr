"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Pastille } from "@/components/ui/Pastille";
import { ErrorBox } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { phaseIsOpen } from "@/lib/derive";
import { chatTime, firstName } from "@/lib/format";
import type { Contestant, ContestantNote } from "@/lib/types";

// Le carnet privé : étoiles (1 à 5), note de classement par phase et fil de notes.
// Tout est lisible par son auteur seul (RLS), jamais publié.

function StarShape({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className="shrink-0">
      <path
        d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"
        fill={filled ? "var(--color-gold)" : "none"}
        stroke={filled ? "var(--color-gold-ink)" : "var(--color-line)"}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Mes étoiles sur un élève, en lecture. Rien si je ne l'ai pas noté. */
export function MyStars({ contestantId, size = 12, compact = false }: { contestantId: string; size?: number; compact?: boolean }) {
  const stars = useSeason().myStars.get(contestantId);
  if (!stars) return null;
  const label = `Mes étoiles : ${stars} sur 5`;
  if (compact) {
    return (
      <span className="inline-flex items-center gap-0.5 shrink-0 text-[11px] font-bold text-gold-ink" aria-label={label} title={label}>
        {stars}
        <StarShape filled size={size} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-px shrink-0" role="img" aria-label={label} title={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarShape key={n} filled={n <= stars} size={size} />
      ))}
    </span>
  );
}

/** Saisie des étoiles. Retaper l'étoile déjà posée les retire. */
export function StarInput({ contestantId, name }: { contestantId: string; name: string }) {
  const store = useSeason();
  const stars = store.myStars.get(contestantId) ?? 0;
  const [error, setError] = useState<string | null>(null);

  async function set(n: number) {
    setError(null);
    const err = await store.setStars(contestantId, n === stars ? null : n);
    if (err) setError(err);
  }

  return (
    <div>
      <div role="group" aria-label={`Mes étoiles pour ${name}`} className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => set(n)}
            aria-pressed={n <= stars}
            aria-label={`${n} étoile${n > 1 ? "s" : ""}${n === stars ? " (retaper pour retirer)" : ""}`}
            className="w-10 h-10 flex items-center justify-center rounded-[10px] cursor-pointer transition-transform duration-150 hover:scale-110"
          >
            <StarShape filled={n <= stars} size={26} />
          </button>
        ))}
        <span className="ml-1.5 text-xs text-ink-2">{stars ? `${stars}/5` : "pas encore noté"}</span>
      </div>
      {error ? <p className="m-0 mt-1 text-xs text-ko">{error}</p> : null}
    </div>
  );
}

/** Bouton (i) qui ouvre le carnet d'un élève dans une modale. */
export function CarnetButton({ contestant, phase, className = "" }: { contestant: Contestant; phase?: 1 | 2; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`Carnet privé : ${contestant.full_name}`}
        title="Mon carnet privé"
        className={`w-7 h-7 flex items-center justify-center rounded-full border border-gold-line bg-gold-veil text-gold-ink font-display font-extrabold italic text-[13px] leading-none cursor-pointer transition-colors hover:bg-[#F7EBCF] ${className}`}
      >
        i
      </button>
      <CarnetModal contestant={contestant} phase={phase} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

/** Le carnet d'un élève : étoiles, note de classement de la phase (si fournie) et fil de notes. */
export function CarnetModal({ contestant, phase, open, onClose }: { contestant: Contestant; phase?: 1 | 2; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} label={`Carnet privé — ${contestant.full_name}`} align="bottom">
      <div className="flex items-center gap-3 mb-3">
        <Pastille name={contestant.full_name} photo={contestant.photo_url} size={44} />
        <div className="flex-1 min-w-0">
          <h2 className="m-0 font-display font-bold text-lg leading-tight">{contestant.full_name}</h2>
          <p className="m-0 text-xs text-ink-2">Mon carnet privé · visible par moi seul</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer" className="w-10 h-10 rounded-full text-ink-2 text-xl cursor-pointer hover:bg-page">
          ×
        </button>
      </div>
      <div className="flex flex-col gap-3.5">
        <StarInput contestantId={contestant.id} name={contestant.full_name} />
        {phase ? (
          <div className="bg-gold-veil border border-gold-line rounded-md p-3">
            <NoteField phase={phase} contestantId={contestant.id} name={contestant.full_name} />
          </div>
        ) : null}
        <NoteJournal contestantId={contestant.id} name={contestant.full_name} />
        <Link href={`/eleves/?id=${contestant.id}`} onClick={onClose} className="text-sm self-start">
          Voir la fiche de {firstName(contestant.full_name)}
        </Link>
      </div>
    </Modal>
  );
}

export function NoteJournal({ contestantId, name }: { contestantId: string; name: string }) {
  const store = useSeason();
  const season = store.season!;
  const [notes, setNotes] = useState<ContestantNote[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const newId = useId();

  const load = useCallback(async () => {
    const { data, error } = await supabase()
      .from("contestant_notes")
      .select("*")
      .eq("season_id", season.id)
      .eq("contestant_id", contestantId)
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setNotes((data ?? []) as ContestantNote[]);
  }, [season.id, contestantId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase().from("contestant_notes").insert({ season_id: season.id, contestant_id: contestantId, body: draft });
    setBusy(false);
    if (error) return setError(error.message);
    setDraft("");
    await load();
  }

  async function saveEdit(id: string) {
    if (!editText.trim()) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase().from("contestant_notes").update({ body: editText }).eq("id", id);
    setBusy(false);
    if (error) return setError(error.message);
    setEditing(null);
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette note ?")) return;
    setError(null);
    const { error } = await supabase().from("contestant_notes").delete().eq("id", id);
    if (error) return setError(error.message);
    await load();
  }

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={add} className="flex flex-col gap-2">
        <label htmlFor={newId} className="label text-gold-ink">
          Nouvelle note sur {firstName(name)}
        </label>
        <textarea
          id={newId}
          rows={3}
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ce que tu as vu ce soir, ce que tu penses vraiment"
          className="w-full border border-gold rounded-sm p-2.5 text-sm leading-[1.5] bg-surface text-ink resize-y"
        />
        <button type="submit" disabled={busy || !draft.trim()} className="btn-primary self-end text-sm">
          {busy && !editing ? "…" : "Ajouter au carnet"}
        </button>
      </form>
      {error ? <ErrorBox message={error} /> : null}
      {notes === null ? (
        <p className="m-0 text-sm text-ink-2">Chargement…</p>
      ) : notes.length === 0 ? (
        <p className="m-0 text-sm text-ink-2">Aucune note pour l&apos;instant.</p>
      ) : (
        <ol className="list-none m-0 p-0 flex flex-col gap-2" aria-label={`Notes sur ${name}, plus récentes en premier`}>
          {notes.map((n) => (
            <li key={n.id} className="bg-surface border border-gold-line rounded-sm p-2.5">
              <p className="m-0 mb-1 text-xs font-semibold text-gold-ink">
                <time dateTime={n.created_at}>{chatTime(n.created_at)}</time>
                {n.updated_at !== n.created_at ? " · modifiée" : ""}
              </p>
              {editing === n.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    aria-label="Modifier la note"
                    rows={3}
                    value={editText}
                    maxLength={1000}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full border border-gold rounded-sm p-2 text-sm leading-[1.5] bg-surface text-ink resize-y"
                  />
                  <div className="flex gap-2 justify-end">
                    <button type="button" onClick={() => setEditing(null)} className="btn-muted text-sm">
                      Annuler
                    </button>
                    <button type="button" onClick={() => saveEdit(n.id)} disabled={busy || !editText.trim()} className="btn-primary text-sm">
                      Enregistrer
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="m-0 text-[13px] leading-[1.45] text-ink whitespace-pre-wrap [overflow-wrap:anywhere]">{n.body}</p>
                  <div className="flex gap-3 mt-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(n.id);
                        setEditText(n.body);
                      }}
                      className="text-ink-2 underline cursor-pointer"
                    >
                      Modifier
                    </button>
                    <button type="button" onClick={() => remove(n.id)} className="text-ink-2 underline cursor-pointer">
                      Supprimer
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}


export function NoteField({ phase, contestantId, name }: { phase: 1 | 2; contestantId: string; name: string }) {
  const store = useSeason();
  const season = store.season!;
  const ranking = store.myRankings.find((r) => r.phase === phase);
  const item = store.myItems.find((i) => i.ranking_id === ranking?.id && i.contestant_id === contestantId);
  const [text, setText] = useState(item?.comment ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [touched, setTouched] = useState(false);
  const canCreate = phaseIsOpen(season, phase) || Boolean(item);

  useEffect(() => {
    if (!touched) setText(item?.comment ?? "");
  }, [item?.comment, touched]);

  useEffect(() => {
    if (!touched) return;
    setState("saving");
    const t = setTimeout(async () => {
      const { error } = await supabase().rpc("set_note", { p_season_id: season.id, p_phase: phase, p_contestant_id: contestantId, p_comment: text });
      if (error) setState("error");
      else {
        setState("saved");
        await store.refresh();
      }
    }, 700);
    return () => clearTimeout(t);
  }, [text, touched, season.id, phase, contestantId, store]);

  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="label text-gold-ink">
        {phase === 2 ? "Phase 2 · " : "Phase 1 · "}pourquoi ce rang pour {firstName(name)}
      </label>
      <textarea
        id={id}
        rows={2}
        value={text}
        maxLength={1000}
        disabled={!canCreate}
        onChange={(e) => {
          setTouched(true);
          setText(e.target.value);
        }}
        placeholder={canCreate ? "Ce que tu penses vraiment" : "Pas de note possible : phase fermée sans classement."}
        className="w-full border border-gold rounded-sm p-2.5 text-sm leading-[1.5] bg-surface text-ink resize-y disabled:opacity-60"
      />
      <p className="m-0 mt-1 text-xs text-ink-2" role="status">
        {state === "saving" ? "Enregistrement…" : state === "saved" ? "Note enregistrée" : state === "error" ? "Erreur d'enregistrement" : ""}
      </p>
    </div>
  );
}

