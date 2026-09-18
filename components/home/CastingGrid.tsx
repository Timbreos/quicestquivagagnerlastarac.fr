"use client";

import Link from "next/link";
import { Pastille } from "@/components/ui/Pastille";
import { EmptyBox } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { contestantStatus, currentWeek, nomineesOf } from "@/lib/derive";
import { ord } from "@/lib/format";

/**
 * Le casting, tel qu'il se dévoile : la grille se remplit en direct quand
 * l'organisateur ajoute un élève (Realtime sur contestants). Photo ou initiales.
 */
export function CastingGrid({ title = "Le casting", compact = false }: { title?: string; compact?: boolean }) {
  const store = useSeason();
  const n = store.contestants.length;
  const nominees = nomineesOf(currentWeek(store.weeks), store.nominations);
  const size = compact ? 56 : 72;

  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2 mb-3">
        <h2 className="card-title">{title}</h2>
        <span className="text-xs text-ink-2">
          {n === 0 ? "en attente" : `${n} élève${n > 1 ? "s" : ""} annoncé${n > 1 ? "s" : ""}`}
        </span>
      </div>
      {n === 0 ? (
        <EmptyBox title="Le casting arrive en direct">L&apos;organisateur ajoute les élèves un à un, au fil du prime. La grille se remplit toute seule.</EmptyBox>
      ) : (
        <ul className="list-none m-0 p-0 grid gap-2" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? 88 : 104}px, 1fr))` }}>
          {store.contestants.map((c, k) => {
            const st = contestantStatus(c, store.eliminations, nominees);
            return (
              <li key={c.id} className="animate-pop" style={{ animationDelay: `${Math.min(k * 0.03, 0.4)}s` }}>
                <Link
                  href={`/eleves/?id=${c.id}`}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-sm border text-center no-underline text-ink ${
                    st.kind === "eliminated" ? "bg-page border-line" : st.kind === "nominated" ? "bg-gold-veil border-gold-line" : "bg-page border-line hover:bg-violet-veil hover:border-violet-line"
                  }`}
                >
                  <Pastille name={c.full_name} photo={c.photo_url} size={size} display tone={st.kind === "eliminated" ? "grey" : "violet"} />
                  <span className={`text-[13px] font-medium leading-[1.2] ${st.kind === "eliminated" ? "text-ink-2 line-through" : ""}`}>{c.full_name}</span>
                  {st.kind === "eliminated" ? (
                    <span className="badge-ko">{st.exit_place === 1 ? "vainqueur" : `sorti ${ord(st.exit_place)}`}</span>
                  ) : st.kind === "nominated" ? (
                    <span className="badge-gold">nominé</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
