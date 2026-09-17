"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EmptyBox, Loading, PageTitle } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { phaseIsRevealed } from "@/lib/derive";
import { signed } from "@/lib/format";
import { eliminationTitle, groupByWeek } from "@/lib/scoring";
import type { ScoreEvent } from "@/lib/types";

export default function PointsPage() {
  const store = useSeason();
  const season = store.season;
  const meId = store.profile?.id ?? "";
  const [userId, setUserId] = useState<string>("");
  const [events, setEvents] = useState<ScoreEvent[] | null>(null);
  const target = userId || meId;
  const canPickOthers = phaseIsRevealed(season, 1);

  useEffect(() => {
    if (!season || !target) return;
    let cancelled = false;
    supabase()
      .from("score_events")
      .select("*")
      .eq("season_id", season.id)
      .eq("user_id", target)
      .then(({ data }) => {
        if (!cancelled) setEvents((data ?? []) as ScoreEvent[]);
      });
    return () => {
      cancelled = true;
    };
  }, [season, target, store.leaderboard]);

  const contestants = useMemo(() => new Map(store.contestants.map((c) => [c.id, c])), [store.contestants]);
  const blocks = useMemo(
    () => (events ? groupByWeek(events, store.weeks, store.eliminations, { contestants, eliminations: store.eliminations, possessive: target === meId ? "Ta" : "Sa" }) : []),
    [events, store.weeks, store.eliminations, contestants, target, meId],
  );
  const row = store.leaderboard.find((r) => r.user_id === target);
  const latestWeek = store.weeks.reduce<number>((m, w) => Math.max(m, w.number), 0);
  const primes = new Set(store.eliminations.map((e) => e.week_id)).size;

  if (!season) return <Loading />;

  return (
    <div className="p-4 max-w-[760px] flex flex-col gap-3.5">
      <PageTitle
        title="Détail des points"
        sub={
          row ? (
            <>
              {row.display_name} · {row.has_submitted ? `${row.total_points} points après ${primes} prime${primes > 1 ? "s" : ""}` : "classement non validé, hors saison"}
              {" · "}
              <Link href="/regles/">comment on marque</Link>
            </>
          ) : null
        }
      />
      {canPickOthers ? (
        <div>
          <label htmlFor="player" className="label">
            Joueur
          </label>
          <select id="player" value={target} onChange={(e) => setUserId(e.target.value)} className="field max-w-[280px]">
            {store.leaderboard
              .filter((r) => r.has_submitted)
              .sort((a, b) => a.display_name.localeCompare(b.display_name, "fr"))
              .map((r) => (
                <option key={r.user_id} value={r.user_id}>
                  {r.display_name}
                  {r.user_id === meId ? " (toi)" : ""}
                </option>
              ))}
          </select>
        </div>
      ) : null}
      {events === null ? (
        <Loading />
      ) : blocks.length === 0 ? (
        <EmptyBox title="Aucun prime joué">Les points tombent semaine après semaine, à chaque sortie.</EmptyBox>
      ) : (
        blocks.map((b) => (
          <section key={b.week.id} className="card p-4">
            <div className="flex items-baseline justify-between gap-2.5 mb-2.5">
              <div>
                <h2 className="card-title text-base">Semaine {b.week.number}</h2>
                {b.eliminations.length === 0 ? (
                  <p className="m-0 mt-0.5 text-[13px] text-ink-2">{b.week.number === latestWeek ? "Prime à venir" : "Aucune élimination"}</p>
                ) : (
                  b.eliminations.map((e) => (
                    <p key={e.id} className="m-0 mt-0.5 text-[13px] text-ink-2">
                      {eliminationTitle(e, contestants)}
                      {!e.is_scored ? " · hors scoring" : ""}
                    </p>
                  ))
                )}
              </div>
              <span className={`font-display font-extrabold text-lg whitespace-nowrap ${b.eliminations.length === 0 ? "text-ink-2" : b.total > 0 ? "text-ok" : "text-ko"}`}>
                {b.eliminations.length === 0 ? "—" : `${signed(b.total)} pts`}
              </span>
            </div>
            {b.lines.length ? (
              <ul className="list-none m-0 p-0 flex flex-col gap-2">
                {b.lines.map((l) => (
                  <li key={l.key} className="flex gap-2.5 items-baseline text-sm leading-[1.5]">
                    <span className="flex-1 [text-wrap:pretty]">
                      {l.text}
                      {!l.scored ? <span className="text-ink-2"> · hors scoring</span> : null}
                    </span>
                    <span className={`font-display font-bold text-[15px] min-w-[34px] text-right ${l.scored && l.points > 0 ? "text-ok" : "text-ink-2"}`}>
                      {l.scored ? signed(l.points) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : b.eliminations.length === 0 ? (
              <p className="m-0 text-sm text-ink-2">
                {b.week.number === latestWeek ? "Les points tomberont à la sortie, en direct." : "Personne ne sort, personne ne marque. Le pronostic est reporté."}
              </p>
            ) : (
              <p className="m-0 text-sm text-ink-2">Aucune ligne : pas de classement validé au moment de cette sortie.</p>
            )}
          </section>
        ))
      )}
    </div>
  );
}
