import type { CityBuild, CityDef } from './types';

/**
 * Every city in display order. Only this metadata ships in the entry bundle;
 * each scene (`./list/<slug>.ts`, default-exporting its build function) is a
 * separate chunk fetched by `loadCity` the first time it is shown.
 */
export const CITIES: CityDef[] = [
  {
    slug: 'hanoi',
    name: 'Hanoi',
    country: 'Vietnam',
    lat: 21.0278,
    lon: 105.8342,
    timezone: 'Asia/Ho_Chi_Minh',
    theme: { bg: ['#eef0e2', '#dde3c9'], ink: '#2b3226' },
    fallback: { kind: 'partly', tempC: 27 },
  },
  {
    slug: 'ho-chi-minh',
    name: 'Ho Chi Minh City',
    country: 'Vietnam',
    lat: 10.7769,
    lon: 106.7009,
    timezone: 'Asia/Ho_Chi_Minh',
    theme: { bg: ['#e9f1e2', '#d3e3cc'], ink: '#1c2a1d' },
    fallback: { kind: 'clear', tempC: 31 },
  },
  {
    slug: 'paris',
    name: 'Paris',
    country: 'France',
    lat: 48.8566,
    lon: 2.3522,
    timezone: 'Europe/Paris',
    theme: { bg: ['#b9c4d1', '#a1aebf'], ink: '#2f3a4a' },
    fallback: { kind: 'rain', tempC: 9 },
  },
  {
    slug: 'new-york',
    name: 'New York',
    country: 'United States',
    lat: 40.7128,
    lon: -74.006,
    timezone: 'America/New_York',
    theme: { bg: ['#d3e2f0', '#bcd0e4'], ink: '#27364a' },
    fallback: { kind: 'partly', tempC: 13 },
  },
  {
    slug: 'sydney',
    name: 'Sydney',
    country: 'Australia',
    lat: -33.8688,
    lon: 151.2093,
    timezone: 'Australia/Sydney',
    theme: { bg: ['#cde5f2', '#b2d3e9'], ink: '#28323e' },
    fallback: { kind: 'clear', tempC: 22 },
  },
  {
    slug: 'rome',
    name: 'Rome',
    country: 'Italy',
    lat: 41.9028,
    lon: 12.4964,
    timezone: 'Europe/Rome',
    theme: { bg: ['#cdd2d9', '#b8bfc9'], ink: '#2b313b' },
    fallback: { kind: 'clear', tempC: 20 },
  },
  {
    slug: 'kuala-lumpur',
    name: 'Kuala Lumpur',
    country: 'Malaysia',
    lat: 3.139,
    lon: 101.6869,
    timezone: 'Asia/Kuala_Lumpur',
    theme: { bg: ['#f4e7d4', '#ead7bd'], ink: '#2f2a25' },
    fallback: { kind: 'partly', tempC: 31 },
  },
  {
    slug: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lon: 139.6503,
    timezone: 'Asia/Tokyo',
    theme: { bg: ['#f1e4e8', '#e2cdd4'], ink: '#2c2833' },
    fallback: { kind: 'partly', tempC: 17 },
  },
  {
    slug: 'london',
    name: 'London',
    country: 'United Kingdom',
    lat: 51.5074,
    lon: -0.1278,
    timezone: 'Europe/London',
    theme: { bg: ['#cbd1d9', '#b4bcc7'], ink: '#28303b' },
    fallback: { kind: 'drizzle', tempC: 12 },
  },
  {
    slug: 'dubai',
    name: 'Dubai',
    country: 'United Arab Emirates',
    lat: 25.2048,
    lon: 55.2708,
    timezone: 'Asia/Dubai',
    theme: { bg: ['#f5e6cd', '#ead3ae'], ink: '#382c20' },
    fallback: { kind: 'clear', tempC: 33 },
  },
  {
    slug: 'cairo',
    name: 'Cairo',
    country: 'Egypt',
    lat: 30.0444,
    lon: 31.2357,
    timezone: 'Africa/Cairo',
    theme: { bg: ['#f2e1c4', '#e4cba2'], ink: '#3a2d1e' },
    fallback: { kind: 'clear', tempC: 29 },
  },
  {
    slug: 'rio-de-janeiro',
    name: 'Rio de Janeiro',
    country: 'Brazil',
    lat: -22.9068,
    lon: -43.1729,
    timezone: 'America/Sao_Paulo',
    theme: { bg: ['#d5edf0', '#bbe0e5'], ink: '#22343a' },
    fallback: { kind: 'partly', tempC: 26 },
  },
  {
    slug: 'san-francisco',
    name: 'San Francisco',
    country: 'United States',
    lat: 37.7749,
    lon: -122.4194,
    timezone: 'America/Los_Angeles',
    theme: { bg: ['#e0e6eb', '#c9d3dc'], ink: '#262f38' },
    fallback: { kind: 'fog', tempC: 16 },
  },
];

/** City for a location hash like `#/tokyo`; unknown or empty → first city. */
export function cityFromHash(hash: string): CityDef {
  const slug = hash.replace(/^#\/?/, '').toLowerCase();
  return CITIES.find((c) => c.slug === slug) ?? CITIES[0];
}

const modules = import.meta.glob<CityBuild>('./list/*.ts', { import: 'default' });
const requests = new Map<string, Promise<CityBuild>>();
const builds = new Map<string, Promise<CityBuild | null>>();

/**
 * Fetch a city's scene module. Every call for a city returns the same
 * promise; a failed request is forgotten so the next call asks again, though
 * Chromium keeps a failed module fetch for the life of the page, so only a
 * reload recovers there.
 */
export function loadCity(slug: string): Promise<CityBuild> {
  let p = requests.get(slug);
  if (!p) {
    const load = modules[`./list/${slug}.ts`];
    if (!load) return Promise.reject(new Error(`No scene module for city "${slug}"`));
    p = load();
    requests.set(slug, p);
    p.catch(() => requests.delete(slug));
  }
  return p;
}

/**
 * A city's build function for React's `use()`: one stable promise per city
 * that resolves to null (and logs) instead of rejecting, so a failed load
 * leaves the stage as it is rather than reaching an error boundary. The
 * outcome is kept for the life of the page; rendering again must not refetch.
 */
export function cityBuild(slug: string): Promise<CityBuild | null> {
  let p = builds.get(slug);
  if (!p) {
    p = loadCity(slug).catch((err: unknown) => {
      console.error(`Could not load city "${slug}"`, err);
      return null;
    });
    builds.set(slug, p);
  }
  return p;
}
