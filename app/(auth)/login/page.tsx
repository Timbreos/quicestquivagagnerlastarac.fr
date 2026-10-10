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
  const [otp, setOtp] = useState("");
  const target = code ? `/invite/?code=${encodeURIComponent(code)}` : "/";

  useEffect(() => {
    supabase()
      .auth.getSession()
      .then(({ data }) => {
        if (data.session) router.replace(code ? `/invite/?code=${encodeURIComponent(code)}` : "/");
      });
  }, [router, code]);

  // Le code du mail (6 à 10 chiffres selon le réglage « Email OTP Length » du
  // projet Supabase) : marche depuis n'importe quel navigateur et
  // depuis l'app installée, là où le lien magique (PKCE) exige le même navigateur.
  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabase().auth.verifyOtp({ email: email.trim(), token: otp.replace(/\D/g, ""), type: "email" });
    setBusy(false);
    if (error) {
      setError(error.message === "Token has expired or is invalid" ? "Code invalide ou expiré. Redemande un lien." : error.message);
      return;
    }
    router.replace(target);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
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
        <div className="flex flex-col gap-3">
          <div className="bg-gold-veil border border-gold rounded-md p-3.5">
            <p className="m-0 font-display font-bold text-[17px]">E-mail envoyé</p>
            <p className="m-0 mt-1 text-sm text-gold-ink">
              Ouvre le message reçu sur <strong>{email}</strong>. Tape le bouton, ou recopie ici le code chiffré : c&apos;est le plus sûr depuis l&apos;app installée.
            </p>
          </div>
          <form onSubmit={verifyCode} className="flex flex-col gap-3">
            <div>
              <label htmlFor="otp" className="label">
                Code reçu par e-mail
              </label>
              <input
                id="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={10}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="12345678"
                className="field font-display font-extrabold text-2xl tracking-[.2em] text-center"
              />
            </div>
            {error ? <ErrorBox message={error} /> : null}
            <button type="submit" disabled={busy || otp.length < 6 || otp.length > 10} className="btn-primary min-h-12 font-display font-extrabold text-base">
              {busy ? "Vérification…" : "Entrer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setOtp("");
                setError(null);
              }}
              className="btn-muted"
            >
              Renvoyer un e-mail
            </button>
          </form>
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
