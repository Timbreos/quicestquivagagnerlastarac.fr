"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Etoile, LogoMark } from "@/components/ui/Etoile";
import { Pastille } from "@/components/ui/Pastille";
import { Loading } from "@/components/ui/Feedback";
import { PrimeOverlay } from "@/components/prime/PrimeOverlay";
import { useSeason } from "@/lib/season";
import { currentWeek } from "@/lib/derive";

const NAV = [
  { href: "/", label: "Accueil", short: "Accueil" },
  { href: "/vote/", label: "Mon classement", short: "Classement" },
  { href: "/votes/", label: "Les votes", short: "Votes" },
  { href: "/points/", label: "Détail des points", short: "Points" },
  { href: "/regles/", label: "Règles", short: "Règles" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "";
  return pathname.startsWith(href.replace(/\/$/, ""));
}

export function AppShell({ children }: { children: ReactNode }) {
  const store = useSeason();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!store.ready) return;
    if (!store.session) router.replace("/login/");
    else if (store.profileChecked && !store.profile) router.replace("/invite/");
  }, [store.ready, store.session, store.profileChecked, store.profile, router]);

  if (!store.ready || !store.session || !store.profileChecked || !store.profile) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loading label="Connexion…" />
      </div>
    );
  }

  const week = currentWeek(store.weeks);
  const seasonLabel = store.season ? `${store.season.name}${week ? ` · S${week.number}` : ""}` : "";
  const isAdmin = store.profile.is_admin;
  const nav = isAdmin ? [...NAV, { href: "/admin/", label: "Back-office", short: "Admin" }] : NAV;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-violet-dark text-white relative overflow-hidden shrink-0">
        <Etoile
          size={120}
          className="absolute -top-[34px] -right-[14px] opacity-[.13] animate-float-star"
          style={{ animationDuration: "9s" }}
        />
        <div className="relative max-w-[1480px] mx-auto px-4 pt-3.5 lg:pb-3.5 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0 text-white hover:text-white no-underline">
            <LogoMark />
            <span className="min-w-0 font-display font-extrabold italic text-base leading-[1.05] tracking-[-0.025em]">
              <span className="block whitespace-nowrap overflow-hidden text-ellipsis">qui c&apos;est qui va gagner</span>
              <span className="block">
                la <span className="text-gold">starac</span>
              </span>
            </span>
          </Link>

          <nav aria-label="Écrans" className="hidden lg:flex gap-0.5">
            {nav.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  aria-current={active ? "page" : undefined}
                  className={`min-h-11 inline-flex items-center px-3.5 rounded-[10px] text-sm no-underline transition-colors ${
                    active ? "bg-white/10 text-white font-bold" : "text-violet-line font-medium hover:text-white hover:bg-white/5"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {store.seasons.length > 1 ? (
              <>
                <label htmlFor="season-select" className="sr-only-label">
                  Saison
                </label>
                <select
                  id="season-select"
                  value={store.season?.id ?? ""}
                  onChange={(e) => store.selectSeason(e.target.value)}
                  className="min-w-0 w-[120px] sm:w-auto sm:max-w-[160px] min-h-9 rounded-[9px] bg-white/10 text-white text-xs px-2 border border-violet"
                >
                  {store.seasons.map((s) => (
                    <option key={s.id} value={s.id} className="text-ink">
                      {s.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <span className="hidden sm:inline text-xs text-violet-line whitespace-nowrap">{seasonLabel}</span>
            )}
            <Link
              href="/moi/"
              aria-label={`Mon profil : ${store.profile.display_name}`}
              className="no-underline shrink-0"
              title="Mon profil"
            >
              <Pastille name={store.profile.display_name} photo={store.profile.avatar_url} size={32} tone="gold" />
            </Link>
          </div>
        </div>
        <div className="lg:hidden h-2.5" />
      </header>

      <main className="flex-1 min-h-0 w-full max-w-[1480px] mx-auto pb-20 lg:pb-0">{children}</main>

      <nav
        aria-label="Écrans"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-violet-dark border-t border-violet flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {nav.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] no-underline border-t-[3px] ${
                active ? "border-gold text-white font-bold bg-white/10" : "border-transparent text-violet-line font-medium"
              }`}
            >
              <Etoile size={14} fill={active ? "#F0B93B" : "#CDBDF4"} />
              {n.short}
            </Link>
          );
        })}
      </nav>

      <PrimeOverlay />
    </div>
  );
}
