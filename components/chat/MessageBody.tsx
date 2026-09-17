import type { Profile } from "@/lib/types";

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Corps de message avec mentions @Pseudo surlignées. */
export function MessageBody({ body, profiles }: { body: string; profiles: Profile[] }) {
  const names = [...profiles].map((p) => p.display_name).sort((a, b) => b.length - a.length);
  if (names.length === 0) return <>{body}</>;
  const re = new RegExp(`@(${names.map(escapeRe).join("|")})(?![\\p{L}\\p{N}])`, "gu");
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) parts.push(body.slice(last, i));
    parts.push(
      <span key={i} className="text-violet font-semibold">
        {m[0]}
      </span>,
    );
    last = i + m[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return <>{parts}</>;
}
