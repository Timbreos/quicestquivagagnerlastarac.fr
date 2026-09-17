"use client";

import { useEffect, useState } from "react";
import { Panel, useAction } from "@/components/admin/common";
import { ErrorBox } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { ord } from "@/lib/format";
import type { ScoringRule } from "@/lib/types";

export function RulesPanel() {
  const store = useSeason();
  const { busy, error, run } = useAction();
  const [draft, setDraft] = useState<Record<string, { points_exact: string; points_nominated: string }>>({});
  const locked = store.eliminations.length > 0;

  useEffect(() => {
    const d: typeof draft = {};
    for (const r of store.scoringRules) d[r.id] = { points_exact: String(r.points_exact), points_nominated: String(r.points_nominated) };
    setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.scoringRules]);

  async function saveAll() {
    await run(async () => {
      for (const r of store.scoringRules) {
        const d = draft[r.id];
        if (!d) continue;
        const pe = Number(d.points_exact);
        const pn = Number(d.points_nominated);
        if (pe !== r.points_exact || pn !== r.points_nominated) {
          const res = await supabase().from("scoring_rules").update({ points_exact: pe, points_nominated: pn }).eq("id", r.id);
          if (res.error) return res;
        }
      }
      await store.refresh();
    });
  }

  const n = store.contestants.length || 17;
  const label = (r: ScoringRule) => (r.phase === 0 ? "Pronostic hebdo (bonus)" : r.exit_place_min === r.exit_place_max ? `${ord(r.exit_place_min)} place` : `${ord(Math.min(r.exit_place_max, n))} à ${ord(r.exit_place_min)}`);
  const groups: Array<[string, ScoringRule[]]> = [
    ["Phase 1", store.scoringRules.filter((r) => r.phase === 1).sort((a, b) => b.exit_place_min - a.exit_place_min)],
    ["Phase 2", store.scoringRules.filter((r) => r.phase === 2).sort((a, b) => b.exit_place_min - a.exit_place_min)],
    ["Bonus", store.scoringRules.filter((r) => r.phase === 0)],
  ];

  return (
    <Panel title="Barème" sub={locked ? "Des sorties sont déjà scorées : un changement recalcule toute la saison, instantanément. À manier en accord avec le groupe." : "Modifiable avant le premier prime sans toucher une ligne de code."}>
      {error ? <ErrorBox message={error} /> : null}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {groups.map(([title, rules]) => (
          <div key={title}>
            <h3 className="m-0 mb-1.5 text-sm font-semibold">{title}</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-xs text-ink-2">
                  <th scope="col" className="text-left font-semibold py-1">Place</th>
                  <th scope="col" className="text-right font-semibold py-1">Exact</th>
                  {title !== "Bonus" ? <th scope="col" className="text-right font-semibold py-1">Nominé</th> : null}
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <th scope="row" className="text-left font-medium py-1 border-t border-page">{label(r)}</th>
                    <td className="text-right py-1 border-t border-page">
                      <label htmlFor={`pe-${r.id}`} className="sr-only-label">Points exact</label>
                      <input id={`pe-${r.id}`} type="number" min={0} value={draft[r.id]?.points_exact ?? ""} onChange={(e) => setDraft({ ...draft, [r.id]: { ...draft[r.id], points_exact: e.target.value } })} className="field w-20 min-h-9 text-right" />
                    </td>
                    {title !== "Bonus" ? (
                      <td className="text-right py-1 border-t border-page">
                        <label htmlFor={`pn-${r.id}`} className="sr-only-label">Points nominé</label>
                        <input id={`pn-${r.id}`} type="number" min={0} value={draft[r.id]?.points_nominated ?? ""} onChange={(e) => setDraft({ ...draft, [r.id]: { ...draft[r.id], points_nominated: e.target.value } })} className="field w-20 min-h-9 text-right" />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <button type="button" disabled={busy} onClick={saveAll} className="btn-primary self-start text-sm">
        Enregistrer le barème
      </button>
    </Panel>
  );
}
