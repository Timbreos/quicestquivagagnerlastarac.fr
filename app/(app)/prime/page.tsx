"use client";

import { Loading, PageTitle, EmptyBox } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { longDateTime } from "@/lib/format";
import { eliminationTitle } from "@/lib/scoring";

export default function PrimePage() {
  const store = useSeason();
  if (!store.season) return <Loading />;
  const contestants = new Map(store.contestants.map((c) => [c.id, c]));
  const list = [...store.eliminations].sort((a, b) => b.announced_at.localeCompare(a.announced_at));
  return (
    <div className="p-4 max-w-[720px] flex flex-col gap-3.5">
      <PageTitle title="Les primes" sub="Chaque sortie, rejouable. En direct, la séquence se lance toute seule sur tous les écrans ouverts." />
      {list.length === 0 ? (
        <EmptyBox title="Aucune sortie pour l'instant">La première séquence se déclenche au premier prime.</EmptyBox>
      ) : (
        <ul className="list-none m-0 p-0 flex flex-col gap-2">
          {list.map((e) => {
            const w = store.weeks.find((x) => x.id === e.week_id);
            return (
              <li key={e.id} className="card p-3.5 flex flex-wrap items-center gap-3">
                <span className="flex-1 min-w-0">
                  <span className="block font-display font-bold text-base">{eliminationTitle(e, contestants)}</span>
                  <span className="block text-[13px] text-ink-2">
                    {w ? `Semaine ${w.number} · ` : ""}
                    {longDateTime(e.announced_at)}
                    {!e.is_scored ? " · hors scoring" : ""}
                  </span>
                </span>
                <button type="button" onClick={() => store.replayPrime(e)} className="btn-secondary text-sm">
                  Rejouer la séquence
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
