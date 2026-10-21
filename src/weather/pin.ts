import { DAYTIME_LABEL, type Daytime, type Weather } from './api';
import { WEATHER_LABEL, type WeatherKind } from './codes';

/**
 * Overrides from the weather menu, mirrored in the URL. `?weather=<kind>`
 * (clear, partly, cloudy, fog, drizzle, rain, snow, storm) pins every city to
 * that condition at its typical temperature; live weather is then not fetched,
 * so nothing is labelled "Live". `?time=<phase>` (dawn, day, dusk, night, dark)
 * pins the lighting instead of following each city's clock.
 */
export interface WeatherPin {
  kind: WeatherKind | null;
  daytime: Daytime | null;
}

export const asWeatherKind = (v: string | null): WeatherKind | null =>
  v && Object.hasOwn(WEATHER_LABEL, v) ? (v as WeatherKind) : null;

export const asDaytime = (v: string | null): Daytime | null => (v && Object.hasOwn(DAYTIME_LABEL, v) ? (v as Daytime) : null);

export function pinFromSearch(params: URLSearchParams): WeatherPin {
  return { kind: asWeatherKind(params.get('weather')), daytime: asDaytime(params.get('time')) };
}

/** Write the pin into `params`, dropping keys that are not pinned. */
export function writePin(params: URLSearchParams, pin: WeatherPin): void {
  if (pin.kind) params.set('weather', pin.kind);
  else params.delete('weather');
  if (pin.daytime) params.set('time', pin.daytime);
  else params.delete('time');
}

export function applyPin(reported: Weather, pin: WeatherPin): Weather {
  return { ...reported, ...(pin.kind ? { kind: pin.kind } : {}), ...(pin.daytime ? { daytime: pin.daytime } : {}) };
}
