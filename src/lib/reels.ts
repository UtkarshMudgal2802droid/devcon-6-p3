/**
 * Reel metadata — used by both API routes and the frontend.
 * Frame images live under private_assets/reels/<id>/frame-<n>.png
 */
export interface ReelMeta {
  id: string;
  title: string;
  description: string;
  totalFrames: number;
  price: string; // human-readable price string, e.g. "$0.01"
}

export const REELS: ReelMeta[] = [
  {
    id: "reel-1",
    title: "Sunrise over the Ghats",
    description: "A digitised reel capturing dawn light on ancient stone steps.",
    totalFrames: 4,
    price: "$0.01",
  },
  {
    id: "reel-2",
    title: "Monsoon in Munnar",
    description: "Tea plantations wrapped in rolling fog after the first rains.",
    totalFrames: 4,
    price: "$0.01",
  },
  {
    id: "reel-3",
    title: "Festival of Lights",
    description: "Diyas and lanterns illuminating a crowded market lane.",
    totalFrames: 4,
    price: "$0.01",
  },
];

export function getReelById(id: string): ReelMeta | undefined {
  return REELS.find((r) => r.id === id);
}
