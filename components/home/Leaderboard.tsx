"use client";

import Link from "next/link";
import { Pastille } from "@/components/ui/Pastille";
import { useSeason } from "@/lib/season";
import { phaseIsOpen, ranksOf, sortLeaderboard } from "@/lib/derive";

export function Leaderboard({ progress = false, footer = true }: { progress?: boolean; footer?: boolean }) {
  const store = useSeason();
  const rows = sortLeaderboard(store.leaderboard);
  const ranks = ranksOf(rows);
  const leader = rows.find((r) => r.has_submitted);
  const max = Math.max(1, leader?.total_points ?? 0);
  const primes = new Set(store.eliminations.map((e) => e.week_id)).size;
  const meId = store.profile?.id;
  const pendingLabel = store.season && (phaseIsOpen(store.season, 1) || store.season.status === "preparation") ? "non validé" : "hors saison";

  return (
    <section className="card overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2.5">
        <h2 className="card-title">Classement général</h2>
        <span className="text-xs text-ink-2">{primes === 0 ? "avant le premier prime" : `après ${primes} prime${primes > 1 ? "s" : ""}`}</span>
      </div>
      {rows.length === 0 ? (
        <p className="m-0 px-4 pb-4 text-sm text-ink-2">Personne pour l&apos;instant.</p>
      ) : (
        <ol className="list-none m-0 px-2 pb-2">
          {rows.map((r, k) => {
            const isLeader = r.has_submitted && ranks.get(r.user_id) === 1;
            const isMe = r.user_id === meId;
            const rank = ranks.get(r.user_id);
            return (
              <li
                key={r.user_id}
                className={`flex flex-nowrap lg:flex-wrap items-center gap-x-2 sm:gap-x-3 gap-y-1 px-2 py-2.5 border-t border-page rounded-sm animate-row-in ${isLeader ? "bg-gold-veil" : ""}`}
                style={{ animationDelay: `${k * 0.06}s` }}
              >
                <span className={`w-6 shrink-0 font-display font-extrabold text-right ${isLeader ? "text-lg text-gold-ink" : "text-[15px] text-ink-2"}`}>
                  {rank ?? "—"}
                </span>
                <Pastille name={r.display_name} photo={r.avatar_url} size={30} tone={isLeader ? "gold" : isMe ? "violet" : "dark"} ring={isLeader} />
                <span className="flex-1 min-w-[36px] text-[15px] font-medium whitespace-nowrap overflow-hidden text-ellipsis">{r.display_name}</span>
                {isMe ? <span className="badge-violet">toi</span> : null}
                {r.is_admin ? <span className="badge bg-page text-ink-2 hidden sm:inline-flex">orga</span> : null}
                {!r.has_submitted ? <span className="badge-gold shrink-0">{pendingLabel}</span> : null}
                <span className={`font-display font-extrabold min-w-[38px] shrink-0 text-right ${isLeader ? "text-[19px] text-gold-ink" : "text-base"}`}>
                  {r.has_submitted ? r.total_points : "—"}
                </span>
                {progress && r.has_submitted ? (
                  <span className="hidden lg:block basis-full h-1.5 rounded-full bg-page overflow-hidden" aria-hidden="true">
                    <span className={`block h-full rounded-full ${isLeader ? "bg-gold" : "bg-violet-line"}`} style={{ width: `${Math.round((r.total_points / max) * 100)}%` }} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {footer ? (
        <div className="px-4 pb-4">
          <Link href="/points/" className="btn-secondary w-full no-underline">
            Voir le détail des points
          </Link>
        </div>
      ) : null}
    </section>
  );
}
