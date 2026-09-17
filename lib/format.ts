/** Ordinal français court : 1re, 2e, 3e… */
export function ord(n: number): string {
  return n === 1 ? "1re" : `${n}e`;
}

/** « 1er » pour un élève masculin inconnu : on reste neutre avec « 1re place » → on utilise ord(). */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "??";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** « Léane D. » */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return fullName;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

const DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

/** Heure de chat : « 21:02 » aujourd'hui, « hier 21:02 », « jeu 19:05 », « 12 oct. 19:05 » au-delà. */
export function chatTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const dayStart = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((dayStart(now) - dayStart(d)) / 86_400_000);
  if (diffDays === 0) return hm;
  if (diffDays === 1) return `hier ${hm}`;
  if (diffDays < 7) return `${DAYS[d.getDay()]} ${hm}`;
  return `${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} ${hm}`;
}

/** « samedi 17 octobre à 21 h 10 » */
export function longDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const h = d.getHours();
  const m = d.getMinutes();
  return `${date} à ${h} h ${m.toString().padStart(2, "0")}`;
}

/** « 20 h 25 » */
export function hourMinute(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()} h ${d.getMinutes().toString().padStart(2, "0")}`;
}

/** Durée restante lisible : « 3 h », « 2 j », « 45 min ». Vide si passée. */
export function timeUntil(iso: string, now = new Date()): string {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return "";
  const min = Math.round(ms / 60_000);
  if (min < 60) return `${min} min`;
  const h = Math.round(min / 60);
  if (h < 36) return `${h} h`;
  return `${Math.round(h / 24)} j`;
}

/** Pour les <input type="datetime-local"> */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function plural(n: number, one: string, many: string): string {
  return n <= 1 ? one : many;
}
