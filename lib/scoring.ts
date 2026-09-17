// Mise en mots des lignes de points calculées par Postgres (vue score_events).
// Aucun calcul ici : on décrit ce que la base a décidé, et pourquoi.

import { firstName, ord } from "@/lib/format";
import type { Contestant, Elimination, ScoreEvent, Week } from "@/lib/types";

export type ScoreLine = {
  key: string;
  text: string;
  points: number;
  scored: boolean;
  source: "ranking" | "pick";
  phase: number;
  outcome: ScoreEvent["outcome"];
};

export type WeekBlock = {
  week: Week;
  eliminations: Elimination[];
  lines: ScoreLine[];
  total: number;
  pending: boolean; // au moins une sortie hors scoring
};

type Ctx = {
  contestants: Map<string, Contestant>;
  eliminations: Elimination[];
  /** « Ta » (joueur connecté) ou « Sa » (autre joueur). */
  possessive?: "Ta" | "Sa";
};

function name(ctx: Ctx, id: string): string {
  const c = ctx.contestants.get(id);
  return c ? firstName(c.full_name) : "?";
}

export function describeEvent(e: ScoreEvent, ctx: Ctx): string {
  const who = ctx.possessive ?? "Ta";
  const placed = name(ctx, e.placed_contestant_id);
  const out = name(ctx, e.eliminated_contestant_id);
  if (e.source === "pick") {
    return e.outcome === "pick_hit"
      ? `Pronostic : ${placed} — bonne pioche`
      : `Pronostic : ${placed} — raté, c'est ${out} qui sort`;
  }
  const prefix = e.phase === 2 ? `Phase 2, ${who.toLowerCase()} ${ord(e.exit_place)}` : `${who} ${ord(e.exit_place)}`;
  if (e.outcome === "exact") return `${prefix} : ${placed} — place exacte`;
  if (e.outcome === "nominated") return `${prefix} : ${placed} — dans les nominés`;
  const placedElim = ctx.eliminations.find((x) => x.contestant_id === e.placed_contestant_id);
  if (placedElim && placedElim.exit_place > e.exit_place) return `${prefix} : ${placed} — déjà hors jeu`;
  return `${prefix} : ${placed} — ni sur le départ, ni dans les nominés`;
}

/** Titre d'une sortie : « Farah Benali — 17e place » ; place 1 = victoire. */
export function eliminationTitle(e: Elimination, contestants: Map<string, Contestant>): string {
  const c = contestants.get(e.contestant_id);
  const n = c?.full_name ?? "?";
  if (e.exit_place === 1) return `${n} — gagne la saison`;
  return `${n} — ${ord(e.exit_place)} place`;
}

export function toLines(events: ScoreEvent[], ctx: Ctx): ScoreLine[] {
  // Un seul pronostic par semaine : en cas de double sortie, on garde la bonne pioche si elle existe.
  const picksByWeek = new Map<string, ScoreEvent>();
  const others: ScoreEvent[] = [];
  for (const e of events) {
    if (e.source !== "pick") {
      others.push(e);
      continue;
    }
    const cur = picksByWeek.get(e.week_id);
    if (!cur || (cur.outcome !== "pick_hit" && e.outcome === "pick_hit")) picksByWeek.set(e.week_id, e);
  }
  const all = [...others, ...picksByWeek.values()].sort((a, b) => {
    if (a.exit_place !== b.exit_place) return b.exit_place - a.exit_place;
    if (a.source !== b.source) return a.source === "ranking" ? -1 : 1;
    return a.phase - b.phase;
  });
  return all.map((e) => ({
    key: `${e.elimination_id}-${e.source}-${e.phase}`,
    text: describeEvent(e, ctx),
    points: e.points,
    scored: e.is_scored,
    source: e.source,
    phase: e.phase,
    outcome: e.outcome,
  }));
}

export function groupByWeek(events: ScoreEvent[], weeks: Week[], eliminations: Elimination[], ctx: Ctx): WeekBlock[] {
  return [...weeks]
    .sort((a, b) => b.number - a.number)
    .map((week) => {
      const evs = events.filter((e) => e.week_id === week.id);
      const lines = toLines(evs, ctx);
      const elims = eliminations.filter((e) => e.week_id === week.id).sort((a, b) => b.exit_place - a.exit_place);
      return {
        week,
        eliminations: elims,
        lines,
        total: lines.filter((l) => l.scored).reduce((s, l) => s + l.points, 0),
        pending: elims.some((e) => !e.is_scored),
      };
    });
}
