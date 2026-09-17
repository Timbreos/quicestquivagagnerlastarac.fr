"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AuthCard } from "@/components/shell/AuthCard";
import { ErrorBox } from "@/components/ui/Feedback";
import { supabase } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code") ?? "";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace(code ? `/invite/?code=${encodeURIComponent(code)}` : "/");
      });
  }, [router, code]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const target = code ? `/invite/?code=${encodeURIComponent(code)}` : "/";
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}${target}` },
    });
    setBusy(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <AuthCard
      title="Connexion"
      sub="Un lien magique arrive par e-mail. Pas de mot de passe. L'entrée dans le groupe se fait ensuite avec un code d'invitation."
    >
      {sent ? (
        <div className="bg-gold-veil border border-gold rounded-md p-3.5">
          <p className="m-0 font-display font-bold text-[17px]">Lien envoyé</p>
          <p className="m-0 mt-1 text-sm text-gold-ink">
            Ouvre l&apos;e-mail reçu sur <strong>{email}</strong> et tape le lien. Il te ramène ici, connecté.
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="email" className="label">
              Ton e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="toi@exemple.fr"
              className="field"
            />
          </div>
          {code ? (
            <p className="m-0 text-xs text-ink-2">
              Code d&apos;invitation retenu : <strong className="text-ink">{code}</strong>
            </p>
          ) : null}
          {error ? <ErrorBox message={error} /> : null}
          <button type="submit" disabled={busy} className="btn-primary min-h-12 font-display font-extrabold text-base">
            {busy ? "Envoi…" : "Recevoir mon lien"}
          </button>
        </form>
      )}
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
