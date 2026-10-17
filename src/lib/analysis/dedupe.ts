import { jaccard, shortHash } from "./text";

export interface Dedupable {
  key: string;
  title: string;
  category: string;
  priority: number;
}

export const fingerprintOf = (key: string) => shortHash(key);

/**
 * Removes repeats: identical keys, or near-identical titles within a category (Jaccard ≥ 0.7).
 * The higher-priority copy is kept. Returns the kept items and what was merged away.
 */
export function dedupe<T extends Dedupable>(items: T[]): { kept: T[]; merged: Array<{ dropped: T; into: T }> } {
  const sorted = [...items].sort((a, b) => b.priority - a.priority);
  const kept: T[] = [];
  const merged: Array<{ dropped: T; into: T }> = [];
  for (const it of sorted) {
    const twin = kept.find((k) => k.key === it.key || (k.category === it.category && jaccard(k.title, it.title) >= 0.7));
    if (twin) merged.push({ dropped: it, into: twin });
    else kept.push(it);
  }
  return { kept, merged };
}
