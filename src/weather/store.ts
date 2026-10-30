import type { CityDef } from '../cities/types';
import { fetchWeather, fetchWeatherMany, localDaytime, type Weather } from './api';

const TTL_MS = 10 * 60 * 1000;

/** The city's typical weather at its local hour. */
export function typicalWeather(city: CityDef): Weather {
  return { ...city.fallback, daytime: localDaytime(city.timezone), live: false, snowDepthM: 0 };
}

/** Live conditions per city, cached for ten minutes. */
export class WeatherStore {
  private cache = new Map<string, { at: number; w: Weather }>();
  private abort: AbortController | null = null;
  private prefetching = false;

  /** Cached live conditions younger than the TTL, else null. */
  fresh(city: CityDef): Weather | null {
    const cached = this.cache.get(city.slug);
    return cached && Date.now() - cached.at < TTL_MS ? cached.w : null;
  }

  /** Abort the in-flight single-city request, if any. */
  cancel(): void {
    this.abort?.abort();
    this.abort = null;
  }

  /** Fetch and cache one city, superseding any earlier single-city request. Null when aborted or unavailable. */
  async load(city: CityDef): Promise<Weather | null> {
    this.cancel();
    const ctrl = new AbortController();
    this.abort = ctrl;
    try {
      const w = await fetchWeather(city.lat, city.lon, ctrl.signal);
      this.cache.set(city.slug, { at: Date.now(), w });
      return w;
    } catch (err) {
      if ((err as Error).name !== 'AbortError') console.warn(`Live weather unavailable for ${city.name}; showing typical conditions.`, err);
      return null;
    }
  }

  /** One batched request fills the cache for every stale city. Resolves true when it fetched. */
  async prefetch(cities: readonly CityDef[]): Promise<boolean> {
    const stale = cities.filter((c) => !this.fresh(c));
    if (this.prefetching || stale.length === 0) return false;
    this.prefetching = true;
    try {
      const results = await fetchWeatherMany(stale);
      const at = Date.now();
      results.forEach((w, i) => {
        if (w) this.cache.set(stale[i].slug, { at, w });
      });
      return true;
    } catch (err) {
      console.warn('Live weather unavailable for the city list; showing typical conditions.', err);
      return false;
    } finally {
      this.prefetching = false;
    }
  }
}
