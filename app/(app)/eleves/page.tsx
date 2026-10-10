"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Pastille } from "@/components/ui/Pastille";
import { CastingGrid } from "@/components/home/CastingGrid";
import { Loading, PageTitle } from "@/components/ui/Feedback";
import { MyStars, NoteField, NoteJournal, StarInput } from "@/components/carnet/Carnet";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { contestantStatus, currentWeek, nomineesOf, phaseIsRevealed } from "@/lib/derive";
import { ord, shortName } from "@/lib/format";
import type { RankingItemPublic } from "@/lib/types";

function FicheEleve() {
  const store = useSeason();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const season = store.season;
  const contestant = id ? store.contestants.find((c) => c.id === id) ?? null : null;
  const [placements, setPlacements] = useState<RankingItemPublic[]>([]);

  useEffect(() => {
    if (!season || !contestant) return;
    let cancelled = false;
    supabase()
      .from("ranking_items_public")
      .select("*")
      .eq("season_id", season.id)
      .eq("contestant_id", contestant.id)
      .then(({ data }) => {
        if (!cancelled) setPlacements((data ?? []) as RankingItemPublic[]);
      });
    return () => {
      cancelled = true;
    };
  }, [season, contestant, store.leaderboard]);

  const nominees = nomineesOf(currentWeek(store.weeks), store.nominations);
  const profiles = useMemo(() => new Map(store.profiles.map((p) => [p.id, p])), [store.profiles]);

  if (!season) return <Loading />;
  if (!contestant) {
    return (
      <div className="p-4 pt-0">
        <CastingGrid title="Tous les élèves" />
      </div>
    );
  }

  const status = contestantStatus(contestant, store.eliminations, nominees);
  const badge =
    status.kind === "eliminated"
      ? { cls: status.exit_place === 1 ? "badge-gold" : "badge-ko", label: status.exit_place === 1 ? "Vainqueur de la saison" : `Éliminé·e à la ${ord(status.exit_place)} place${status.is_scored ? "" : " · hors scoring"}` }
      : status.kind === "nominated"
        ? { cls: "badge-gold", label: "Nominé·e cette semaine" }
        : { cls: "badge-violet", label: "En lice" };

  const byPhase = (phase: number) =>
    placements
      .filter((p) => p.phase === phase)
      .map((p) => ({ p, profile: profiles.get(p.user_id) }))
      .sort((a, b) => a.p.position - b.p.position);

  return (
    <div className="p-4 flex flex-wrap gap-4 items-start">
      <div className="flex-[1_1_520px] min-w-0 flex flex-col gap-4">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" role="tablist" aria-label="Élèves">
          {store.contestants.map((c) => {
            const active = c.id === contestant.id;
            return (
              <button
                key={c.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => router.replace(`/eleves/?id=${c.id}`)}
                className={`min-h-10 px-3 rounded-full border text-[13px] font-semibold whitespace-nowrap ${active ? "border-violet bg-violet-veil text-violet-dark" : "border-line bg-surface text-ink-2"}`}
              >
                <span className="inline-flex items-center gap-1">
                  {shortName(c.full_name)}
                  <MyStars contestantId={c.id} compact size={11} />
                </span>
              </button>
            );
          })}
        </div>
        <section className="card rounded-xl p-[18px] flex gap-4 items-center flex-wrap">
          <Pastille name={contestant.full_name} photo={contestant.photo_url} size={84} display tone={status.kind === "eliminated" && status.exit_place !== 1 ? "grey" : "violet"} />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 mb-1.5 font-display font-extrabold text-[26px] tracking-[-0.02em]">{contestant.full_name}</h1>
            <span className="flex items-center gap-2 flex-wrap">
              <span className={badge.cls}>{badge.label}</span>
              <MyStars contestantId={contestant.id} size={15} />
            </span>
            {contestant.bio ? <p className="m-0 mt-2 text-sm text-ink-2 [text-wrap:pretty]">{contestant.bio}</p> : null}
          </div>
        </section>
        <section className="card p-4">
          <h2 className="m-0 mb-2.5 card-title text-base">Où chacun l&apos;a placé{season.p2_opens_at ? " · phase 1" : ""}</h2>
          <Placements rows={byPhase(1)} meId={store.profile?.id} revealed={phaseIsRevealed(season, 1)} />
        </section>
        {season.p2_opens_at ? (
          <section className="card p-4">
            <h2 className="m-0 mb-2.5 card-title text-base">Phase 2</h2>
            <Placements rows={byPhase(2)} meId={store.profile?.id} revealed={phaseIsRevealed(season, 2)} />
          </section>
        ) : null}
        <p className="m-0 text-sm">
          <Link href="/votes/">Tous les votes</Link>
        </p>
      </div>
      <NoteCard contestantId={contestant.id} name={contestant.full_name} />
    </div>
  );
}

function Placements({ rows, meId, revealed }: { rows: Array<{ p: RankingItemPublic; profile?: { display_name: string; avatar_url: string | null } }>; meId?: string; revealed: boolean }) {
  if (rows.length === 0) return <p className="m-0 text-sm text-ink-2">{revealed ? "Personne ne l'a classé." : "Visible à la révélation de la phase. Ton propre vote apparaît dès qu'il est validé."}</p>;
  return (
    <ul className="list-none m-0 p-0 flex flex-col gap-0.5">
      {rows.map(({ p, profile }) => (
        <li key={p.user_id} className="flex items-center gap-2.5 py-[9px] border-t border-page">
          <Pastille name={profile?.display_name ?? "?"} photo={profile?.avatar_url} size={28} tone="veil" />
          <span className="flex-1 text-[15px]">
            {profile?.display_name ?? "?"}
            {p.user_id === meId ? " (toi)" : ""}
          </span>
          <span className="font-display font-bold text-base text-violet-dark">{ord(p.position)}</span>
        </li>
      ))}
      {!revealed ? <li className="text-[13px] text-ink-2 pt-2">Les autres apparaîtront à la révélation.</li> : null}
    </ul>
  );
}

/** Carnet privé du joueur connecté sur cet élève : un fil de notes datées, plus récentes en haut. */
function NoteCard({ contestantId, name }: { contestantId: string; name: string }) {
  const store = useSeason();
  const season = store.season!;
  const phases = ([1, 2] as const).filter((ph) => (ph === 1 ? Boolean(season.p1_opens_at) : Boolean(season.p2_opens_at)));
  return (
    <section className="flex-[1_1_300px] min-w-0 max-w-[360px] bg-gold-veil border border-gold rounded-lg p-4 flex flex-col gap-3">
      <div>
        <h2 className="m-0 mb-1 card-title text-base">Mon carnet privé</h2>
        <p className="m-0 text-[13px] text-gold-ink [text-wrap:pretty]">Visible par toi seul. Jamais publié, y compris après la révélation.</p>
      </div>
      <StarInput key={`stars-${contestantId}`} contestantId={contestantId} name={name} />
      <NoteJournal key={contestantId} contestantId={contestantId} name={name} />
      {phases.length > 0 ? (
        <div className="flex flex-col gap-3 pt-3 border-t border-gold-line">
          <p className="m-0 text-xs font-semibold text-gold-ink">Note de classement</p>
          {phases.map((ph) => (
            <NoteField key={`${contestantId}-${ph}`} phase={ph} contestantId={contestantId} name={name} />
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ElevesHeader() {
  const params = useSearchParams();
  const isSheet = Boolean(params.get("id"));
  return (
    <div className="px-4 pt-4 pb-3.5">
      <PageTitle
        title={isSheet ? "Fiche élève" : "Les élèves"}
        sub={isSheet ? "Statut, où chacun l'a placé, et ton carnet privé." : "Le casting de la saison, tel qu'il se dévoile. Tape un élève pour sa fiche."}
      />
    </div>
  );
}

export default function ElevesPage() {
  return (
    <Suspense fallback={<Loading />}>
      <div>
        <ElevesHeader />
        <FicheEleve />
      </div>
    </Suspense>
  );
}
