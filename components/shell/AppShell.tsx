"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Etoile, LogoMark } from "@/components/ui/Etoile";
import { IconAdmin, IconClose, IconGroup, IconHome, IconMore, IconPoints, IconPrime, IconRanking, IconRules, IconUser, IconVotes } from "@/components/ui/Icons";
import { Pastille } from "@/components/ui/Pastille";
import { Loading } from "@/components/ui/Feedback";
import { PrimeOverlay } from "@/components/prime/PrimeOverlay";
import { InstallPrompt } from "@/components/shell/Pwa";
import { useSeason } from "@/lib/season";
import { currentWeek } from "@/lib/derive";

type NavItem = { href: string; label: string; short: string; icon: (p: { size?: number; className?: string }) => React.ReactNode };

// Barre haute (desktop) : tout. Barre basse (mobile) : les trois écrans du quotidien + « Plus ».
const NAV: NavItem[] = [
  { href: "/", label: "Accueil", short: "Accueil", icon: IconHome },
  { href: "/vote/", label: "Mon classement", short: "Classement", icon: IconRanking },
  { href: "/eleves/", label: "Les élèves", short: "Élèves", icon: IconGroup },
  { href: "/votes/", label: "Les votes", short: "Votes", icon: IconVotes },
  { href: "/points/", label: "Détail des points", short: "Points", icon: IconPoints },
  { href: "/regles/", label: "Règles", short: "Règles", icon: IconRules },
];
const MORE: NavItem[] = [
  { href: "/eleves/", label: "Les élèves", short: "Élèves", icon: IconGroup },
  { href: "/votes/", label: "Les votes", short: "Votes", icon: IconVotes },
  { href: "/prime/", label: "Les primes", short: "Primes", icon: IconPrime },
  { href: "/regles/", label: "Règles", short: "Règles", icon: IconRules },
  { href: "/moi/", label: "Mon profil", short: "Profil", icon: IconUser },
];
const ADMIN: NavItem = { href: "/admin/", label: "Back-office", short: "Admin", icon: IconAdmin };
const MOBILE_MAIN = [NAV[0], NAV[1], NAV[4]];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/" || pathname === "";
  return pathname.startsWith(href.replace(/\/$/, ""));
}

export function AppShell({ children }: { children: ReactNode }) {
  const store = useSeason();
  const router = useRouter();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Verrouille le document tant que la coque est montée : iOS Safari ne peut
  // plus faire glisser la page, ni en hauteur ni en largeur.
  useEffect(() => {
    document.documentElement.classList.add("app-shell-lock");
    return () => document.documentElement.classList.remove("app-shell-lock");
  }, []);

  useEffect(() => {
    if (!store.ready) return;
    if (!store.session) router.replace("/login/");
    else if (store.profileChecked && !store.profile) router.replace("/invite/");
  }, [store.ready, store.session, store.profileChecked, store.profile, router]);

  if (!store.ready || !store.session || !store.profileChecked || !store.profile) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <Loading label="Connexion…" />
      </div>
    );
  }

  const week = currentWeek(store.weeks);
  const seasonLabel = store.season ? `${store.season.name}${week ? ` · S${week.number}` : ""}` : "";
  const isAdmin = store.profile.is_admin;
  const nav = isAdmin ? [...NAV, ADMIN] : NAV;
  const more = isAdmin ? [...MORE, ADMIN] : MORE;
  const moreActive = more.some((n) => isActive(pathname, n.href)) && !MOBILE_MAIN.some((n) => isActive(pathname, n.href));

  return (
    // Coque ancrée à la fenêtre visible : le document ne défile jamais, seul <main>
    // défile. En-tête et barre basse restent en place quoi que fasse Safari.
    <div data-app-shell className="fixed top-0 left-0 w-full h-dvh flex flex-col overflow-hidden">
      <header className="bg-violet-dark text-white relative overflow-hidden shrink-0 [clip-path:inset(0)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <Etoile
          size={120}
          className="absolute -top-[34px] -right-[14px] opacity-[.13] animate-float-star"
          style={{ animationDuration: "9s" }}
        />
        <div className="relative max-w-[1480px] mx-auto px-4 pt-3.5 lg:pb-3.5 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0 text-white hover:text-white no-underline">
            <LogoMark />
            <span className="flex flex-col min-w-0 font-display font-extrabold italic text-[15px] sm:text-base leading-[1.05] tracking-[-0.025em]">
              <span className="block whitespace-nowrap overflow-hidden text-ellipsis">qui c&apos;est qui va gagner</span>
              <span className="block whitespace-nowrap overflow-hidden text-ellipsis">
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
                  className={`min-h-11 inline-flex items-center gap-1.5 px-3 rounded-[10px] text-sm no-underline transition-colors ${
                    active ? "bg-white/10 text-white font-bold" : "text-violet-line font-medium hover:text-white hover:bg-white/5"
                  }`}
                >
                  <n.icon size={18} className={active ? "text-gold" : "text-violet-line"} />
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
                  className="min-w-0 w-[92px] min-[400px]:w-[120px] sm:w-auto sm:max-w-[160px] min-h-9 rounded-[9px] bg-white/10 text-white text-xs px-2 border border-violet"
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

      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div className="w-full max-w-[1480px] mx-auto lg:h-full">{children}</div>
      </main>

      {moreOpen ? (
        <div className="lg:hidden fixed inset-0 z-40" style={{ background: "rgba(32,23,54,.45)" }} onMouseDown={() => setMoreOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Plus d'écrans"
            className="absolute inset-x-0 bg-surface rounded-t-xl border-t border-line p-3 animate-prime-in"
            style={{ bottom: "calc(56px + env(safe-area-inset-bottom))", paddingBottom: 12 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <span className="font-display font-bold text-[15px]">Plus</span>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Fermer" className="w-11 h-11 grid place-items-center rounded-[10px] text-ink-2 hover:bg-page">
                <IconClose size={20} />
              </button>
            </div>
            <ul className="list-none m-0 p-0 grid grid-cols-2 gap-2">
              {more.map((n) => {
                const active = isActive(pathname, n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-3 min-h-14 px-3 rounded-sm border no-underline text-[15px] font-medium ${
                        active ? "bg-violet-veil border-violet-line text-violet-dark" : "bg-page border-line text-ink"
                      }`}
                    >
                      <n.icon size={22} className="shrink-0 text-violet" />
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : null}

      <InstallPrompt />

      <nav
        aria-label="Écrans"
        className="lg:hidden shrink-0 z-40 bg-violet-dark border-t border-violet flex"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_MAIN.map((n) => {
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
              <n.icon size={22} className={active ? "text-gold" : "text-violet-line"} />
              {n.short}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          className={`flex-1 min-h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] border-t-[3px] bg-transparent ${
            moreActive || moreOpen ? "border-gold text-white font-bold bg-white/10" : "border-transparent text-violet-line font-medium"
          }`}
        >
          <IconMore size={22} className={moreActive || moreOpen ? "text-gold" : "text-violet-line"} />
          Plus
        </button>
      </nav>

      <PrimeOverlay />
    </div>
  );
}
