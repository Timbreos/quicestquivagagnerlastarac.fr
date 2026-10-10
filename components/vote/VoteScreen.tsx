"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { Pastille } from "@/components/ui/Pastille";
import { ErrorBox } from "@/components/ui/Feedback";
import { CarnetButton, CarnetModal, MyStars } from "@/components/carnet/Carnet";
import { NomineeButtons, useWeeklyPick } from "@/components/home/WeeklyPick";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { eliminationOf, phaseIsOpen, remainingContestants } from "@/lib/derive";
import { longDateTime, ord, shortName } from "@/lib/format";
import type { Contestant } from "@/lib/types";

type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Tap pour placer. Grille des élèves à placer en haut, liste ordonnée en bas.
 * Un tap sur un élève → place libre suivante. Tap sur une place occupée →
 * sélection ; second tap ailleurs → échange ; même place → libération.
 */
export function VoteScreen({ phase }: { phase: 1 | 2 }) {
  const store = useSeason();
  const season = store.season;
  const ranking = store.myRankings.find((r) => r.phase === phase) ?? null;
  const items = useMemo(() => store.myItems.filter((i) => i.ranking_id === ranking?.id), [store.myItems, ranking?.id]);
  const eligible = useMemo(
    () => (phase === 1 ? store.contestants : remainingContestants(store.contestants, store.eliminations)),
    [phase, store.contestants, store.eliminations],
  );
  const N = phase === 1 ? store.contestants.length : season?.phase2_threshold ?? 8;
  const open = phaseIsOpen(season, phase);
  const opened = Boolean(phase === 1 ? season?.p1_opens_at : season?.p2_opens_at);
  const submitted = Boolean(ranking?.submitted_at);
  const editable = open && !submitted;
  const rosterComplete = phase === 2 || Boolean(season?.roster_complete_at);
  const byId = useMemo(() => new Map(store.contestants.map((c) => [c.id, c])), [store.contestants]);

  const [slots, setSlots] = useState<Array<string | null>>(() => Array(N).fill(null));
  const [picked, setPicked] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [carnetFor, setCarnetFor] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const dirty = useRef(false);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydratation depuis la base tant qu'aucune modification locale n'attend
  const serverKey = useMemo(
    () => JSON.stringify(items.filter((i) => i.position).map((i) => [i.position, i.contestant_id]).sort((a, b) => Number(a[0]) - Number(b[0]))),
    [items],
  );
  useEffect(() => {
    if (dirty.current) return;
    const next: Array<string | null> = Array(N).fill(null);
    for (const it of items) {
      if (it.position && it.position >= 1 && it.position <= N && eligible.some((c) => c.id === it.contestant_id)) next[it.position - 1] = it.contestant_id;
    }
    setSlots(next);
  }, [serverKey, N, items, eligible]);

  const notes = useMemo(() => {
    const m = new Map<string, string>();
    for (const it of items) if (it.comment) m.set(it.contestant_id, it.comment);
    return m;
  }, [items]);

  // Sauvegarde du brouillon à chaque geste (debounce court)
  const scheduleSave = useCallback(
    (next: Array<string | null>) => {
      if (!season || !editable) return;
      dirty.current = true;
      setSaveState("saving");
      if (pendingSave.current) clearTimeout(pendingSave.current);
      pendingSave.current = setTimeout(async () => {
        const payload = next.map((cid, i) => (cid ? { contestant_id: cid, position: i + 1 } : null)).filter(Boolean);
        const { error } = await supabase().rpc("save_ranking_draft", { p_season_id: season.id, p_phase: phase, p_items: payload });
        if (error) {
          setSaveState("error");
          setSaveError(error.message);
          return;
        }
        await store.refresh();
        if (!pendingSave.current) return;
        pendingSave.current = null;
        dirty.current = false;
        setSaveState("saved");
        setSaveError(null);
      }, 500);
    },
    [season, editable, phase, store],
  );

  function update(next: Array<string | null>) {
    setSlots(next);
    scheduleSave(next);
  }

  function place(cid: string) {
    const free = slots.indexOf(null);
    if (free < 0) return;
    const next = slots.slice();
    next[free] = cid;
    setPicked(null);
    update(next);
  }
  function selectSlot(i: number) {
    if (!editable) return;
    const next = slots.slice();
    if (picked === null) {
      if (next[i]) setPicked(i);
      return;
    }
    if (picked === i) {
      next[i] = null;
      setPicked(null);
      update(next);
      return;
    }
    [next[i], next[picked]] = [next[picked], next[i]];
    setPicked(null);
    update(next);
  }
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= N || !slots[i]) return;
    const next = slots.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setPicked(null);
    update(next);
  }
  function clearAll() {
    setConfirmClear(false);
    setPicked(null);
    update(Array(N).fill(null));
  }

  async function doValidate() {
    if (!ranking) return;
    setConfirmOpen(false);
    setSubmitError(null);
    const { error } = await supabase().from("rankings").update({ submitted_at: new Date().toISOString() }).eq("id", ranking.id);
    if (error) {
      setSubmitError(error.message);
      return;
    }
    await store.refresh();
  }

  const filled = slots.filter(Boolean) as string[];
  const pool = eligible.filter((c) => !filled.includes(c.id));
  const nextFree = slots.indexOf(null);
  const validatedList = store.leaderboard;
  const firstPrime = store.weeks.find((w) => w.number === 1)?.prime_at ?? null;
  const { nominees, canPick } = useWeeklyPick();

  if (!season) return null;

  const closedLabel = submitted
    ? null
    : !opened
      ? phase === 1
        ? "Le vote ouvre quand l'organisateur publie la liste des élèves."
        : `La phase 2 ouvrira quand il restera ${season.phase2_threshold} élèves.`
      : !open
        ? phase === 1
          ? "La phase 1 est fermée et ton classement n'a pas été validé : tu es hors saison."
          : "La phase 2 est fermée sans classement validé : tu ne marques pas ses points."
        : null;

  return (
    <div className="flex flex-wrap gap-4 items-start">
      <div className="flex-[1_1_560px] min-w-0 flex flex-col gap-3.5">
        {phase === 2 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2.5 bg-violet-veil border border-violet-line rounded-md p-3">
              <span className="flex-1 text-sm">
                <span className="font-semibold">Phase 1</span> — ton classement des {store.contestants.length}, scellé
              </span>
              <span className="badge bg-surface text-violet-dark">actif</span>
            </div>
            <div className="flex items-center gap-2.5 bg-gold-veil border border-gold rounded-md p-3">
              <span className="flex-1 text-sm">
                <span className="font-semibold">Phase 2</span> — reclasse les {N} derniers, points divisés par deux
              </span>
              <span className="badge bg-surface text-gold-ink">{submitted ? "validé" : "à remplir"}</span>
            </div>
            <p className="m-0 text-[13px] text-ink-2">Les deux comptent. La phase 1 continue de marquer sur ses places.</p>
          </div>
        ) : null}

        {editable ? (
          <div className="flex flex-wrap items-center gap-2.5 justify-between bg-gold-veil border border-gold rounded-md px-3.5 py-2.5">
            <p className="m-0 text-[13px] text-gold-ink">
              {rosterComplete ? (
                <>
                  <span className="font-semibold">
                    {firstPrime && phase === 1 ? `Premier prime ${longDateTime(firstPrime)}.` : "Fermeture par l'organisateur avant le prime."}
                  </span>{" "}
                  Sans validation, {phase === 1 ? "tu es hors saison" : "tu ne marques pas les points de phase 2"}.
                </>
              ) : (
                <>
                  <span className="font-semibold">Le casting se dévoile encore ({N} élève{N > 1 ? "s" : ""} pour l&apos;instant).</span> Classe au fil de l&apos;eau, les nouveaux
                  arrivent ici en direct. La validation s&apos;ouvrira quand la liste sera complète.
                </>
              )}
            </p>
            <span className={`text-xs font-semibold whitespace-nowrap ${saveState === "error" ? "text-ko" : saveState === "saving" ? "text-ink-2" : "text-ok"}`} role="status">
              {saveState === "saving" ? "Enregistrement…" : saveState === "error" ? "Erreur d'enregistrement" : "Brouillon enregistré"}
            </span>
          </div>
        ) : null}
        {saveError ? <ErrorBox message={saveError} /> : null}
        {submitError ? <ErrorBox message={submitError} /> : null}

        {closedLabel ? (
          <section className={`rounded-md p-3.5 border ${!opened ? "bg-violet-veil border-violet-line" : "bg-ko-veil border-[#E7B4AD]"}`}>
            <h2 className={`m-0 mb-1 font-display font-extrabold italic text-[19px] ${!opened ? "text-violet-dark" : "text-ko"}`}>
              {!opened ? "Pas encore ouvert" : "Hors saison"}
            </h2>
            <p className="m-0 text-sm">{closedLabel}</p>
          </section>
        ) : null}

        {submitted ? (
          <section className="bg-gold-veil border border-gold rounded-lg p-4">
            <h2 className="m-0 mb-1 font-display font-bold text-xl">Classement validé et scellé</h2>
            <p className="m-0 text-sm text-gold-ink">
              Validé {ranking?.submitted_at ? longDateTime(ranking.submitted_at) : ""}. Tes notes de carnet restent modifiables, elles ne regardent que toi.
            </p>
          </section>
        ) : null}

        {editable ? (
          <section className="card p-3.5">
            <div className="flex items-baseline justify-between gap-2 mb-2.5">
              <h2 className="card-title text-[15px]">À placer</h2>
              <span className="text-xs text-ink-2">
                {filled.length} / {N} placés
              </span>
            </div>
            {pool.length === 0 ? <p className="m-0 text-sm text-ok font-medium">Les {N} sont placés. Relis, puis valide.</p> : null}
            <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}>
              {pool.map((c) => (
                <div key={c.id} className="relative">
                <button
                  type="button"
                  onClick={() => place(c.id)}
                  className="w-full h-full flex flex-col gap-1.5 min-h-16 p-2 border border-line rounded-sm bg-page text-ink text-left cursor-pointer animate-pop transition-[transform,border-color,background] duration-150 hover:border-violet-line hover:bg-violet-veil hover:-translate-y-0.5"
                >
                  <Pastille name={c.full_name} photo={c.photo_url} size={30} />
                  <span className="text-[13px] font-medium leading-[1.2]">{shortName(c.full_name)}</span>
                  <MyStars contestantId={c.id} size={11} />
                </button>
                <CarnetButton contestant={c} phase={phase} className="absolute top-1 right-1" />
                </div>
              ))}
            </div>
            {pool.length > 0 ? (
              <p className="m-0 mt-2.5 text-xs text-ink-2">Un élève tapé prend la place libre suivante ({nextFree < 0 ? "aucune" : ord(nextFree + 1)}).</p>
            ) : null}
          </section>
        ) : null}

        <section className="card overflow-hidden">
          <div className="px-3.5 pt-3.5 pb-2">
            <h2 className="card-title text-[15px]">{submitted ? "Mon ordre, scellé" : "Mon ordre"}</h2>
            {editable ? (
              <p className="m-0 mt-1 text-xs text-ink-2">
                {picked === null ? "Tape un nom pour l'échanger avec un autre. Deux fois le même pour le libérer." : "Tape la place d'arrivée pour l'échange."}
              </p>
            ) : null}
          </div>
          <ol className="list-none m-0 px-1.5 pb-1.5">
            {slots.map((cid, i) => {
              const c = cid ? byId.get(cid) ?? null : null;
              const sel = picked === i;
              const elim = c ? eliminationOf(store.eliminations, c.id) : undefined;
              const hasNote = c ? notes.has(c.id) : false;
              return (
                <li
                  key={i}
                  className={`flex items-center gap-2 px-2 py-[5px] border-t border-page rounded-sm transition-colors animate-row-in ${sel ? "bg-violet-veil" : i < 3 && c ? "bg-gold-veil" : ""}`}
                  style={{ animationDelay: `${Math.min(i * 0.035, 0.6)}s` }}
                >
                  <span className={`w-[30px] shrink-0 font-display font-bold text-sm text-right ${i < 3 ? "text-gold-ink" : "text-ink-2"}`}>{ord(i + 1)}</span>
                  <SlotButton
                    c={c}
                    selected={sel}
                    editable={editable}
                    eliminatedAt={elim?.exit_place ?? null}
                    hasNote={hasNote}
                    onClick={() => selectSlot(i)}
                  />
                  {c ? (
                    <span className="flex gap-0.5 shrink-0">
                      {editable ? (
                        <>
                          <button type="button" onClick={() => move(i, -1)} aria-label={`Monter ${c.full_name}`} className="w-11 h-11 border border-line rounded-[10px] bg-surface text-violet-dark text-[15px] cursor-pointer transition-[transform,background] duration-150 hover:bg-violet-veil hover:-translate-y-0.5">
                            ↑
                          </button>
                          <button type="button" onClick={() => move(i, 1)} aria-label={`Descendre ${c.full_name}`} className="w-11 h-11 border border-line rounded-[10px] bg-surface text-violet-dark text-[15px] cursor-pointer transition-[transform,background] duration-150 hover:bg-violet-veil hover:translate-y-0.5">
                            ↓
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setCarnetFor(c.id)}
                        aria-label={`Carnet privé : ${c.full_name}`}
                        title="Mon carnet privé"
                        className="w-11 h-11 border border-gold-line rounded-[10px] bg-gold-veil text-gold-ink font-display font-extrabold italic text-base cursor-pointer transition-colors hover:bg-[#F7EBCF]"
                      >
                        i
                      </button>
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        {editable ? (
          <div className="sticky bottom-0 bg-page pt-3 pb-2 flex flex-wrap gap-2.5 items-center">
            <button
              type="button"
              disabled={filled.length < N || !rosterComplete}
              onClick={() => setConfirmOpen(true)}
              className={`flex-1 min-w-[200px] min-h-12 px-[18px] rounded-md text-white font-display font-extrabold text-base border-0 ${
                filled.length < N || !rosterComplete ? "bg-violet-line cursor-default" : "bg-violet cursor-pointer animate-pulse-gold"
              }`}
            >
              {!rosterComplete
                ? "Valider — quand le casting sera complet"
                : filled.length < N
                  ? `Valider — ${N - filled.length} place${N - filled.length > 1 ? "s" : ""} à remplir`
                  : "Valider mon classement"}
            </button>
            {confirmClear ? (
              <button type="button" onClick={clearAll} className="btn bg-ko-veil text-ko border border-[#E7B4AD] text-sm">
                Confirmer : tout vider
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} disabled={filled.length === 0} className="btn-muted text-sm">
                Tout vider
              </button>
            )}
          </div>
        ) : null}
      </div>

      <aside className="flex-[1_1_300px] min-w-0 max-w-[360px] flex flex-col gap-3.5">
        {nominees.length > 0 && canPick ? (
          <section className="card p-4">
            <h2 className="card-title text-[15px] mb-1">Qui part ce soir ?</h2>
            <p className="m-0 mb-3 text-[13px] text-ink-2">Un pronostic par semaine, changeable jusqu&apos;à la fermeture. Bonus s&apos;il sort.</p>
            <NomineeButtons />
          </section>
        ) : null}
        <section className="card p-4">
          <h2 className="card-title text-[15px] mb-1">Le carnet</h2>
          <p className="m-0 mb-3 text-[13px] text-ink-2 [text-wrap:pretty]">Une note par élève placé. Elle ne sort jamais de cet écran, même après la révélation des classements.</p>
          {notes.size === 0 ? (
            <p className="m-0 text-[13px] text-ink-2">Aucune note pour l&apos;instant. Le bouton (i) d&apos;une ligne ouvre ton carnet : étoiles et notes.</p>
          ) : (
            <ul className="list-none m-0 p-0 flex flex-col gap-2.5">
              {[...notes.entries()].map(([cid, text]) => {
                const c = byId.get(cid);
                const idx = slots.indexOf(cid);
                return (
                  <li key={cid} className="bg-gold-veil border border-gold-line rounded-sm p-2.5">
                    <button type="button" onClick={() => setCarnetFor(cid)} className="block w-full text-left cursor-pointer">
                      <p className="m-0 mb-1 text-xs font-semibold text-gold-ink">
                        {c?.full_name ?? "?"} · {idx < 0 ? "non placé" : ord(idx + 1)}
                      </p>
                      <p className="m-0 text-[13px] leading-[1.45] text-ink">{text}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {phase === 1 ? (
            <>
              <h3 className="mt-[18px] mb-2 font-display font-bold text-[15px]">Qui a validé</h3>
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {[...validatedList]
                  .sort((a, b) => a.display_name.localeCompare(b.display_name, "fr"))
                  .map((p) => (
                    <li key={p.user_id} className="flex items-center gap-2 text-sm">
                      <span className={`w-[9px] h-[9px] rounded-full shrink-0 ${p.has_submitted ? "bg-ok" : "bg-gold"}`} />
                      <span className="flex-1">
                        {p.display_name}
                        {p.user_id === store.profile?.id ? " (toi)" : p.is_admin ? " · orga" : ""}
                      </span>
                      <span className={`text-xs font-semibold ${p.has_submitted ? "text-ok" : "text-gold-ink"}`}>{p.has_submitted ? "validé" : "en attente"}</span>
                    </li>
                  ))}
              </ul>
            </>
          ) : null}
          <p className="m-0 mt-4 text-xs text-ink-2">
            <Link href="/regles/">Comment on marque des points</Link>
          </p>
        </section>
      </aside>

      {carnetFor && byId.get(carnetFor) ? (
        <CarnetModal contestant={byId.get(carnetFor)!} phase={phase} open onClose={() => setCarnetFor(null)} />
      ) : null}

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} label="Valider mon classement" maxWidth={400}>
        <h2 className="m-0 mb-1.5 font-display font-extrabold italic text-[21px]">C&apos;est irréversible</h2>
        <p className="m-0 mb-3.5 text-[15px] leading-[1.5] [text-wrap:pretty]">
          Une fois validé, ton classement est scellé jusqu&apos;à la fin de la saison. Tes notes de carnet restent modifiables.
        </p>
        <div className="flex flex-col gap-2">
          <button type="button" onClick={doValidate} className="btn-primary min-h-12 text-base">
            Valider définitivement
          </button>
          <button type="button" onClick={() => setConfirmOpen(false)} className="btn-muted">
            Revenir au brouillon
          </button>
        </div>
      </Modal>
    </div>
  );
}

function SlotButton({
  c,
  selected,
  editable,
  eliminatedAt,
  hasNote,
  onClick,
}: {
  c: Contestant | null;
  selected: boolean;
  editable: boolean;
  eliminatedAt: number | null;
  hasNote: boolean;
  onClick: () => void;
}) {
  const inner = (
    <>
      {c ? <Pastille name={c.full_name} photo={c.photo_url} size={30} tone={eliminatedAt ? "grey" : "violet"} /> : null}
      <span className={`flex-1 min-w-0 text-left text-[15px] font-medium whitespace-nowrap overflow-hidden text-ellipsis ${eliminatedAt ? "line-through text-ink-2" : ""}`}>
        {c ? c.full_name : "Place libre"}
      </span>
      {c ? <MyStars contestantId={c.id} size={12} compact /> : null}
      {eliminatedAt ? <span className="badge-ko">{eliminatedAt === 1 ? "vainqueur" : `sorti ${ord(eliminatedAt)}`}</span> : null}
      {hasNote ? (
        <svg viewBox="0 0 24 24" width="16" height="16" aria-label="carnet rempli" className="shrink-0">
          <path d="M6 3h9l4 4v14H6z" fill="none" stroke="#B07607" strokeWidth="1.8" />
          <path d="M9 11h7M9 15h5" stroke="#B07607" strokeWidth="1.8" />
        </svg>
      ) : null}
    </>
  );
  const cls = `flex-1 min-w-0 flex items-center gap-2.5 min-h-11 px-2 rounded-sm border ${
    c ? "border-solid border-line bg-surface text-ink" : "border-dashed border-violet-line bg-transparent text-ink-2"
  }`;
  if (!editable) {
    return <span className={cls}>{inner}</span>;
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={`${cls} cursor-pointer`}>
      {inner}
    </button>
  );
}
