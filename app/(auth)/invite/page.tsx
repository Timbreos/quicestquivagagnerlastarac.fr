"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { AuthCard } from "@/components/shell/AuthCard";
import { ErrorBox, Loading } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase/client";

function InviteForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [code, setCode] = useState(params.get("code") ?? "");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const sb = supabase();
    sb.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) {
        const { data: p } = await sb.from("profiles").select("id").eq("id", data.session.user.id).maybeSingle();
        if (p) router.replace("/");
      }
    });
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().rpc("redeem_invite", { p_code: code.trim(), p_display_name: name.trim() });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.replace("/");
  }

  if (session === undefined) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loading />
      </div>
    );
  }

  if (!session) {
    return (
      <AuthCard title="Tu es invité" sub="Connecte-toi d'abord par e-mail : ton code est conservé le temps du trajet.">
        <Link
          href={code ? `/login/?code=${encodeURIComponent(code)}` : "/login/"}
          className="btn-primary min-h-12 font-display font-extrabold text-base no-underline"
        >
          Me connecter
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Entrer dans le groupe" sub="Un code d'invitation par joueur, donné par l'organisateur. Le pseudo, c'est celui que les autres verront au classement.">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div>
          <label htmlFor="code" className="label">
            Code d&apos;invitation
          </label>
          <input
            id="code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="ABCD2345"
            autoCapitalize="characters"
            className="field font-display font-bold tracking-[.12em] uppercase"
          />
        </div>
        <div>
          <label htmlFor="name" className="label">
            Ton pseudo
          </label>
          <input id="name" required maxLength={40} value={name} onChange={(e) => setName(e.target.value)} placeholder="Yanis" className="field" />
        </div>
        {error ? <ErrorBox message={error} /> : null}
        <button type="submit" disabled={busy || !code.trim() || !name.trim()} className="btn-primary min-h-12 font-display font-extrabold text-base">
          {busy ? "Entrée…" : "Rejoindre la ligue"}
        </button>
        <button type="button" onClick={() => supabase().auth.signOut().then(() => router.replace("/login/"))} className="btn-muted">
          Changer de compte
        </button>
      </form>
    </AuthCard>
  );
}

export default function InvitePage() {
  return (
    <Suspense fallback={null}>
      <InviteForm />
    </Suspense>
  );
}
