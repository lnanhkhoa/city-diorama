import { afterEach, describe, expect, it, vi } from 'vitest';
import { CITIES } from '../src/cities';
import type { CityDef } from '../src/cities/types';
import { matchCities } from '../src/ui/picker';
import { fetchWeatherMany, formatLocalTime } from '../src/weather/api';

const city = (name: string, country: string): CityDef => ({ ...CITIES[0], slug: name.toLowerCase().replace(/\s+/g, '-'), name, country });
const names = (list: CityDef[]) => list.map((c) => c.name);

describe('matchCities', () => {
  const sample = [
    city('Paris', 'France'),
    city('New York', 'United States'),
    city('San Francisco', 'United States'),
    city('São Paulo', 'Brazil'),
    city('Kuala Lumpur', 'Malaysia'),
    city('Newcastle', 'Australia'),
  ];

  it('returns every city in registry order for a blank query', () => {
    expect(names(matchCities(sample, '   '))).toEqual(names(sample));
  });

  it('ranks name prefixes above word prefixes, initials, country and substrings', () => {
    // "new": Newcastle (name prefix) ties New York (name prefix) → registry order.
    expect(names(matchCities(sample, 'new'))).toEqual(['New York', 'Newcastle']);
    // "fr": San Francisco (word prefix) beats Paris (country prefix).
    expect(names(matchCities(sample, 'fr'))).toEqual(['San Francisco', 'Paris']);
    expect(names(matchCities(sample, 'kl'))).toEqual(['Kuala Lumpur']);
    expect(names(matchCities(sample, 'sf'))).toEqual(['San Francisco']);
    expect(names(matchCities(sample, 'united'))).toEqual(['New York', 'San Francisco']);
    expect(names(matchCities(sample, 'ris'))).toEqual(['Paris']);
  });

  it('ignores case, accents and extra spaces', () => {
    expect(names(matchCities(sample, 'SAO'))).toEqual(['São Paulo']);
    expect(names(matchCities(sample, '  new   york '))).toEqual(['New York']);
  });

  it('returns nothing when no city matches', () => {
    expect(matchCities(sample, 'atlantis')).toEqual([]);
  });
});

describe('fetchWeatherMany', () => {
  afterEach(() => vi.unstubAllGlobals());

  const current = (code: number, t: number, day = 1, time?: string) => ({ current: { time, temperature_2m: t, weather_code: code, is_day: day } });
  const respond = (body: unknown) => vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body))));

  it('sends every place in one request and keeps input order', async () => {
    respond([current(0, 21), current(61, 9, 0)]);
    const w = await fetchWeatherMany([{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }]);
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toContain('latitude=1,3&longitude=2,4');
    expect(w).toEqual([
      { kind: 'clear', tempC: 21, daytime: 'day', live: true },
      { kind: 'rain', tempC: 9, daytime: 'night', live: true },
    ]);
  });

  it('refines day/night into a phase from the place-local time', async () => {
    respond([current(0, 21, 1, '2025-12-02T07:15'), current(0, 18, 1, '2025-12-02T18:45'), current(0, 5, 0, '2025-12-03T01:00')]);
    const w = await fetchWeatherMany([{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }, { lat: 5, lon: 6 }]);
    expect(w.map((x) => x?.daytime)).toEqual(['dawn', 'dusk', 'dark']);
  });

  it('accepts the single-object response the API returns for one place', async () => {
    respond(current(3, 12));
    expect(await fetchWeatherMany([{ lat: 1, lon: 2 }])).toEqual([{ kind: 'cloudy', tempC: 12, daytime: 'day', live: true }]);
  });

  it('marks places without usable data as null and rejects a mismatched count', async () => {
    respond([current(0, 20), {}]);
    expect(await fetchWeatherMany([{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }])).toEqual([{ kind: 'clear', tempC: 20, daytime: 'day', live: true }, null]);
    respond([current(0, 20)]);
    await expect(fetchWeatherMany([{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }])).rejects.toThrow(/expected 2/);
  });
});

it('formats wall-clock time in the city timezone', () => {
  const instant = new Date(Date.UTC(2025, 11, 2, 23, 30));
  expect(formatLocalTime('America/New_York', instant)).toBe('18:30');
  expect(formatLocalTime('Asia/Kolkata', instant)).toBe('05:00');
});
