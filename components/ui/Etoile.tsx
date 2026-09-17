// Étoile à cinq branches, SVG maison : seul ornement du produit (pas de logo TF1).
export const STAR_PATH =
  "M20 3 L24.5 13.9 L36.2 14.8 L27.2 22.4 L30 33.8 L20 27.6 L10 33.8 L12.8 22.4 L3.8 14.8 L15.5 13.9 Z";

export function Etoile({
  size = 20,
  fill = "#F0B93B",
  className,
  style,
}: {
  size?: number;
  fill?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className={className} style={style}>
      <path d={STAR_PATH} fill={fill} strokeLinejoin="round" />
    </svg>
  );
}

/** Pastille violette portant l'étoile, avec sa petite sœur qui scintille. */
export function LogoMark({ size = 34, bg = "#5A2FC2" }: { size?: number; bg?: string }) {
  return (
    <span
      className="relative grid place-items-center shrink-0"
      style={{ width: size, height: size, borderRadius: Math.round(size / 3), background: bg }}
    >
      <Etoile size={Math.round(size * 0.6)} />
      <Etoile size={9} className="absolute -top-0.5 -right-0.5 animate-twinkle" style={{ animationDuration: "2.6s" }} />
    </span>
  );
}
