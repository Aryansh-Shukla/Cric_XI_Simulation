// Seeded PRNG utilities. All simulation randomness flows through here so
// results are reproducible per (team, opponent, seed).
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function childRng(rng: Rng): Rng {
  return mulberry32(Math.floor(rng() * 2 ** 31));
}

export const pick = <T>(arr: T[], rng: Rng): T => arr[Math.floor(rng() * arr.length)];

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export function weightedPick<T>(items: T[], weights: number[], rng: Rng): T {
  const total = weights.reduce((s, w) => s + Math.max(0, w), 0);
  if (total <= 0) return items[Math.floor(rng() * items.length)];
  let x = rng() * total;
  for (let i = 0; i < items.length; i++) {
    x -= Math.max(0, weights[i]);
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}