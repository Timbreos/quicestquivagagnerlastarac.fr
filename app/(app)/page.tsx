"use client";

import { BandeauEtat } from "@/components/home/BandeauEtat";
import { Leaderboard } from "@/components/home/Leaderboard";
import { LastExit } from "@/components/home/LastExit";
import { Chat } from "@/components/chat/Chat";
import { ErrorBox, Loading } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";

export default function HomePage() {
  const store = useSeason();
  if (store.loadingSeason && !store.season) return <Loading />;
  if (!store.season) {
    return (
      <div className="p-4">
        <div className="card p-[18px]">
          <h1 className="m-0 mb-1 font-display font-extrabold text-2xl">Aucune saison</h1>
          <p className="m-0 text-sm text-ink-2">L&apos;organisateur n&apos;a pas encore créé la saison. Le chat ouvrira avec elle.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-4 items-start p-4 lg:h-full">
      <div className="flex-[1_1_520px] min-w-0 flex flex-col gap-4 lg:h-full lg:overflow-y-auto lg:pr-1 [&>*]:shrink-0">
        {store.error ? <ErrorBox message={store.error} /> : null}
        <BandeauEtat />
        <Leaderboard progress />
        <LastExit />
      </div>
      <Chat className="flex-[1_1_320px] min-w-0 max-w-[380px] lg:max-w-[420px] self-stretch max-h-[640px] lg:max-h-none lg:h-full" />
    </div>
  );
}
