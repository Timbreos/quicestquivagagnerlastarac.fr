// Dérivations pures à partir des données de saison. Aucun calcul de points ici :
// les points viennent de Postgres (vues score_events et leaderboard).

import type { Contestant, Elimination, LeaderboardRow, Nomination, Season, Week } from "@/lib/types";

export type ContestantStatus =
  | { kind: "eliminated"; exit_place: number; is_scored: boolean }
  | { kind: "nominated" }
  | { kind: "in_race" };

export function currentWeek(weeks: Week[]): Week | null {
  return weeks.length ? weeks.reduce((a, b) => (b.number > a.number ? b : a)) : null;
}

export function eliminationOf(eliminations: Elimination[], contestantId: string): Elimination | undefined {
  return eliminations.find((e) => e.contestant_id === contestantId);
}

export function remainingContestants(contestants: Contestant[], eliminations: Elimination[]): Contestant[] {
  const gone = new Set(eliminations.map((e) => e.contestant_id));
  return contestants.filter((c) => !gone.has(c.id));
}

export function nomineesOf(week: Week | null, nominations: Nomination[]): string[] {
  if (!week) return [];
  return nominations.filter((n) => n.week_id === week.id).map((n) => n.contestant_id);
}

export function contestantStatus(
  c: Contestant,
  eliminations: Elimination[],
  currentNominees: string[],
): ContestantStatus {
  const e = eliminationOf(eliminations, c.id);
  if (e) return { kind: "eliminated", exit_place: e.exit_place, is_scored: e.is_scored };
  if (currentNominees.includes(c.id)) return { kind: "nominated" };
  return { kind: "in_race" };
}

export function phaseIsOpen(season: Season | null, phase: 1 | 2): boolean {
  if (!season) return false;
  return phase === 1
    ? season.p1_opens_at !== null && season.p1_closes_at === null
    : season.p2_opens_at !== null && season.p2_closes_at === null;
}

export function phaseIsRevealed(season: Season | null, phase: 1 | 2): boolean {
  if (!season) return false;
  return phase === 1 ? season.p1_revealed_at !== null : season.p2_revealed_at !== null;
}

/** Phase de vote en cours pour l'écran /vote : 2 si ouverte, sinon 1. */
export function activeVotePhase(season: Season | null): 1 | 2 {
  return season?.p2_opens_at ? 2 : 1;
}

/** Classement général trié : validés d'abord, total, puis exacts, puis nom. */
export function sortLeaderboard(rows: LeaderboardRow[]): LeaderboardRow[] {
  return [...rows].sort((a, b) => {
    if (a.has_submitted !== b.has_submitted) return a.has_submitted ? -1 : 1;
    if (b.total_points !== a.total_points) return b.total_points - a.total_points;
    if (b.exact_count !== a.exact_count) return b.exact_count - a.exact_count;
    return a.display_name.localeCompare(b.display_name, "fr");
  });
}

/** Rang avec ex æquo assumés (1, 2, 2, 4). Les non-validés n'ont pas de rang. */
export function ranksOf(sorted: LeaderboardRow[]): Map<string, number | null> {
  const m = new Map<string, number | null>();
  let rank = 0;
  let prev: LeaderboardRow | null = null;
  sorted.forEach((r, i) => {
    if (!r.has_submitted) {
      m.set(r.user_id, null);
      return;
    }
    if (!prev || prev.total_points !== r.total_points || prev.exact_count !== r.exact_count) rank = i + 1;
    m.set(r.user_id, rank);
    prev = r;
  });
  return m;
}

/** Prochaine place de sortie à saisir : nombre d'élèves encore en lice. */
export function nextExitPlace(contestants: Contestant[], eliminations: Elimination[]): number {
  return remainingContestants(contestants, eliminations).length;
}
