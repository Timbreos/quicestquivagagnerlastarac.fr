"use client";

import { useEffect, useMemo, useState } from "react";
import { Etoile } from "@/components/ui/Etoile";
import { Pastille } from "@/components/ui/Pastille";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { firstName, ord, signed } from "@/lib/format";
import { ranksOf, sortLeaderboard } from "@/lib/derive";
import { describeEvent } from "@/lib/scoring";
import type { LeaderboardRow, ScoreEvent } from "@/lib/types";

const SPARKLES: Array<[number, number, number]> = [
  [6, 9, 14], [18, 72, 10], [31, 22, 7], [44, 88, 16], [57, 12, 9], [68, 58, 12], [76, 32, 8], [86, 80, 11], [92, 46, 7],
];
const STEPS = ["Le nom", "Les points", "Le classement"];
const T_POINTS = 2400;
const T_BOARD = 6200;

/**
 * Le moment du prime : quand l'admin publie l'éliminé, tous les écrans ouverts
 * basculent. Le nom, puis les points de chacun, puis le classement réordonné.
 * Seul endroit du produit où une animation est justifiée.
 */
export function PrimeOverlay() {
  const store = useSeason();
  const e = store.primeEvent;
  const [step, setStep] = useState(0);
  const [run, setRun] = useState(0);
  const [events, setEvents] = useState<ScoreEvent[]>([]);

  useEffect(() => {
    if (!e) return;
    setStep(1);
    const t1 = setTimeout(() => setStep(2), T_POINTS);
    const t2 = setTimeout(() => setStep(3), T_BOARD);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [e, run]);

  useEffect(() => {
    if (!e) return;
    let cancelled = false;
    supabase()
      .from("score_events")
      .select("*")
      .eq("elimination_id", e.id)
      .then(({ data }) => {
        if (!cancelled) setEvents((data ?? []) as ScoreEvent[]);
      });
    return () => {
      cancelled = true;
    };
  }, [e, store.leaderboard]);

  const contestants = useMemo(() => new Map(store.contestants.map((c) => [c.id, c])), [store.contestants]);
  const week = e ? store.weeks.find((w) => w.id === e.week_id) : null;
  const contestant = e ? contestants.get(e.contestant_id) : null;
  const meId = store.profile?.id;

  const gains = useMemo(() => {
    const m = new Map<string, { total: number; reasons: string[] }>();
    for (const ev of events) {
      const g = m.get(ev.user_id) ?? { total: 0, reasons: [] };
      if (ev.is_scored) g.total += ev.points;
      g.reasons.push(describeEvent(ev, { contestants, eliminations: store.eliminations, possessive: ev.user_id === meId ? "Ta" : "Sa" }));
      m.set(ev.user_id, g);
    }
    return m;
  }, [events, contestants, store.eliminations, meId]);

  const after = useMemo(() => sortLeaderboard(store.leaderboard), [store.leaderboard]);
  const before = useMemo(() => {
    const rows: LeaderboardRow[] = store.leaderboard.map((r) => ({
      ...r,
      total_points: r.total_points - (gains.get(r.user_id)?.total ?? 0),
    }));
    return ranksOf(sortLeaderboard(rows));
  }, [store.leaderboard, gains]);
  const afterRanks = useMemo(() => ranksOf(after), [after]);

  if (!e) return null;

  const remaining = store.contestants.length - store.eliminations.length;
  const isWinner = e.exit_place === 1;

  return (
    <div className="fixed inset-0 z-[60] bg-violet-dark text-white flex flex-col overflow-hidden" role="dialog" aria-modal="true" aria-label="Prime en direct">
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        {SPARKLES.map(([top, left, size], k) => (
          <Etoile
            key={k}
            size={size}
            className="absolute animate-twinkle"
            style={{ top: `${top}%`, left: `${left}%`, opacity: 0.5, animationDuration: `${2.4 + k * 0.35}s`, animationDelay: `${k * 0.31}s` }}
          />
        ))}
      </div>
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 h-full w-[34%] pointer-events-none animate-sweep"
        style={{ background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(240,185,59,.10), rgba(255,255,255,0))" }}
      />

      <div className="relative shrink-0 flex items-center justify-between gap-2.5 px-4 py-3 border-b border-violet">
        <span className="inline-flex items-center gap-2 eyebrow text-gold font-semibold">
          <span className="w-2 h-2 rounded-full bg-ko animate-twinkle" />
          {week ? `Prime ${week.number}` : "Prime"} · en direct
        </span>
        <span className="text-xs text-violet-line">
          {remaining} {remaining > 1 ? "élèves en lice" : "élève en lice"}
        </span>
      </div>

      <div className="relative flex-1 min-h-0 flex flex-col items-center justify-center p-5 text-center overflow-y-auto">
        {step === 1 && contestant ? (
          <div className="animate-prime-in">
            <p className="m-0 mb-1.5 inline-flex items-center gap-2.5 text-[13px] font-bold tracking-[.14em] uppercase text-gold">
              <Etoile size={14} className="animate-spin-slow" />
              {isWinner ? "Vainqueur" : "Éliminé·e"}
            </p>
            <h1 className="m-0 font-display font-extrabold italic text-[64px] lg:text-[108px] leading-[.95] tracking-[-0.03em]">
              {firstName(contestant.full_name)}
            </h1>
            <p className="m-0 mt-3.5 font-display font-bold text-[22px] text-gold">
              {isWinner ? "Gagne la saison" : `${ord(e.exit_place)} place`}
              {!e.is_scored ? " · hors scoring" : ""}
            </p>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="w-full max-w-[760px] animate-prime-in">
            <p className="m-0 mb-0.5 text-[13px] text-violet-line">
              {contestant?.full_name}, {isWinner ? "vainqueur" : `${ord(e.exit_place)} place`}
            </p>
            <h2 className="m-0 mb-3.5 font-display font-extrabold italic text-[26px]">Ce que ça rapporte</h2>
            <ul className="list-none m-0 p-0 flex flex-col gap-2 text-left">
              {after
                .filter((r) => r.has_submitted)
                .map((r, k) => {
                  const g = gains.get(r.user_id);
                  const total = g?.total ?? 0;
                  return (
                    <li
                      key={r.user_id}
                      className="flex items-center gap-3 bg-violet-dark border border-violet rounded-md px-3 py-2.5 animate-row-in"
                      style={{ animationDelay: `${k * 0.07}s` }}
                    >
                      <Pastille name={r.display_name} photo={r.avatar_url} size={30} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold">{r.display_name}{r.user_id === meId ? " (toi)" : ""}</span>
                        <span className="block text-[13px] text-violet-line [text-wrap:pretty]">
                          {g?.reasons.length ? g.reasons.join(" · ") : "Aucune ligne pour cette sortie"}
                        </span>
                      </span>
                      <span className={`font-display font-extrabold text-xl min-w-11 text-right ${total > 0 ? "text-gold" : "text-violet-line"}`}>
                        {signed(total)}
                      </span>
                    </li>
                  );
                })}
            </ul>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="w-full max-w-[620px] animate-prime-in">
            <h2 className="m-0 mb-3.5 font-display font-extrabold italic text-[26px]">Nouveau classement</h2>
            <ol className="list-none m-0 p-0 flex flex-col gap-1.5 text-left">
              {after
                .filter((r) => r.has_submitted)
                .map((r, k) => {
                  const g = gains.get(r.user_id)?.total ?? 0;
                  const prev = before.get(r.user_id);
                  const now = afterRanks.get(r.user_id);
                  const delta = prev && now ? prev - now : 0;
                  return (
                    <li
                      key={r.user_id}
                      className={`flex items-center gap-3 border border-violet rounded-sm px-3 py-2.5 animate-row-in ${r.user_id === meId ? "bg-violet" : ""}`}
                      style={{ animationDelay: `${k * 0.07}s` }}
                    >
                      <span className="w-[22px] font-display font-bold text-[15px] text-gold text-right">{now ?? "—"}</span>
                      <span className="flex-1 min-w-0 text-[15px] font-medium">{r.display_name}</span>
                      {delta !== 0 ? (
                        <span className={`text-xs font-semibold ${delta > 0 ? "text-gold" : "text-violet-line"}`} aria-label={delta > 0 ? `gagne ${delta} place` : `perd ${-delta} place`}>
                          {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                        </span>
                      ) : null}
                      <span className="text-[13px] text-violet-line">{signed(g)} ce soir</span>
                      <span className="font-display font-bold text-base min-w-[34px] text-right">{r.total_points}</span>
                    </li>
                  );
                })}
            </ol>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              <button type="button" onClick={() => setRun((n) => n + 1)} className="btn border border-violet bg-transparent text-gold text-sm">
                Rejouer la séquence
              </button>
              <button type="button" onClick={store.dismissPrime} className="btn-gold">
                Retour à l&apos;app
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative shrink-0 flex items-center gap-1.5 px-4 py-3 border-t border-violet">
        {STEPS.map((label, k) => (
          <span
            key={label}
            className={`flex-1 text-center text-xs font-semibold px-1.5 py-2 rounded-[10px] ${step === k + 1 ? "bg-violet text-white" : "text-violet-line"}`}
          >
            {k + 1}. {label}
          </span>
        ))}
        <button type="button" onClick={store.dismissPrime} aria-label="Fermer le direct" className="min-w-11 min-h-11 rounded-[10px] text-violet-line hover:text-white hover:bg-white/10 text-lg">
          ×
        </button>
      </div>
    </div>
  );
}
