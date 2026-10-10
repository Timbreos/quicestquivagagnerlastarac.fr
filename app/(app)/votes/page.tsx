"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pastille } from "@/components/ui/Pastille";
import { MyStars } from "@/components/carnet/Carnet";
import { EmptyBox, Loading, PageTitle } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { eliminationOf, phaseIsRevealed } from "@/lib/derive";
import { shortName } from "@/lib/format";
import type { RankingItemPublic } from "@/lib/types";

export default function VotesPage() {
  const store = useSeason();
  const season = store.season;
  const [phase, setPhase] = useState<1 | 2>(1);
  const [rows, setRows] = useState<RankingItemPublic[] | null>(null);
  const revealed1 = phaseIsRevealed(season, 1);
  const revealed2 = phaseIsRevealed(season, 2);

  useEffect(() => {
    if (!season) return;
    let cancelled = false;
    supabase()
      .from("ranking_items_public")
      .select("*")
      .eq("season_id", season.id)
      .eq("phase", phase)
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as RankingItemPublic[]);
      });
    return () => {
      cancelled = true;
    };
  }, [season, phase, store.leaderboard]);

  const byId = useMemo(() => new Map(store.contestants.map((c) => [c.id, c])), [store.contestants]);
  const columns = useMemo(() => {
    if (!rows) return [];
    const byUser = new Map<string, RankingItemPublic[]>();
    for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
    return store.profiles
      .filter((p) => byUser.has(p.id))
      .map((p) => ({ profile: p, items: (byUser.get(p.id) ?? []).sort((a, b) => a.position - b.position) }));
  }, [rows, store.profiles]);

  if (!season) return <Loading />;
  const revealed = phase === 1 ? revealed1 : revealed2;

  return (
    <div className="p-4 flex flex-col gap-3.5">
      <PageTitle title="Les votes" sub={revealed ? "Les classements de tous, côte à côte. Les carnets privés restent privés." : "Révélés quand l'organisateur valide la phase. En attendant, tu ne vois que le tien."} />
      {season.p2_opens_at ? (
        <div role="group" aria-label="Phase" className="flex gap-1 bg-surface border border-line rounded-md p-1 self-start">
          {([1, 2] as const).map((p) => (
            <button key={p} type="button" aria-pressed={phase === p} onClick={() => setPhase(p)} className={`min-h-11 px-4 rounded-[10px] text-sm font-semibold ${phase === p ? "bg-violet text-white" : "text-ink-2"}`}>
              Phase {p}
            </button>
          ))}
        </div>
      ) : null}
      {rows === null ? (
        <Loading />
      ) : columns.length === 0 ? (
        <EmptyBox title="Rien à voir pour l'instant">Aucun classement validé{revealed ? "" : " ou révélé"} pour cette phase.</EmptyBox>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2.5">
          {columns.map(({ profile, items }) => (
            <section key={profile.id} className="flex-[0_0_190px] card rounded-2xl overflow-hidden">
              <div className="px-3 py-2.5 border-b border-line flex items-center gap-2">
                <Pastille name={profile.display_name} photo={profile.avatar_url} size={26} />
                <span className="font-display font-bold text-sm">
                  {profile.display_name}
                  {profile.id === store.profile?.id ? " (toi)" : ""}
                </span>
              </div>
              <ol className="list-none m-0 p-1.5">
                {items.map((it) => {
                  const c = byId.get(it.contestant_id);
                  const gone = c ? eliminationOf(store.eliminations, c.id) : undefined;
                  return (
                    <li key={it.contestant_id} className={`flex items-center gap-2 px-1 py-[5px] rounded-[8px] ${gone ? "bg-ko-veil text-ko" : it.position <= 3 ? "bg-gold-veil" : ""}`}>
                      <span className="w-5 text-[11px] text-ink-2 text-right">{it.position}</span>
                      <Link href={`/eleves/?id=${it.contestant_id}`} className={`flex-1 min-w-0 text-[13px] whitespace-nowrap overflow-hidden text-ellipsis no-underline ${gone ? "text-ko" : "text-ink"}`}>
                        {c ? shortName(c.full_name) : "?"}
                      </Link>
                      <MyStars contestantId={it.contestant_id} size={10} compact />
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
