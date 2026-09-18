import { LogoMark } from "@/components/ui/Etoile";

export function AuthCard({ children, title, sub }: { children: React.ReactNode; title: string; sub?: string }) {
  return (
    <div className="min-h-dvh flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="flex items-center gap-3 mb-5">
          <LogoMark size={44} bg="#3A1F8C" />
          <span className="font-display font-extrabold italic text-xl leading-[1.05] tracking-[-0.025em] text-violet-dark">
            <span className="block">qui c&apos;est qui va gagner</span>
            <span className="block">
              la <span className="text-gold-ink">starac</span>
            </span>
          </span>
        </div>
        <section className="card p-[18px] rounded-xl">
          <h1 className="m-0 mb-1 font-display font-extrabold text-2xl tracking-[-0.02em]">{title}</h1>
          {sub ? <p className="m-0 mb-4 text-sm text-ink-2 [text-wrap:pretty]">{sub}</p> : null}
          {children}
        </section>
      </div>
    </div>
  );
}
