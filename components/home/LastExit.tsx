"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { eliminationTitle, toLines } from "@/lib/scoring";
import { signed } from "@/lib/format";
import type { ScoreEvent } from "@/lib/types";

/** Détail de la dernière sortie pour le joueur connecté, avec rejeu de la séquence. */
export function LastExit() {
  const store = useSeason();
  const last = useMemo(
    () => [...store.eliminations].sort((a, b) => a.announced_at.localeCompare(b.announced_at)).at(-1) ?? null,
    [store.eliminations],
  );
  const [events, setEvents] = useState<ScoreEvent[]>([]);
  const meId = store.profile?.id;

  useEffect(() => {
    if (!last || !meId) return;
    let cancelled = false;
    supabase()
      .from("score_events")
      .select("*")
      .eq("week_id", last.week_id)
      .eq("user_id", meId)
      .then(({ data }) => {
        if (!cancelled) setEvents((data ?? []) as ScoreEvent[]);
      });
    return () => {
      cancelled = true;
    };
  }, [last, meId, store.leaderboard]);

  if (!last) return null;
  const contestants = new Map(store.contestants.map((c) => [c.id, c]));
  const week = store.weeks.find((w) => w.id === last.week_id);
  const sameWeek = store.eliminations.filter((e) => e.week_id === last.week_id).sort((a, b) => b.exit_place - a.exit_place);
  const lines = toLines(events, { contestants, eliminations: store.eliminations });
  const total = lines.filter((l) => l.scored).reduce((s, l) => s + l.points, 0);

  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2.5 mb-2.5">
        <div>
          <h2 className="card-title text-base">{week ? `Dernier prime · semaine ${week.number}` : "Dernier prime"}</h2>
          {sameWeek.map((e) => (
            <p key={e.id} className="m-0 mt-0.5 text-[13px] text-ink-2">
              {eliminationTitle(e, contestants)}
              {!e.is_scored ? " · hors scoring" : ""}
            </p>
          ))}
        </div>
        <span className={`font-display font-extrabold text-lg whitespace-nowrap ${total > 0 ? "text-ok" : "text-ink-2"}`}>{signed(total)} pts</span>
      </div>
      {lines.length ? (
        <ul className="list-none m-0 p-0 flex flex-col gap-2">
          {lines.map((l) => (
            <li key={l.key} className="flex gap-2.5 items-baseline text-sm leading-[1.5]">
              <span className="flex-1 [text-wrap:pretty]">{l.text}</span>
              <span className={`font-display font-bold text-[15px] min-w-[34px] text-right ${l.points > 0 && l.scored ? "text-ok" : "text-ink-2"}`}>
                {l.scored ? signed(l.points) : "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-ink-2">Aucune ligne pour toi sur ce prime.</p>
      )}
      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" onClick={() => store.replayPrime(last)} className="btn-secondary text-sm">
          Revoir la séquence
        </button>
        <Link href="/regles/" className="btn-muted text-sm no-underline">
          Comment on marque
        </Link>
      </div>
    </section>
  );
}
