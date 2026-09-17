"use client";

import { Loading, PageTitle } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { ord } from "@/lib/format";
import type { ScoringRule } from "@/lib/types";

function bandLabel(r: ScoringRule, n: number): string {
  if (r.exit_place_min === r.exit_place_max) return `${ord(r.exit_place_min)} place`;
  const top = Math.min(r.exit_place_max, n);
  return `${ord(top)} à ${ord(r.exit_place_min)} place`;
}

export default function ReglesPage() {
  const store = useSeason();
  const season = store.season;
  if (!season) return <Loading />;
  const n = store.contestants.length || 17;
  const p1 = store.scoringRules.filter((r) => r.phase === 1).sort((a, b) => b.exit_place_min - a.exit_place_min);
  const p2 = store.scoringRules.filter((r) => r.phase === 2).sort((a, b) => b.exit_place_min - a.exit_place_min);
  const bonus = store.scoringRules.find((r) => r.phase === 0)?.points_exact ?? 0;
  const first = p1.at(0);
  const t = season.phase2_threshold;

  const rules: Array<{ q: string; a: string }> = [
    {
      q: "Quand est-ce que je classe ?",
      a: `Avant le premier prime, dès que l'organisateur publie la liste. Tu ordonnes les ${n} élèves de la 1re place, le vainqueur selon toi, à la ${ord(n)}, le premier sorti. La validation est irréversible : ton classement est scellé pour toute la saison.`,
    },
    {
      q: "Et si je ne valide pas à temps ?",
      a: "Tu restes dans le groupe, tu lis le chat et les votes, mais tu ne marques aucun point de la saison.",
    },
    {
      q: "Comment je marque des points ?",
      a: `À chaque sortie, on regarde la place de sortie (${n} = premier éliminé, 1 = vainqueur) et l'élève que tu avais mis à cette place-là. Si c'est exactement l'éliminé : points « exact ». Sinon, s'il fait partie des nominés de la semaine : points « nominé ». Sinon rien. Jamais les deux à la fois.`,
    },
    {
      q: "Pourquoi les nominés ne rapportent rien en finale ?",
      a: "Les points « nominé » ne comptent que si les nominés ne sont pas tous les élèves encore en lice. Quand tout le monde est nominé, seule la place exacte rapporte.",
    },
    {
      q: "Le pronostic de la semaine, c'est quoi ?",
      a: `Dès que les nominés tombent, tu désignes celui que tu vois partir. S'il sort, tu gagnes ${bonus} points en plus. Ferme quand l'organisateur ouvre la saisie du prime.`,
    },
    {
      q: "Une semaine sans élimination ?",
      a: "Personne ne marque. Le pronostic est simplement reporté.",
    },
    {
      q: "La phase 2 ?",
      a: `Quand il ne reste que ${t} élèves, tu reclasses ces ${t}-là. Cette phase rapporte moitié moins et s'ajoute à ta phase 1, qui continue de marquer sur ses places. Elle compte dès la sortie n°${t}.`,
    },
    {
      q: "Abandon, exclusion, repêchage ?",
      a: "Un abandon consomme une place de sortie et rapporte comme une élimination ordinaire, sauf si l'organisateur le passe « hors scoring ». Un repêchage supprime la sortie : tout est recalculé.",
    },
    {
      q: "Mes notes sont-elles publiques ?",
      a: "Jamais. Le carnet est privé à vie, même après la révélation des classements. Le seul espace public est le chat.",
    },
    {
      q: "Égalité au général ?",
      a: "Départage au nombre de places exactes, puis ex æquo assumé.",
    },
  ];

  return (
    <div className="p-4 max-w-[720px] flex flex-col gap-3">
      <PageTitle title="Les règles" sub="Dans l'ordre où les questions se posent." />
      {first ? (
        <section className="bg-violet-dark text-white rounded-lg p-4">
          <p className="m-0 eyebrow text-gold mb-1.5">Le principe</p>
          <p className="m-0 text-[15px] leading-[1.5] [text-wrap:pretty]">
            On compare ton {ord(n)} à celui qui sort {ord(n)}. Exact : <strong className="text-gold">+{first.points_exact}</strong>. Dans les nominés :{" "}
            <strong className="text-gold">+{first.points_nominated}</strong>. Sinon : 0. Plus la sortie est tardive, plus ça rapporte.
          </p>
        </section>
      ) : null}
      {rules.map((r) => (
        <section key={r.q} className="card p-4">
          <h2 className="m-0 mb-1.5 font-display font-bold text-base">{r.q}</h2>
          <p className="m-0 text-[15px] leading-[1.55] [text-wrap:pretty]">{r.a}</p>
        </section>
      ))}
      <table className="w-full mt-1 border-collapse card overflow-hidden">
        <caption className="text-left font-display font-bold text-base px-4 pt-3.5 pb-2">Le barème, lu dans la base</caption>
        <thead>
          <tr className="text-xs text-ink-2">
            <th scope="col" className="text-left font-semibold px-4 py-1.5">Place de sortie</th>
            <th scope="col" className="text-right font-semibold px-2 py-1.5">Exact</th>
            <th scope="col" className="text-right font-semibold px-2 py-1.5">Nominé</th>
            <th scope="col" className="text-right font-semibold px-2 py-1.5">Ph. 2 exact</th>
            <th scope="col" className="text-right font-semibold px-4 py-1.5">Ph. 2 nominé</th>
          </tr>
        </thead>
        <tbody>
          {p1.map((r) => {
            const r2 = p2.find((x) => x.exit_place_min === r.exit_place_min);
            return (
              <tr key={r.id}>
                <th scope="row" className="text-left font-medium text-[15px] px-4 py-2.5 border-t border-page">{bandLabel(r, n)}</th>
                <td className="text-right font-display font-bold text-base px-2 py-2.5 border-t border-page text-violet-dark">{r.points_exact}</td>
                <td className="text-right font-display font-bold text-base px-2 py-2.5 border-t border-page text-violet-dark">{r.points_nominated}</td>
                <td className="text-right font-display font-bold text-base px-2 py-2.5 border-t border-page text-ink-2">{r2?.points_exact ?? "—"}</td>
                <td className="text-right font-display font-bold text-base px-4 py-2.5 border-t border-page text-ink-2">{r2?.points_nominated ?? "—"}</td>
              </tr>
            );
          })}
          <tr>
            <th scope="row" className="text-left font-medium text-[15px] px-4 py-2.5 border-t border-page">Pronostic de la semaine juste</th>
            <td colSpan={4} className="text-right font-display font-bold text-base px-4 py-2.5 border-t border-page text-gold-ink">+{bonus}</td>
          </tr>
        </tbody>
      </table>
      <p className="m-0 text-xs text-ink-2">Phase 2 : à partir de {t} élèves restants. Le barème est modifiable par l&apos;organisateur d&apos;une saison à l&apos;autre.</p>
    </div>
  );
}
