// GIF via l'API Giphy. La clé est publique côté client par conception ;
// elle est déclarée « Web SDK » et restreinte au domaine dans le tableau de bord Giphy.

export type Gif = {
  id: string;
  url: string;        // GIF à stocker et afficher (hauteur fixe 200 px)
  preview: string;    // vignette légère pour la grille
  width: number;
  height: number;
  description: string;
};

type GiphyImage = { url: string; width: string; height: string };
type GiphyResult = {
  id: string;
  title?: string;
  images: Record<string, GiphyImage | undefined>;
};
type GiphyResponse = { data: GiphyResult[]; pagination?: { total_count: number; count: number; offset: number } };

const BASE = "https://api.giphy.com/v1/gifs";
const LIMIT = 24;

export function giphyKey(): string | undefined {
  return process.env.NEXT_PUBLIC_GIPHY_KEY || undefined;
}

function toGif(r: GiphyResult): Gif | null {
  const full = r.images.fixed_height ?? r.images.downsized ?? r.images.original;
  const preview = r.images.fixed_width_small ?? r.images.preview_gif ?? full;
  if (!full || !preview) return null;
  return {
    id: r.id,
    url: full.url,
    preview: preview.url,
    width: Number(full.width),
    height: Number(full.height),
    description: r.title || "GIF",
  };
}

/** Recherche (ou tendances si la requête est vide). `pos` est l'offset de pagination. */
export async function searchGifs(query: string, pos?: string): Promise<{ gifs: Gif[]; next?: string }> {
  const key = giphyKey();
  if (!key) return { gifs: [] };
  const offset = Number(pos ?? 0) || 0;
  const params = new URLSearchParams({ api_key: key, limit: String(LIMIT), offset: String(offset), rating: "pg-13", lang: "fr", bundle: "messaging_non_clips" });
  const q = query.trim();
  if (q) params.set("q", q);
  const endpoint = q ? "search" : "trending";
  const res = await fetch(`${BASE}/${endpoint}?${params.toString()}`);
  if (!res.ok) throw new Error(`Giphy ${res.status}`);
  const data = (await res.json()) as GiphyResponse;
  const gifs = data.data.map(toGif).filter((g): g is Gif => g !== null);
  const total = data.pagination?.total_count ?? 0;
  const nextOffset = offset + gifs.length;
  return { gifs, next: gifs.length === LIMIT && nextOffset < total ? String(nextOffset) : undefined };
}
