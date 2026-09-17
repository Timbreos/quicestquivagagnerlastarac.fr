import { initials } from "@/lib/format";

export type PastilleTone = "violet" | "dark" | "gold" | "veil" | "grey";

const TONES: Record<PastilleTone, { bg: string; fg: string }> = {
  violet: { bg: "#5A2FC2", fg: "#FFFFFF" },
  dark: { bg: "#3A1F8C", fg: "#FFFFFF" },
  gold: { bg: "#F0B93B", fg: "#201736" },
  veil: { bg: "#EDE7FC", fg: "#3A1F8C" },
  grey: { bg: "#66607F", fg: "#FFFFFF" },
};

/** Initiales sur pastille (ou photo quand elle existe). Jamais de silhouette grise. */
export function Pastille({
  name,
  photo,
  size = 30,
  tone = "violet",
  ring = false,
  display = false,
  className = "",
}: {
  name: string;
  photo?: string | null;
  size?: number;
  tone?: PastilleTone;
  ring?: boolean;
  /** Archivo 800 pour les grandes pastilles. */
  display?: boolean;
  className?: string;
}) {
  const t = TONES[tone];
  const fontSize = size >= 64 ? Math.round(size * 0.34) : size >= 40 ? 14 : size >= 30 ? 11 : 10;
  return (
    <span
      className={`grid place-items-center shrink-0 rounded-full overflow-hidden font-semibold ${display ? "font-display font-extrabold" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: t.bg,
        color: t.fg,
        fontSize,
        boxShadow: ring ? "0 0 0 3px #FFF8E8" : undefined,
      }}
      aria-hidden={photo ? undefined : "true"}
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photo} alt={name} width={size} height={size} className="w-full h-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
