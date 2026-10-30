import { kindFromWmo, type WeatherKind } from './codes';

/** Lighting phase, from first light to the small hours. */
export type Daytime = 'dawn' | 'day' | 'dusk' | 'night' | 'dark';

export const DAYTIME_LABEL: Record<Daytime, string> = {
  dawn: 'Dawn',
  day: 'Day',
  dusk: 'Dusk',
  night: 'Night',
  dark: 'Dark',
};

/** Night and dark draw the moon, the night palette and lit windows. */
export const isLit = (d: Daytime) => d === 'dawn' || d === 'day' || d === 'dusk';

export interface Weather {
  kind: WeatherKind;
  tempC: number;
  daytime: Daytime;
  live: boolean;
  /** Lying snow in metres (Open-Meteo `snow_depth`); 0 when unknown or typical. */
  snowDepthM: number;
}

interface OpenMeteoCurrent {
  current?: { time?: string; temperature_2m?: number; weather_code?: number; is_day?: number; snow_depth?: number | null };
}

const ENDPOINT = 'https://api.open-meteo.com/v1/forecast';
const FIELDS = 'current=temperature_2m,weather_code,is_day,snow_depth&timezone=auto';

/**
 * Phase at a local `hour`, given whether the sun is up. Lit hours before 08:00
 * are dawn and from 17:00 dusk; unlit hours from 23:00 to before 04:00 are dark.
 */
export function daytimeAt(hour: number, sunUp: boolean): Daytime {
  if (sunUp) return hour < 8 ? 'dawn' : hour >= 17 ? 'dusk' : 'day';
  return hour >= 23 || hour < 4 ? 'dark' : 'night';
}

function parseCurrent(body: OpenMeteoCurrent): Weather | null {
  const c = body.current;
  if (c?.temperature_2m === undefined || c.weather_code === undefined) return null;
  const sunUp = c.is_day !== 0;
  // `time` is the place's local "YYYY-MM-DDTHH:MM" (timezone=auto); without it only day/night is known.
  const hour = c.time ? Number(c.time.slice(11, 13)) : NaN;
  const daytime = Number.isNaN(hour) ? (sunUp ? 'day' : 'night') : daytimeAt(hour, sunUp);
  return { kind: kindFromWmo(c.weather_code), tempC: c.temperature_2m, daytime, live: true, snowDepthM: c.snow_depth ?? 0 };
}

/** Current conditions from Open-Meteo (free, keyless, CORS-enabled). */
export async function fetchWeather(lat: number, lon: number, signal?: AbortSignal): Promise<Weather> {
  const [w] = await fetchWeatherMany([{ lat, lon }], signal);
  if (!w) throw new Error('Open-Meteo: missing current fields');
  return w;
}

/**
 * Current conditions for several places in one request. Results follow the
 * input order; a place the API returned no usable data for is `null`.
 */
export async function fetchWeatherMany(points: readonly { lat: number; lon: number }[], signal?: AbortSignal): Promise<(Weather | null)[]> {
  if (points.length === 0) return [];
  const lat = points.map((p) => p.lat).join(',');
  const lon = points.map((p) => p.lon).join(',');
  const res = await fetch(`${ENDPOINT}?latitude=${lat}&longitude=${lon}&${FIELDS}`, { signal });
  if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
  // One location returns an object; several return an array in request order.
  const body = (await res.json()) as OpenMeteoCurrent | OpenMeteoCurrent[];
  const list = Array.isArray(body) ? body : [body];
  if (list.length !== points.length) throw new Error(`Open-Meteo: expected ${points.length} locations, got ${list.length}`);
  return list.map(parseCurrent);
}

/** Phase at the city's local hour, assuming the sun is up 06:00–19:00, for fallback weather. */
export function localDaytime(timeZone: string, now = new Date()): Daytime {
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone }).format(now));
  return daytimeAt(hour, hour >= 6 && hour < 19);
}

/** "Tuesday, December 2, 2025" in the city's own timezone. */
export function formatLocalDate(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone }).format(now);
}

/** "14:05" — the city's own wall-clock time. */
export function formatLocalTime(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone }).format(now);
}
