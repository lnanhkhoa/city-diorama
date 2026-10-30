/** Five conditions that each look different on the diorama (light, surfaces, particles). */
export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'rain' | 'snow';

export const WEATHER_LABEL: Record<WeatherKind, string> = {
  clear: 'Clear',
  cloudy: 'Overcast',
  fog: 'Fog',
  rain: 'Rain',
  snow: 'Snow',
};

/** Map a WMO weather interpretation code (as returned by Open-Meteo) to a kind. */
export function kindFromWmo(code: number): WeatherKind {
  if (code >= 0 && code <= 2) return 'clear';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || (code >= 95 && code <= 99)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'cloudy';
}
