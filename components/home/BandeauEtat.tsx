"use client";

import Link from "next/link";
import { Etoile } from "@/components/ui/Etoile";
import { NomineeButtons, useWeeklyPick } from "@/components/home/WeeklyPick";
import { useSeason } from "@/lib/season";
import { phaseIsOpen } from "@/lib/derive";
import { firstName, longDateTime, timeUntil } from "@/lib/format";

/**
 * Le bandeau dit ce qu'il faut faire maintenant, et rien d'autre.
 * Priorités : classement non validé → nominés sans pronostic → prime imminent → silence.
 */
export function BandeauEtat() {
  const store = useSeason();
  const { week, nominees, closed, decided, mine, canPick } = useWeeklyPick();
  const season = store.season;
  if (!season) return null;

  const myP1 = store.myRankings.find((r) => r.phase === 1);
  const myP2 = store.myRankings.find((r) => r.phase === 2);
  const p1Open = phaseIsOpen(season, 1);
  const p2Open = phaseIsOpen(season, 2);
  const firstPrime = store.weeks.find((w) => w.number === 1)?.prime_at ?? null;

  if (season.status === "preparation") {
    return (
      <Dark eyebrow="Avant-saison" title="La saison se prépare">
        <p className="m-0 text-sm text-violet-line">Le vote ouvrira quand la liste des élèves sera connue. En attendant, le chat est à toi.</p>
      </Dark>
    );
  }

  if (p1Open && !myP1?.submitted_at) {
    if (!season.roster_complete_at) {
      const n = store.contestants.length;
      return (
        <Dark eyebrow={`Casting en cours · ${n} élève${n > 1 ? "s" : ""}`} title="Le casting se dévoile, commence à classer" cta={{ href: "/vote/", label: myP1 ? "Continuer mon classement" : "Commencer à classer" }}>
          <p className="m-0 text-sm text-violet-line">
            Les élèves arrivent en direct dans ta grille. Place-les au fil de l&apos;eau ; la validation s&apos;ouvrira quand la liste sera complète.
          </p>
        </Dark>
      );
    }
    return (
      <Dark
        eyebrow={firstPrime ? `Premier prime ${longDateTime(firstPrime)}` : "Phase 1 ouverte"}
        title="Ton classement n'est pas validé"
        cta={{ href: "/vote/", label: myP1 ? "Finir mon classement" : "Classer les élèves" }}
      >
        <p className="m-0 text-sm text-violet-line">
          Classe les {store.contestants.length} élèves puis valide. Sans validation avant la fermeture, tu ne marques aucun point cette saison.
        </p>
      </Dark>
    );
  }

  if (!p1Open && season.p1_opens_at && !myP1?.submitted_at) {
    return (
      <section className="bg-ko-veil border border-[#E7B4AD] rounded-lg p-4">
        <h2 className="m-0 mb-1 font-display font-extrabold italic text-[19px] text-ko">Hors saison</h2>
        <p className="m-0 text-sm [text-wrap:pretty]">
          Ton classement n&apos;a pas été validé avant la fermeture. Tu gardes l&apos;accès au chat et aux votes, mais tu ne marques pas de points.
        </p>
      </section>
    );
  }

  if (p2Open && !myP2?.submitted_at) {
    return (
      <Dark eyebrow={`Phase 2 · ${season.phase2_threshold} élèves restants`} title="Reclasse les derniers" cta={{ href: "/vote/", label: myP2 ? "Finir ma phase 2" : "Classer la phase 2" }}>
        <p className="m-0 text-sm text-violet-line">Nouveau classement, points divisés par deux. Il s&apos;ajoute à ta phase 1, qui continue de compter.</p>
      </Dark>
    );
  }

  if (week && nominees.length > 0 && !decided) {
    const names = nominees.map((id) => firstName(store.contestants.find((c) => c.id === id)?.full_name ?? "?")).join(", ");
    const primeIn = week.prime_at ? timeUntil(week.prime_at) : "";
    const eyebrow = `Semaine ${week.number}${primeIn ? ` · prime dans ${primeIn}` : week.prime_at ? ` · prime ${longDateTime(week.prime_at)}` : ""}`;
    if (canPick && !mine) {
      return (
        <Dark eyebrow={eyebrow} title={`Nominés : ${names}`}>
          <p className="m-0 mb-3 text-sm text-violet-line">Qui part ce soir ? Ton pronostic de la semaine n&apos;est pas posé. Un tap suffit.</p>
          <NomineeButtons onDark />
        </Dark>
      );
    }
    if (mine) {
      const pickName = firstName(store.contestants.find((c) => c.id === mine.contestant_id)?.full_name ?? "?");
      return (
        <section className="bg-gold-veil border border-gold rounded-lg p-4">
          <p className="m-0 mb-1 eyebrow text-gold-ink">{eyebrow}</p>
          <h2 className="m-0 mb-1 font-display font-bold text-xl">Ton pronostic : {pickName}</h2>
          <p className="m-0 text-sm text-gold-ink">
            {closed ? "Les pronostics sont fermés. Rendez-vous au prime." : "Tu peux encore changer d'avis jusqu'à la fermeture."}
          </p>
          {!closed ? (
            <div className="mt-3">
              <NomineeButtons />
            </div>
          ) : null}
        </section>
      );
    }
    if (closed) {
      return (
        <section className="bg-violet-veil border border-violet-line rounded-lg p-4">
          <p className="m-0 mb-1 eyebrow text-violet-dark">{eyebrow}</p>
          <h2 className="m-0 font-display font-bold text-xl">Nominés : {names}</h2>
          <p className="m-0 mt-1 text-sm text-violet-dark">Pronostics fermés. Le classement bascule en direct à l&apos;annonce.</p>
        </section>
      );
    }
  }

  if (myP1?.submitted_at && (season.status === "vote_p1" || season.status === "p1_revelee")) {
    return (
      <section className="bg-gold-veil border border-gold rounded-lg p-4">
        <h2 className="m-0 mb-1 font-display font-bold text-xl">Classement validé</h2>
        <p className="m-0 text-sm text-gold-ink">
          Il est scellé jusqu&apos;à la fin de la saison.{firstPrime ? ` Premier prime ${longDateTime(firstPrime)}.` : ""}
          {season.p1_revealed_at ? (
            <>
              {" "}
              <Link href="/votes/" className="text-gold-ink underline">
                Les votes sont révélés.
              </Link>
            </>
          ) : (
            " Les votes des autres se dévoilent quand l'organisateur valide la phase."
          )}
        </p>
      </section>
    );
  }

  if (season.status === "terminee") {
    return (
      <section className="bg-gold-veil border border-gold rounded-lg p-4">
        <h2 className="m-0 mb-1 font-display font-extrabold italic text-xl">Saison terminée</h2>
        <p className="m-0 text-sm text-gold-ink">Le classement est figé. Il reste consultable la saison prochaine.</p>
      </section>
    );
  }

  return null;
}

function Dark({
  eyebrow,
  title,
  cta,
  children,
}: {
  eyebrow: string;
  title: string;
  cta?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden bg-violet-dark border border-violet-dark rounded-lg p-4 text-white [clip-path:inset(0_round_18px)]">
      <Etoile size={130} className="absolute -top-[30px] -right-6 opacity-[.16] animate-float-star" />
      <div className="relative">
        <p className="m-0 mb-1.5 inline-flex items-center gap-[7px] eyebrow text-gold">
          <span className="w-2 h-2 rounded-full bg-gold animate-twinkle" style={{ animationDuration: "1.6s" }} />
          {eyebrow}
        </p>
        <h2 className="m-0 mb-1.5 font-display font-extrabold italic text-[23px] leading-[1.15] tracking-[-0.02em]">{title}</h2>
        {children}
        {cta ? (
          <Link href={cta.href} className="btn-gold mt-3 no-underline">
            {cta.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}
