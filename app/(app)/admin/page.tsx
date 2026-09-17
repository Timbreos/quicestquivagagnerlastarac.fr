"use client";

import { SeasonPanel } from "@/components/admin/SeasonPanel";
import { ContestantsPanel } from "@/components/admin/ContestantsPanel";
import { WeekPanel } from "@/components/admin/WeekPanel";
import { InvitesPanel } from "@/components/admin/InvitesPanel";
import { RulesPanel } from "@/components/admin/RulesPanel";
import { PageTitle } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";

export default function AdminPage() {
  const store = useSeason();
  if (!store.profile?.is_admin) {
    return (
      <div className="p-4">
        <div className="card p-[18px]">
          <h1 className="m-0 mb-1 font-display font-extrabold text-2xl">Réservé à l&apos;organisateur</h1>
          <p className="m-0 text-sm text-ink-2">Le back-office saisit les faits : élèves, nominés, sorties. Rien d&apos;autre.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="p-4 flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2.5">
        <PageTitle title="Back-office" sub={`${store.profile.display_name} · organisatrice ou organisateur. Deux actions par semaine, faisables au téléphone.`} />
        {store.season ? <span className="badge-gold border border-gold px-3 py-1.5 text-xs">{store.season.name}</span> : null}
      </div>
      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <SeasonPanel />
        {store.season ? (
          <>
            <WeekPanel />
            <ContestantsPanel />
            <InvitesPanel />
            <RulesPanel />
          </>
        ) : (
          <InvitesPanel />
        )}
      </div>
    </div>
  );
}
