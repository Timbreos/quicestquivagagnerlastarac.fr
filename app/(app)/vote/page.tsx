"use client";

import { useState } from "react";
import { VoteScreen } from "@/components/vote/VoteScreen";
import { Loading, PageTitle } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { activeVotePhase } from "@/lib/derive";

export default function VotePage() {
  const store = useSeason();
  const [tab, setTab] = useState<1 | 2 | null>(null);
  if (!store.season) return <Loading />;
  const hasP2 = Boolean(store.season.p2_opens_at);
  const phase: 1 | 2 = tab ?? activeVotePhase(store.season);
  const n = phase === 1 ? store.contestants.length : store.season.phase2_threshold;

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <PageTitle
        title="Mon classement"
        sub={phase === 1 ? `Place les ${n} élèves de la 1re à la ${ord(n)}. On tape, on ne glisse pas.` : `Reclasse les ${n} derniers. Même geste, points divisés par deux.`}
      />
      {hasP2 ? (
        <div role="group" aria-label="Phase" className="flex gap-1 bg-surface border border-line rounded-md p-1 self-start">
          {([1, 2] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={phase === p}
              onClick={() => setTab(p)}
              className={`min-h-11 px-4 rounded-[10px] text-sm font-semibold whitespace-nowrap ${phase === p ? "bg-violet text-white" : "text-ink-2"}`}
            >
              Phase {p}
            </button>
          ))}
        </div>
      ) : null}
      <VoteScreen key={phase} phase={phase} />
    </div>
  );
}

function ord(n: number) {
  return n === 1 ? "1re" : `${n}e`;
}
