"use client";

import { useState } from "react";
import { ConfirmButton, Panel, useAction } from "@/components/admin/common";
import { Pastille } from "@/components/ui/Pastille";
import { ErrorBox } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { currentWeek, nextExitPlace, nomineesOf, remainingContestants } from "@/lib/derive";
import { fromLocalInput, longDateTime, ord, toLocalInput } from "@/lib/format";
import { eliminationTitle } from "@/lib/scoring";

/**
 * Le rythme d'une semaine : nominés en quotidienne, fermeture des pronostics,
 * saisie de l'éliminé le samedi soir. Deux actions, trente secondes, au téléphone.
 */
export function WeekPanel() {
  const store = useSeason();
  const season = store.season;
  const { busy, error, run } = useAction();
  const week = currentWeek(store.weeks);
  const nominees = nomineesOf(week, store.nominations);
  const remaining = remainingContestants(store.contestants, store.eliminations);
  const [primeAt, setPrimeAt] = useState("");
  const [addNominee, setAddNominee] = useState("");
  const [elimId, setElimId] = useState("");
  const [unscored, setUnscored] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const contestants = new Map(store.contestants.map((c) => [c.id, c]));
  const weekElims = week ? store.eliminations.filter((e) => e.week_id === week.id) : [];
  const exitPlace = nextExitPlace(store.contestants, store.eliminations);
  const picksClosed = Boolean(week?.picks_closed_at);

  if (!season) return null;
  const sid = season.id;
  const canPlay = Boolean(season.p1_revealed_at);

  async function createWeek(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const r = await supabase()
        .from("weeks")
        .insert({ season_id: sid, number: (week?.number ?? 0) + 1, prime_at: fromLocalInput(primeAt) });
      if (!r.error) {
        setPrimeAt("");
        await store.refresh();
      }
      return r;
    });
  }

  async function updatePrime(v: string) {
    if (!week) return;
    await run(async () => {
      const r = await supabase().from("weeks").update({ prime_at: fromLocalInput(v) }).eq("id", week.id);
      if (!r.error) await store.refresh();
      return r;
    });
  }

  async function nominate(cid: string) {
    if (!week || !cid) return;
    await run(async () => {
      const r = await supabase().from("nominations").insert({ week_id: week.id, contestant_id: cid });
      if (!r.error) {
        setAddNominee("");
        await store.refresh();
      }
      return r;
    });
  }

  async function unnominate(cid: string) {
    if (!week) return;
    await run(async () => {
      const r = await supabase().from("nominations").delete().match({ week_id: week.id, contestant_id: cid });
      if (!r.error) await store.refresh();
      return r;
    });
  }

  async function setPicks(closed: boolean) {
    if (!week) return;
    await run(async () => {
      const r = await supabase().from("weeks").update({ picks_closed_at: closed ? new Date().toISOString() : null }).eq("id", week.id);
      if (!r.error) await store.refresh();
      return r;
    });
  }

  async function publish() {
    if (!week || !elimId) return;
    await run(async () => {
      const r = await supabase()
        .from("eliminations")
        .insert({ week_id: week.id, contestant_id: elimId, exit_place: exitPlace, is_scored: !unscored, reason: abandon ? "abandon" : "elimination" });
      if (!r.error) {
        setElimId("");
        setUnscored(false);
        setAbandon(false);
        await store.refresh();
      }
      return r;
    });
  }

  async function toggleScored(id: string, is_scored: boolean) {
    await run(async () => {
      const r = await supabase().from("eliminations").update({ is_scored }).eq("id", id);
      if (!r.error) await store.refresh();
      return r;
    });
  }

  async function setReason(id: string, reason: "elimination" | "abandon") {
    await run(async () => {
      const r = await supabase().from("eliminations").update({ reason }).eq("id", id);
      if (!r.error) await store.refresh();
      return r;
    });
  }

  async function deleteElim(id: string) {
    await run(async () => {
      const r = await supabase().from("eliminations").delete().eq("id", id);
      if (!r.error) await store.refresh();
      return r;
    });
  }

  return (
    <>
      <Panel title={week ? `Semaine ${week.number}` : "Semaines"} sub={canPlay ? "Nominés dans la semaine, fermeture des pronostics, puis l'éliminé le soir du prime." : "Les semaines s'ouvrent après la révélation de la phase 1."}>
        {error ? <ErrorBox message={error} /> : null}
        {week ? (
          <>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label htmlFor="prime-at" className="label">
                  Prime
                </label>
                <input id="prime-at" type="datetime-local" defaultValue={toLocalInput(week.prime_at)} onBlur={(e) => e.target.value !== toLocalInput(week.prime_at) && updatePrime(e.target.value)} className="field" />
              </div>
              <span className="text-[13px] text-ink-2 pb-3">{week.prime_at ? longDateTime(week.prime_at) : "Heure non renseignée"}</span>
            </div>

            <div>
              <h3 className="m-0 mb-1.5 text-sm font-semibold">Nominés de la semaine</h3>
              <div className="flex flex-col gap-2">
                {nominees.map((id) => {
                  const c = contestants.get(id);
                  return (
                    <span key={id} className="flex items-center gap-2.5 bg-violet-veil border border-violet-line rounded-sm px-2.5 py-2">
                      <Pastille name={c?.full_name ?? "?"} photo={c?.photo_url} size={26} />
                      <span className="flex-1 text-sm font-medium">{c?.full_name}</span>
                      <button type="button" disabled={busy || weekElims.length > 0} onClick={() => unnominate(id)} className="btn bg-surface text-ko border border-violet-line text-sm hover:bg-ko-veil">
                        Retirer
                      </button>
                    </span>
                  );
                })}
                {weekElims.length === 0 ? (
                  <div className="flex gap-2">
                    <label htmlFor="add-nominee" className="sr-only-label">
                      Ajouter un nominé
                    </label>
                    <select id="add-nominee" value={addNominee} onChange={(e) => setAddNominee(e.target.value)} className="field flex-1">
                      <option value="">Ajouter un nominé…</option>
                      {remaining
                        .filter((c) => !nominees.includes(c.id))
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name}
                          </option>
                        ))}
                    </select>
                    <button type="button" disabled={busy || !addNominee} onClick={() => nominate(addNominee)} className="btn-secondary text-sm">
                      Ajouter
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 p-2.5 border border-line rounded-sm">
              <span className="flex-1 min-w-[200px]">
                <span className="block text-sm font-semibold">Pronostics de la semaine</span>
                <span className="block text-[13px] text-ink-2">
                  {picksClosed ? `Fermés ${longDateTime(week.picks_closed_at!)}` : nominees.length ? "Ouverts : les joueurs désignent qui part." : "S'ouvrent avec la saisie des nominés."}
                </span>
              </span>
              <span className={picksClosed ? "badge-ko" : "badge-violet"}>{picksClosed ? "fermés" : "ouverts"}</span>
              {picksClosed ? (
                <button type="button" disabled={busy || weekElims.length > 0} onClick={() => setPicks(false)} className="btn-muted text-sm">
                  Rouvrir
                </button>
              ) : (
                <button type="button" disabled={busy} onClick={() => setPicks(true)} className="btn-primary text-sm">
                  Fermer les pronostics
                </button>
              )}
            </div>

            <div className="bg-page border border-line rounded-sm p-3 flex flex-col gap-2.5">
              <h3 className="m-0 text-sm font-semibold">Saisir la sortie</h3>
              <div role="group" aria-label="Type de sortie" className="flex gap-1 bg-surface border border-line rounded-md p-1 self-start">
                {([false, true] as const).map((ab) => (
                  <button
                    key={String(ab)}
                    type="button"
                    aria-pressed={abandon === ab}
                    onClick={() => setAbandon(ab)}
                    className={`min-h-10 px-3.5 rounded-[10px] text-sm font-semibold ${abandon === ab ? "bg-violet text-white" : "text-ink-2"}`}
                  >
                    {ab ? "Abandon" : "Élimination"}
                  </button>
                ))}
              </div>
              <p className="m-0 text-[13px] text-ink-2">
                {abandon
                  ? "Abandon : la place exacte rapporte comme d'habitude, mais pas de points « dans les nominés », et les pronostics de la semaine sont neutralisés (sauf ceux qui avaient désigné cet élève). Publiable même pronostics ouverts."
                  : "La publication déclenche le direct sur tous les écrans ouverts. Ferme d'abord les pronostics."}
              </p>
              <div>
                <label htmlFor="elim" className="label">
                  {abandon ? "Élève qui abandonne" : "Élève qui sort"}
                </label>
                <select id="elim" value={elimId} onChange={(e) => setElimId(e.target.value)} className="field">
                  <option value="">Choisir…</option>
                  {[...remaining]
                    .sort((a, b) => Number(nominees.includes(b.id)) - Number(nominees.includes(a.id)))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.full_name}
                        {nominees.includes(c.id) ? " · nominé" : ""}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label htmlFor="exit-place" className="label">
                  Place de sortie (déduite du nombre de restants)
                </label>
                <input id="exit-place" type="number" value={exitPlace} readOnly className="field bg-surface" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={unscored} onChange={(e) => setUnscored(e.target.checked)} className="w-5 h-5 accent-violet" />
                Hors scoring (sortie jugée injouable : plus aucun point)
              </label>
              <ConfirmButton
                label={exitPlace === 1 ? "Publier le vainqueur" : abandon ? "Publier l'abandon" : "Publier l'élimination"}
                confirmLabel={`Confirmer : ${contestants.get(elimId)?.full_name ?? "?"} ${abandon ? "abandonne" : "sort"} ${ord(exitPlace)}`}
                onConfirm={publish}
                disabled={busy || !elimId || (!picksClosed && !abandon)}
                className="btn-danger w-full min-h-12"
              />
              {!picksClosed && !abandon ? <p className="m-0 text-xs text-ko">Ferme les pronostics avant de publier.</p> : null}
            </div>

            {weekElims.length ? (
              <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
                {weekElims.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm p-2 border border-line rounded-sm">
                    <span className="flex-1 font-medium">{eliminationTitle(e, contestants)}</span>
                    <span className={e.is_scored ? "badge-ok" : "badge-gold"}>{e.is_scored ? "scoré" : "hors scoring"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        {canPlay ? (
          <form onSubmit={createWeek} className="flex flex-wrap items-end gap-2 pt-2 border-t border-page">
            <div>
              <label htmlFor="new-prime" className="label">
                {week ? `Semaine ${week.number + 1} · prime le` : "Semaine 1 · prime le"}
              </label>
              <input id="new-prime" type="datetime-local" value={primeAt} onChange={(e) => setPrimeAt(e.target.value)} className="field" />
            </div>
            <button type="submit" disabled={busy} className="btn-secondary text-sm">
              {week ? (weekElims.length ? "Ouvrir la semaine suivante" : "Semaine sans élimination → suivante") : "Créer la semaine 1"}
            </button>
          </form>
        ) : null}
      </Panel>

      {store.eliminations.length ? (
        <Panel title="Toutes les sorties" sub="Un repêchage supprime la sortie : tout est recalculé. « Hors scoring » neutralise un départ sans casser la suite des places.">
          <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
            {[...store.eliminations]
              .sort((a, b) => a.exit_place - b.exit_place)
              .map((e) => {
                const w = store.weeks.find((x) => x.id === e.week_id);
                const isLast = e.exit_place === Math.min(...store.eliminations.map((x) => x.exit_place));
                return (
                  <li key={e.id} className="flex flex-wrap items-center gap-2 text-sm p-2 border border-line rounded-sm">
                    <span className="flex-1 min-w-[180px]">
                      <span className="block font-medium">{eliminationTitle(e, contestants)}</span>
                      <span className="block text-xs text-ink-2">{w ? `Semaine ${w.number} · ` : ""}{longDateTime(e.announced_at)}</span>
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setReason(e.id, e.reason === "abandon" ? "elimination" : "abandon")}
                      className={`${e.reason === "abandon" ? "badge-gold" : "badge-violet"} min-h-9 px-3 cursor-pointer`}
                    >
                      {e.reason === "abandon" ? "abandon · passer en élimination" : "élimination · passer en abandon"}
                    </button>
                    <button type="button" disabled={busy} onClick={() => toggleScored(e.id, !e.is_scored)} className={`${e.is_scored ? "badge-ok" : "badge-gold"} min-h-9 px-3 cursor-pointer`}>
                      {e.is_scored ? "scoré · passer hors scoring" : "hors scoring · rescorer"}
                    </button>
                    {isLast ? <ConfirmButton label="Repêchage" confirmLabel="Supprimer cette sortie" onConfirm={() => deleteElim(e.id)} disabled={busy} /> : null}
                  </li>
                );
              })}
          </ul>
        </Panel>
      ) : null}
    </>
  );
}
