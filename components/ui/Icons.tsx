// Icônes de navigation : traits simples, 24 px, couleur héritée. Pas d'emoji.
type P = { size?: number; className?: string };
const base = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
  className,
});

export const IconHome = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10.5V20h13v-9.5" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export const IconRanking = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M4 6h3M4 12h3M4 18h3" />
    <path d="M10 6h10M10 12h10M10 18h10" />
  </svg>
);

export const IconVotes = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="9.5" y="4" width="5" height="16" rx="1.5" />
    <rect x="16" y="4" width="5" height="16" rx="1.5" />
    <path d="M5.5 8h0M12 8h0M18.5 8h0" strokeWidth={2.6} />
  </svg>
);

export const IconPoints = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
);

export const IconRules = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M5 4h9l5 5v11H5z" />
    <path d="M14 4v5h5" />
    <path d="M8 13h8M8 17h5" />
  </svg>
);

export const IconPrime = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="3" y="5" width="18" height="12" rx="2" />
    <path d="M8 21h8M12 17v4" />
    <path d="m10 8 4.5 3L10 14z" fill="currentColor" stroke="none" />
  </svg>
);

export const IconUser = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.5-6.5 8-6.5s8 2.5 8 6.5" />
  </svg>
);

export const IconAdmin = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M4 7h10M18 7h2M4 12h3M11 12h9M4 17h12M20 17h0" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="18" cy="17" r="2" />
  </svg>
);

export const IconGroup = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <circle cx="9" cy="8" r="3.2" />
    <circle cx="17" cy="9" r="2.6" />
    <path d="M3 20c0-3.6 2.7-6 6-6s6 2.4 6 6" />
    <path d="M15.5 14.5c2.9 0 5.5 2 5.5 5.5" />
  </svg>
);

export const IconMore = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" />
    <rect x="14" y="14" width="6" height="6" rx="1.5" />
  </svg>
);

export const IconClose = ({ size = 22, className }: P) => (
  <svg {...base(size, className)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
