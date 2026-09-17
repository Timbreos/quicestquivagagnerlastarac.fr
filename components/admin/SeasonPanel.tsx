"use client";

import { useState } from "react";
import { ConfirmButton, Panel, useAction } from "@/components/admin/common";
import { ErrorBox } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { remainingContestants } from "@/lib/derive";
import { longDateTime } from "@/lib/format";
import type { Season } from "@/lib/types";

const STATUS_LABEL: Record<Season["status"], string> = {
  preparation: "Préparation",
  vote_p1: "Vote phase 1",
  p1_revelee: "Phase 1 révélée",
  en_cours: "En cours",
  vote_p2: "Vote phase 2",
  terminee: "Terminée",
};

export function SeasonPanel() {
  const store = useSeason();
  const season = store.season;
  const { busy, error, run } = useAction();
  const [newName, setNewName] = useState("");
  const [threshold, setThreshold] = useState<string>(season ? String(season.phase2_threshold) : "8");

  async function patch(values: Partial<Season>) {
    if (!season) return;
    await run(async () => {
      const r = await supabase().from("seasons").update(values).eq("id", season.id);
      if (!r.error) await store.refresh();
      return r;
    });
  }

  async function createSeason(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      const r = await supabase().from("seasons").insert({ name: newName.trim() }).select("id").single();
      if (!r.error && r.data) {
        setNewName("");
        await store.refresh();
        store.selectSeason(r.data.id);
      }
      return r;
    });
  }

  const remaining = remainingContestants(store.contestants, store.eliminations).length;
  const hasRankings = store.leaderboard.some((r) => r.has_submitted);

  return (
    <Panel title="Saison" sub="Créer, ouvrir et fermer les phases. Tout le verrouillage est manuel : un bouton au bon moment.">
      {error ? <ErrorBox message={error} /> : null}
      {season ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-bold text-[17px]">{season.name}</span>
            <span className="badge-gold">{STATUS_LABEL[season.status]}</span>
            <span className="text-xs text-ink-2">
              {store.contestants.length} élèves · {remaining} en lice · {hasRankings ? "classements validés" : "aucun classement validé"}
            </span>
          </div>

          <PhaseRow
            title="Phase 1 — classement complet"
            opens={season.p1_opens_at}
            closes={season.p1_closes_at}
            revealed={season.p1_revealed_at}
            busy={busy}
            canOpen={store.contestants.length >= 2}
            openHint={store.contestants.length < 2 ? "Saisis d'abord les élèves." : "Ouvre le vote : les joueurs classent et commentent."}
            onOpen={() => patch({ p1_opens_at: new Date().toISOString(), p1_closes_at: null })}
            onClose={() => patch({ p1_closes_at: new Date().toISOString() })}
            onReopen={() => patch({ p1_closes_at: null })}
            onReveal={() => patch({ p1_revealed_at: new Date().toISOString() })}
          />
          <PhaseRow
            title={`Phase 2 — les ${season.phase2_threshold} derniers`}
            opens={season.p2_opens_at}
            closes={season.p2_closes_at}
            revealed={season.p2_revealed_at}
            busy={busy}
            canOpen={Boolean(season.p1_revealed_at) && remaining <= season.phase2_threshold}
            openHint={
              !season.p1_revealed_at
                ? "Après la révélation de la phase 1."
                : remaining > season.phase2_threshold
                  ? `S'ouvre quand il reste ${season.phase2_threshold} élèves (${remaining} aujourd'hui).`
                  : "Les joueurs reclassent les restants, à points réduits."
            }
            onOpen={() => patch({ p2_opens_at: new Date().toISOString(), p2_closes_at: null })}
            onClose={() => patch({ p2_closes_at: new Date().toISOString() })}
            onReopen={() => patch({ p2_closes_at: null })}
            onReveal={() => patch({ p2_revealed_at: new Date().toISOString() })}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void patch({ phase2_threshold: Number(threshold) });
            }}
            className="flex flex-wrap items-end gap-2"
          >
            <div>
              <label htmlFor="threshold" className="label">
                Seuil de la phase 2
              </label>
              <input id="threshold" type="number" min={2} max={Math.max(2, store.contestants.length)} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="field w-28" disabled={Boolean(season.p2_opens_at)} />
            </div>
            <button type="submit" disabled={busy || Boolean(season.p2_opens_at)} className="btn-secondary text-sm">
              Enregistrer
            </button>
          </form>
        </>
      ) : (
        <p className="m-0 text-sm text-ink-2">Aucune saison. Crée la première ci-dessous.</p>
      )}

      <form onSubmit={createSeason} className="flex flex-wrap items-end gap-2 pt-2 border-t border-page">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="season-name" className="label">
            Nouvelle saison
          </label>
          <input id="season-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Saison 14 — 2026" className="field" />
        </div>
        <ConfirmButton label="Créer la saison" confirmLabel="Confirmer la création" onConfirm={() => createSeason({ preventDefault() {} } as React.FormEvent)} disabled={busy || !newName.trim()} className="btn-primary" />
      </form>
      <p className="m-0 text-xs text-ink-2">Une nouvelle saison repart d&apos;un fil de chat vierge et d&apos;un barème par défaut. L&apos;ancienne reste consultable.</p>
    </Panel>
  );
}

function PhaseRow({
  title,
  opens,
  closes,
  revealed,
  busy,
  canOpen,
  openHint,
  onOpen,
  onClose,
  onReopen,
  onReveal,
}: {
  title: string;
  opens: string | null;
  closes: string | null;
  revealed: string | null;
  busy: boolean;
  canOpen: boolean;
  openHint: string;
  onOpen: () => void;
  onClose: () => void;
  onReopen: () => void;
  onReveal: () => void;
}) {
  const state = revealed ? "révélée" : closes ? "fermée" : opens ? "ouverte" : "à venir";
  const badge = revealed ? "badge-ok" : closes ? "badge-ko" : opens ? "badge-violet" : "badge-gold";
  const detail = revealed ? `Révélée ${longDateTime(revealed)}` : closes ? `Fermée ${longDateTime(closes)}` : opens ? `Ouverte ${longDateTime(opens)}` : openHint;
  return (
    <div className="flex flex-wrap items-center gap-2.5 p-2.5 border border-line rounded-sm">
      <span className="flex-1 min-w-[200px]">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[13px] text-ink-2">{detail}</span>
      </span>
      <span className={badge}>{state}</span>
      <span className="flex flex-wrap gap-1.5">
        {!opens ? (
          <button type="button" disabled={busy || !canOpen} onClick={onOpen} className="btn-primary text-sm">
            Ouvrir le vote
          </button>
        ) : null}
        {opens && !closes ? (
          <ConfirmButton label="Fermer le vote" confirmLabel="Fermer : plus aucune écriture" onConfirm={onClose} disabled={busy} className="btn-danger" />
        ) : null}
        {closes && !revealed ? (
          <>
            <ConfirmButton label="Révéler les votes" confirmLabel="Révéler à tous, définitivement" onConfirm={onReveal} disabled={busy} className="btn-gold" />
            <button type="button" disabled={busy} onClick={onReopen} className="btn-muted text-sm">
              Rouvrir
            </button>
          </>
        ) : null}
      </span>
    </div>
  );
}
