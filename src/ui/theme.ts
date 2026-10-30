import type { CityDef } from '../cities/types';
import type { Daytime } from '../weather/api';
import type { WeatherKind } from '../weather/codes';

type Theme = CityDef['theme'];

/** Shared palettes that replace each city's own (daytime) theme outside full day. */
const PHASE_THEME: Record<Exclude<Daytime, 'day'>, Theme> = {
  dawn: { bg: ['#e9c6c4', '#b9b3cf'], ink: '#2f2a40' },
  dusk: { bg: ['#eab08c', '#9c86ad'], ink: '#2a2036' },
  night: { bg: ['#232a3d', '#3a4560'], ink: '#e9edf5' },
  dark: { bg: ['#0e121d', '#1b2133'], ink: '#dfe5f0' },
};

/** Shared daytime palettes for weather other than clear sky, as the posters do. */
const WEATHER_THEME: Record<Exclude<WeatherKind, 'clear'>, Theme> = {
  cloudy: { bg: ['#cfd4da', '#b9c0c8'], ink: '#28303b' },
  fog: { bg: ['#e3e6e9', '#d2d6db'], ink: '#2a3038' },
  rain: { bg: ['#b9c4d1', '#a1aebf'], ink: '#2f3a4a' },
  snow: { bg: ['#d6e4f2', '#bfd3e8'], ink: '#27364a' },
};

export function themeFor(city: CityDef, daytime: Daytime, kind: WeatherKind): Theme {
  if (daytime !== 'day') return PHASE_THEME[daytime];
  return kind === 'clear' ? city.theme : WEATHER_THEME[kind];
}

/** Set the page palette (CSS variables and browser chrome colour). */
export function applyTheme(city: CityDef, daytime: Daytime, kind: WeatherKind): void {
  const root = document.documentElement.style;
  const theme = themeFor(city, daytime, kind);
  root.setProperty('--bg-top', theme.bg[0]);
  root.setProperty('--bg-bottom', theme.bg[1]);
  root.setProperty('--ink', theme.ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg[0]);
}
