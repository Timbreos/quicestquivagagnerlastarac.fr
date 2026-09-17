// GIF via l'API Tenor v2. La clé est publique côté client par conception ;
// elle est restreinte au domaine de l'application dans la console Google.

export type Gif = {
  id: string;
  url: string;        // GIF à stocker et afficher
  preview: string;    // vignette légère pour la grille
  width: number;
  height: number;
  description: string;
};

type TenorMedia = { url: string; dims: [number, number] };
type TenorResult = {
  id: string;
  content_description?: string;
  media_formats: Record<string, TenorMedia>;
};
type TenorResponse = { results: TenorResult[]; next?: string };

const BASE = "https://tenor.googleapis.com/v2";

export function tenorKey(): string | undefined {
  return process.env.NEXT_PUBLIC_TENOR_KEY || undefined;
}

function toGif(r: TenorResult): Gif | null {
  const full = r.media_formats.tinygif ?? r.media_formats.gif ?? r.media_formats.mediumgif;
  const preview = r.media_formats.nanogif ?? r.media_formats.tinygif ?? full;
  if (!full) return null;
  return {
    id: r.id,
    url: full.url,
    preview: preview.url,
    width: full.dims[0],
    height: full.dims[1],
    description: r.content_description ?? "GIF",
  };
}

export async function searchGifs(query: string, pos?: string): Promise<{ gifs: Gif[]; next?: string }> {
  const key = tenorKey();
  if (!key) return { gifs: [] };
  const params = new URLSearchParams({
    key,
    client_key: "quicestquivagagnerlastarac",
    limit: "24",
    media_filter: "tinygif,nanogif,gif",
    locale: "fr_FR",
    contentfilter: "medium",
  });
  if (pos) params.set("pos", pos);
  const q = query.trim();
  if (q) params.set("q", q);
  const endpoint = q ? "search" : "featured";
  const res = await fetch(`${BASE}/${endpoint}?${params.toString()}`);
  if (!res.ok) throw new Error(`Tenor ${res.status}`);
  const data = (await res.json()) as TenorResponse;
  return { gifs: data.results.map(toGif).filter((g): g is Gif => g !== null), next: data.next };
}
