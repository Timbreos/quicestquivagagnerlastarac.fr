"use client";

import { useEffect, useState } from "react";
import { Panel, useAction } from "@/components/admin/common";
import { ErrorBox } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import type { Invite } from "@/lib/types";

export function InvitesPanel() {
  const store = useSeason();
  const { busy, error, run } = useAction();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  async function load() {
    const { data } = await supabase().from("invites").select("*").order("created_at", { ascending: false });
    setInvites((data ?? []) as Invite[]);
  }
  useEffect(() => {
    void load();
  }, []);

  async function create() {
    await run(async () => {
      const r = await supabase().from("invites").insert({ season_id: store.season?.id ?? null, created_by: store.profile?.id ?? null });
      if (!r.error) await load();
      return r;
    });
  }

  async function remove(code: string) {
    await run(async () => {
      const r = await supabase().from("invites").delete().eq("code", code);
      if (!r.error) await load();
      return r;
    });
  }

  function link(code: string) {
    return `${window.location.origin}/invite/?code=${code}`;
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(link(code));
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      window.prompt("Copie ce lien :", link(code));
    }
  }

  const profiles = new Map(store.profiles.map((p) => [p.id, p]));
  const free = invites.filter((i) => !i.used_by);

  return (
    <Panel title="Invitations" sub={`Un code par joueur, 10 joueurs maximum (${store.profiles.length} aujourd'hui). Le lien ouvre la connexion avec le code déjà rempli.`}>
      {error ? <ErrorBox message={error} /> : null}
      <button type="button" disabled={busy || store.profiles.length + free.length >= 10} onClick={create} className="btn-primary self-start text-sm">
        Créer un code
      </button>
      <ul className="list-none m-0 p-0 flex flex-col gap-1.5">
        {invites.map((i) => (
          <li key={i.code} className="flex flex-wrap items-center gap-2 text-sm p-2 border border-line rounded-sm">
            <span className="font-display font-bold tracking-[.12em]">{i.code}</span>
            {i.used_by ? (
              <span className="badge-ok">utilisé par {profiles.get(i.used_by)?.display_name ?? "?"}</span>
            ) : (
              <>
                <span className="badge-gold">disponible</span>
                <button type="button" onClick={() => copy(i.code)} className="btn-secondary text-sm ml-auto">
                  {copied === i.code ? "Copié !" : "Copier le lien"}
                </button>
                <button type="button" disabled={busy} onClick={() => remove(i.code)} className="btn-muted text-sm">
                  Supprimer
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}
