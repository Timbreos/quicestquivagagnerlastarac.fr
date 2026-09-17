"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Pastille } from "@/components/ui/Pastille";
import { ErrorBox, PageTitle } from "@/components/ui/Feedback";
import { useSeason } from "@/lib/season";
import { supabase } from "@/lib/supabase/client";
import { compressImage } from "@/lib/image";

export default function MoiPage() {
  const store = useSeason();
  const router = useRouter();
  const me = store.profile!;
  const [name, setName] = useState(me.display_name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().from("profiles").update({ display_name: name.trim() }).eq("id", me.id);
    setBusy(false);
    if (error) setError(error.message);
    else {
      setOk(true);
      await store.reloadProfile();
      await store.refresh();
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, ext, contentType } = await compressImage(file);
      const path = `${me.id}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase().storage.from("chat-images").upload(path, blob, { contentType });
      if (error) throw error;
      const { data } = supabase().storage.from("chat-images").getPublicUrl(path);
      const { error: e2 } = await supabase().from("profiles").update({ avatar_url: data.publicUrl }).eq("id", me.id);
      if (e2) throw e2;
      await store.reloadProfile();
      await store.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Envoi impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-4 max-w-[520px] flex flex-col gap-3.5">
      <PageTitle title="Mon profil" sub="Le pseudo et la photo que les autres voient au classement et dans le chat." />
      <form onSubmit={save} className="card p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3.5">
          <Pastille name={me.display_name} photo={me.avatar_url} size={64} tone="gold" display />
          <div className="flex flex-col gap-1.5">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy} className="btn-secondary text-sm">
              Changer la photo
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} className="hidden" aria-label="Choisir une photo" />
          </div>
        </div>
        <div>
          <label htmlFor="display-name" className="label">
            Pseudo
          </label>
          <input id="display-name" value={name} maxLength={40} onChange={(e) => { setName(e.target.value); setOk(false); }} className="field" />
        </div>
        {error ? <ErrorBox message={error} /> : null}
        {ok ? <p className="m-0 text-sm text-ok font-semibold">Enregistré.</p> : null}
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary">
          Enregistrer
        </button>
      </form>
      <div className="card p-4 flex flex-col gap-2">
        <p className="m-0 text-sm text-ink-2">Connecté avec {store.session?.user.email}</p>
        <button type="button" onClick={() => store.signOut().then(() => router.replace("/login/"))} className="btn-muted self-start">
          Me déconnecter
        </button>
      </div>
    </div>
  );
}
