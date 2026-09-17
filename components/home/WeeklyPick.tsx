"use client";

import { useState } from "react";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { currentWeek, nomineesOf } from "@/lib/derive";
import { firstName } from "@/lib/format";

/** Tout ce qu'il faut savoir sur le pronostic hebdo du joueur connecté. */
export function useWeeklyPick() {
  const store = useSeason();
  const week = currentWeek(store.weeks);
  const nominees = nomineesOf(week, store.nominations);
  const closed = Boolean(week?.picks_closed_at);
  const decided = Boolean(week && store.eliminations.some((e) => e.week_id === week.id));
  const mine = week ? store.picks.find((p) => p.week_id === week.id && p.user_id === store.profile?.id) ?? null : null;
  const hasP1 = store.myRankings.some((r) => r.phase === 1 && r.submitted_at);
  return { week, nominees, closed, decided, mine, canPick: Boolean(week) && nominees.length > 0 && !closed && hasP1 };
}

/** Boutons de pronostic, un par nominé. Tap = poser ou changer. */
export function NomineeButtons({ onDark = false }: { onDark?: boolean }) {
  const store = useSeason();
  const { week, nominees, mine, canPick } = useWeeklyPick();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!week || nominees.length === 0) return null;

  async function pick(contestantId: string) {
    if (!store.profile || !week || !canPick) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase()
      .from("weekly_picks")
      .upsert({ week_id: week.id, user_id: store.profile.id, contestant_id: contestantId }, { onConflict: "week_id,user_id" });
    setBusy(false);
    if (error) setError(error.message);
    else await store.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {nominees.map((id) => {
          const c = store.contestants.find((x) => x.id === id);
          const active = mine?.contestant_id === id;
          return (
            <button
              key={id}
              type="button"
              disabled={busy || !canPick}
              aria-pressed={active}
              onClick={() => pick(id)}
              className={`btn text-[15px] font-display font-extrabold disabled:opacity-80 ${
                active
                  ? "bg-gold text-ink border-0"
                  : onDark
                    ? "bg-white/10 text-white border border-violet hover:bg-white/20"
                    : "bg-surface text-violet border border-line hover:bg-violet-veil"
              }`}
            >
              {c ? firstName(c.full_name) : "?"}
              {active ? " ✓" : ""}
            </button>
          );
        })}
      </div>
      {error ? <p className={`m-0 mt-2 text-xs ${onDark ? "text-gold" : "text-ko"}`}>{error}</p> : null}
    </div>
  );
}
