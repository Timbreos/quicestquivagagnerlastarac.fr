"use client";

import { useRef, useState } from "react";
import { ConfirmButton, Panel, useAction } from "@/components/admin/common";
import { Pastille } from "@/components/ui/Pastille";
import { ErrorBox } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";
import { contestantStatus, currentWeek, nomineesOf } from "@/lib/derive";
import { ord } from "@/lib/format";
import type { Contestant } from "@/lib/types";

export function ContestantsPanel() {
  const store = useSeason();
  const season = store.season;
  const { busy, error, run } = useAction();
  const [bulk, setBulk] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const fileFor = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const nominees = nomineesOf(currentWeek(store.weeks), store.nominations);
  const locked = Boolean(season?.p1_opens_at);

  if (!season) return null;
  const sid = season.id;

  async function addBulk(e: React.FormEvent) {
    e.preventDefault();
    const names = bulk.split("\n").map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const start = store.contestants.length;
    await run(async () => {
      const r = await supabase()
        .from("contestants")
        .insert(names.map((full_name, i) => ({ season_id: sid, full_name, display_order: start + i + 1 })));
      if (!r.error) {
        setBulk("");
        await store.refresh();
      }
      return r;
    });
  }

  async function save(c: Contestant) {
    await run(async () => {
      const r = await supabase().from("contestants").update({ full_name: editName.trim(), bio: editBio.trim() || null }).eq("id", c.id);
      if (!r.error) {
        setEditing(null);
        await store.refresh();
      }
      return r;
    });
  }

  async function remove(c: Contestant) {
    await run(async () => {
      const r = await supabase().from("contestants").delete().eq("id", c.id);
      if (!r.error) await store.refresh();
      return r;
    });
  }

  async function move(c: Contestant, d: -1 | 1) {
    const list = [...store.contestants];
    const i = list.findIndex((x) => x.id === c.id);
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await run(async () => {
      for (let k = 0; k < list.length; k++) {
        if (list[k].display_order !== k + 1) {
          const r = await supabase().from("contestants").update({ display_order: k + 1 }).eq("id", list[k].id);
          if (r.error) return r;
        }
      }
      await store.refresh();
    });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const cid = fileFor.current;
    e.target.value = "";
    if (!file || !cid) return;
    await run(async () => {
      const { blob, ext, contentType } = await compressImage(file);
      const path = `${sid}/${cid}-${Date.now()}.${ext}`;
      const up = await supabase().storage.from("contestant-photos").upload(path, blob, { contentType });
      if (up.error) return { error: up.error };
      const { data } = supabase().storage.from("contestant-photos").getPublicUrl(path);
      const r = await supabase().from("contestants").update({ photo_url: data.publicUrl }).eq("id", cid);
      if (!r.error) await store.refresh();
      return r;
    });
  }

  return (
    <Panel title="Élèves" sub={locked ? "Le vote est ouvert : n'ajoute ni ne retire d'élève, les classements en dépendent. Noms, bios et photos restent modifiables." : "Un nom par ligne. Les photos viennent après, elles ne bloquent rien : la pastille d'initiales fait le travail."}>
      {error ? <ErrorBox message={error} /> : null}
      <ul className="list-none m-0 p-0 max-h-[420px] overflow-y-auto">
        {store.contestants.map((c, i) => {
          const st = contestantStatus(c, store.eliminations, nominees);
          const isEditing = editing === c.id;
          return (
            <li key={c.id} className="flex flex-wrap items-center gap-2.5 py-2 border-t border-page">
              <Pastille name={c.full_name} photo={c.photo_url} size={28} tone={st.kind === "eliminated" ? "grey" : "violet"} />
              {isEditing ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void save(c);
                  }}
                  className="flex-1 min-w-[240px] flex flex-col gap-1.5"
                >
                  <label htmlFor={`n-${c.id}`} className="sr-only-label">Nom</label>
                  <input id={`n-${c.id}`} value={editName} onChange={(e) => setEditName(e.target.value)} className="field" />
                  <label htmlFor={`b-${c.id}`} className="sr-only-label">Bio</label>
                  <textarea id={`b-${c.id}`} value={editBio} onChange={(e) => setEditBio(e.target.value)} rows={2} placeholder="Bio (facultative)" className="field py-2 resize-y" />
                  <span className="flex gap-1.5">
                    <button type="submit" disabled={busy} className="btn-primary text-sm">Enregistrer</button>
                    <button type="button" onClick={() => setEditing(null)} className="btn-muted text-sm">Annuler</button>
                  </span>
                </form>
              ) : (
                <>
                  <span className="flex-1 min-w-0 text-sm">
                    <span className="block font-medium">{c.full_name}</span>
                    {c.bio ? <span className="block text-xs text-ink-2 truncate">{c.bio}</span> : null}
                  </span>
                  <span className={st.kind === "eliminated" ? "badge-ko" : st.kind === "nominated" ? "badge-gold" : "badge-violet"}>
                    {st.kind === "eliminated" ? (st.exit_place === 1 ? "vainqueur" : `sorti ${ord(st.exit_place)}`) : st.kind === "nominated" ? "nominé" : "en lice"}
                  </span>
                  <span className="flex gap-1">
                    <button type="button" aria-label="Monter" disabled={busy || i === 0} onClick={() => move(c, -1)} className="w-11 h-11 border border-line rounded-[10px] bg-surface text-violet-dark disabled:opacity-40">↑</button>
                    <button type="button" aria-label="Descendre" disabled={busy || i === store.contestants.length - 1} onClick={() => move(c, 1)} className="w-11 h-11 border border-line rounded-[10px] bg-surface text-violet-dark disabled:opacity-40">↓</button>
                    <button
                      type="button"
                      onClick={() => {
                        fileFor.current = c.id;
                        fileRef.current?.click();
                      }}
                      disabled={busy}
                      className="btn-muted text-sm"
                    >
                      Photo
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(c.id);
                        setEditName(c.full_name);
                        setEditBio(c.bio ?? "");
                      }}
                      className="btn-muted text-sm"
                    >
                      Modifier
                    </button>
                    {!locked ? <ConfirmButton label="Retirer" confirmLabel="Retirer cet élève" onConfirm={() => remove(c)} disabled={busy} /> : null}
                  </span>
                </>
              )}
            </li>
          );
        })}
      </ul>
      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" aria-label="Photo de l'élève" />
      {!locked ? (
        <form onSubmit={addBulk} className="flex flex-col gap-2 pt-2 border-t border-page">
          <label htmlFor="bulk" className="label">
            Ajouter des élèves (un par ligne)
          </label>
          <textarea id="bulk" rows={4} value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={"Léane Dubreuil\nMarius Ferrand"} className="field py-2 resize-y" />
          <button type="submit" disabled={busy || !bulk.trim()} className="btn-primary self-start text-sm">
            Ajouter
          </button>
        </form>
      ) : null}
    </Panel>
  );
}
