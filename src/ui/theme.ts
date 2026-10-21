import type { CityDef } from '../cities/types';
import type { Daytime } from '../weather/api';

type Theme = CityDef['theme'];

/** Shared palettes that replace each city's own (daytime) theme outside full day. */
const PHASE_THEME: Record<Exclude<Daytime, 'day'>, Theme> = {
  dawn: { bg: ['#e9c6c4', '#b9b3cf'], ink: '#2f2a40' },
  dusk: { bg: ['#eab08c', '#9c86ad'], ink: '#2a2036' },
  night: { bg: ['#232a3d', '#3a4560'], ink: '#e9edf5' },
  dark: { bg: ['#0e121d', '#1b2133'], ink: '#dfe5f0' },
};

export function themeFor(city: CityDef, daytime: Daytime): Theme {
  return daytime === 'day' ? city.theme : PHASE_THEME[daytime];
}

/** Set the page palette (CSS variables and browser chrome colour). */
export function applyTheme(city: CityDef, daytime: Daytime): void {
  const root = document.documentElement.style;
  const theme = themeFor(city, daytime);
  root.setProperty('--bg-top', theme.bg[0]);
  root.setProperty('--bg-bottom', theme.bg[1]);
  root.setProperty('--ink', theme.ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg[0]);
}
