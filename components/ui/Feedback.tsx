import { Etoile } from "@/components/ui/Etoile";

export function Loading({ label = "Chargement…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-2 text-sm" role="status">
      <Etoile size={28} className="animate-twinkle" style={{ animationDuration: "1.8s" }} />
      {label}
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <p role="alert" className="m-0 text-sm text-ko bg-ko-veil border border-[#E7B4AD] rounded-md px-3 py-2">
      {message}
    </p>
  );
}

export function EmptyBox({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="border border-dashed border-violet-line rounded-md p-[18px] text-center">
      <Etoile size={30} fill="#CDBDF4" className="inline-block mb-1.5 animate-twinkle" style={{ animationDuration: "3s" }} />
      <h3 className="m-0 mb-1 font-display font-bold text-base">{title}</h3>
      {children ? <p className="m-0 text-sm text-ink-2">{children}</p> : null}
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: React.ReactNode }) {
  return (
    <div>
      <h1 className="m-0 mb-1 font-display font-extrabold text-2xl tracking-[-0.02em]">{title}</h1>
      {sub ? <p className="m-0 text-sm text-ink-2 [text-wrap:pretty]">{sub}</p> : null}
    </div>
  );
}
