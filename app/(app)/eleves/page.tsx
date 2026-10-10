"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Pastille } from "@/components/ui/Pastille";
import { CastingGrid } from "@/components/home/CastingGrid";
import { EmptyBox, ErrorBox, Loading, PageTitle } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { contestantStatus, currentWeek, nomineesOf, phaseIsOpen, phaseIsRevealed } from "@/lib/derive";
import { chatTime, firstName, ord, shortName } from "@/lib/format";
import type { ContestantNote, RankingItemPublic } from "@/lib/types";

function FicheEleve() {
  const store = useSeason();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const season = store.season;
  const contestant = id ? store.contestants.find((c) => c.id === id) ?? null : null;
  const [placements, setPlacements] = useState<RankingItemPublic[]>([]);

  useEffect(() => {
    if (!season || !contestant) return;
    let cancelled = false;
    supabase()
      .from("ranking_items_public")
      .select("*")
      .eq("season_id", season.id)
      .eq("contestant_id", contestant.id)
      .then(({ data }) => {
        if (!cancelled) setPlacements((data ?? []) as RankingItemPublic[]);
      });
    return () => {
      cancelled = true;
    };
  }, [season, contestant, store.leaderboard]);

  const nominees = nomineesOf(currentWeek(store.weeks), store.nominations);
  const profiles = useMemo(() => new Map(store.profiles.map((p) => [p.id, p])), [store.profiles]);

  if (!season) return <Loading />;
  if (!contestant) {
    return (
      <div className="p-4 pt-0">
        <CastingGrid title="Tous les élèves" />
      </div>
    );
  }

  const status = contestantStatus(contestant, store.eliminations, nominees);
  const badge =
    status.kind === "eliminated"
      ? { cls: status.exit_place === 1 ? "badge-gold" : "badge-ko", label: status.exit_place === 1 ? "Vainqueur de la saison" : `Éliminé·e à la ${ord(status.exit_place)} place${status.is_scored ? "" : " · hors scoring"}` }
      : status.kind === "nominated"
        ? { cls: "badge-gold", label: "Nominé·e cette semaine" }
        : { cls: "badge-violet", label: "En lice" };

  const byPhase = (phase: number) =>
    placements
      .filter((p) => p.phase === phase)
      .map((p) => ({ p, profile: profiles.get(p.user_id) }))
      .sort((a, b) => a.p.position - b.p.position);

  return (
    <div className="p-4 flex flex-wrap gap-4 items-start">
      <div className="flex-[1_1_520px] min-w-0 flex flex-col gap-4">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Élèves">
          {store.contestants.map((c) => {
            const active = c.id === contestant.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => router.replace(`/eleves/?id=${c.id}`)}
                className={`min-h-10 px-3 rounded-full border text-[13px] font-semibold whitespace-nowrap ${active ? "border-violet bg-violet-veil text-violet-dark" : "border-line bg-surface text-ink-2"}`}
              >
                {shortName(c.full_name)}
              </button>
            );
          })}
        </div>
        <section className="card rounded-xl p-[18px] flex gap-4 items-center flex-wrap">
          <Pastille name={contestant.full_name} photo={contestant.photo_url} size={84} display tone={status.kind === "eliminated" && status.exit_place !== 1 ? "grey" : "violet"} />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 mb-1.5 font-display font-extrabold text-[26px] tracking-[-0.02em]">{contestant.full_name}</h1>
            <span className={badge.cls}>{badge.label}</span>
            {contestant.bio ? <p className="m-0 mt-2 text-sm text-ink-2 [text-wrap:pretty]">{contestant.bio}</p> : null}
          </div>
        </section>
        <section className="card p-4">
          <h2 className="m-0 mb-2.5 card-title text-base">Où chacun l&apos;a placé{season.p2_opens_at ? " · phase 1" : ""}</h2>
          <Placements rows={byPhase(1)} meId={store.profile?.id} revealed={phaseIsRevealed(season, 1)} />
        </section>
        {season.p2_opens_at ? (
          <section className="card p-4">
            <h2 className="m-0 mb-2.5 card-title text-base">Phase 2</h2>
            <Placements rows={byPhase(2)} meId={store.profile?.id} revealed={phaseIsRevealed(season, 2)} />
          </section>
        ) : null}
        <p className="m-0 text-sm">
          <Link href="/votes/">Tous les votes</Link>
        </p>
      </div>
      <NoteCard contestantId={contestant.id} name={contestant.full_name} />
    </div>
  );
}

function Placements({ rows, meId, revealed }: { rows: Array<{ p: RankingItemPublic; profile?: { display_name: string; avatar_url: string | null } }>; meId?: string; revealed: boolean }) {
  if (rows.length === 0) return <p className="m-0 text-sm text-ink-2">{revealed ? "Personne ne l'a classé." : "Visible à la révélation de la phase. Ton propre vote apparaît dès qu'il est validé."}</p>;
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
      {rows.map(({ p, profile }) => (
        <li key={p.user_id} className="flex items-center gap-2.5 py-[9px] border-t border-page">
          <Pastille name={profile?.display_name ?? "?"} photo={profile?.avatar_url} size={28} tone="veil" />
          <span className="flex-1 text-[15px]">
            {profile?.display_name ?? "?"}
            {p.user_id === meId ? " (toi)" : ""}
          </span>
          <span className="font-display font-bold text-base text-violet-dark">{ord(p.position)}</span>
        </li>
      ))}
      {!revealed ? <li className="text-[13px] text-ink-2 pt-2">Les autres apparaîtront à la révélation.</li> : null}
    </ul>
  );
}

/** Carnet privé du joueur connecté sur cet élève : un fil de notes datées, plus récentes en haut. */
function NoteCard({ contestantId, name }: { contestantId: string; name: string }) {
  const store = useSeason();
  const season = store.season!;
  const phases = ([1, 2] as const).filter((ph) => (ph === 1 ? Boolean(season.p1_opens_at) : Boolean(season.p2_opens_at)));
  return (
    <section className="flex-[1_1_300px] min-w-0 max-w-[360px] bg-gold-veil border border-gold rounded-lg p-4 flex flex-col gap-3">
      <div>
        <h2 className="m-0 mb-1 card-title text-base">Mon carnet privé</h2>
        <p className="m-0 text-[13px] text-gold-ink [text-wrap:pretty]">Visible par toi seul. Jamais publié, y compris après la révélation.</p>
      </div>
      <NoteJournal key={contestantId} contestantId={contestantId} name={name} />
      {phases.length > 0 ? (
        <div className="flex flex-col gap-3 pt-3 border-t border-gold-line">
          <p className="m-0 text-xs font-semibold text-gold-ink">Note de classement</p>
          {phases.map((ph) => (
            <NoteField key={`${contestantId}-${ph}`} phase={ph} contestantId={contestantId} name={name} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function NoteJournal({ contestantId, name }: { contestantId: string; name: string }) {
  const store = useSeason();
  const season = store.season!;
  const [notes, setNotes] = useState<ContestantNote[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

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
        <label htmlFor="journal-new" className="label text-gold-ink">
          Nouvelle note sur {firstName(name)}
        </label>
        <textarea
          id="journal-new"
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

function NoteField({ phase, contestantId, name }: { phase: 1 | 2; contestantId: string; name: string }) {
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

  const id = `note-${phase}`;
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

function ElevesHeader() {
  const params = useSearchParams();
  const isSheet = Boolean(params.get("id"));
  return (
    <div className="px-4 pt-4 pb-3.5">
      <PageTitle
        title={isSheet ? "Fiche élève" : "Les élèves"}
        sub={isSheet ? "Statut, où chacun l'a placé, et ton carnet privé." : "Le casting de la saison, tel qu'il se dévoile. Tape un élève pour sa fiche."}
      />
    </div>
  );
}

export default function ElevesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <div>
        <ElevesHeader />
        <FicheEleve />
      </div>
    </Suspense>
  );
}
