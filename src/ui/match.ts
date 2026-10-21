import type { CityDef } from '../cities/types';

/** Lowercase, accent-free form so "sao", "São" and "SAO" compare equal. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Cities matching a free-text query, best first. Ranks: name prefix, word
 * prefix in the name, initials ("kl", "sf"), country prefix, then substring
 * anywhere. Ties keep the registry order; an empty query returns every city.
 */
export function matchCities(cities: readonly CityDef[], query: string): CityDef[] {
  const q = fold(query).trim().replace(/\s+/g, ' ');
  if (!q) return [...cities];
  const scored: { city: CityDef; rank: number; i: number }[] = [];
  cities.forEach((city, i) => {
    const name = fold(city.name);
    const country = fold(city.country);
    const words = name.split(/[\s-]+/);
    const initials = words.map((w) => w[0]).join('');
    const rank = name.startsWith(q)
      ? 0
      : words.some((w) => w.startsWith(q))
        ? 1
        : q.length > 1 && initials.startsWith(q.replace(/ /g, ''))
          ? 2
          : country.startsWith(q) || country.split(/[\s-]+/).some((w) => w.startsWith(q))
            ? 3
            : name.includes(q) || country.includes(q)
              ? 4
              : -1;
    if (rank >= 0) scored.push({ city, rank, i });
  });
  return scored.sort((a, b) => a.rank - b.rank || a.i - b.i).map((s) => s.city);
}
