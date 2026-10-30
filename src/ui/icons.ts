import { isLit, type Daytime } from '../weather/api';
import type { WeatherKind } from '../weather/codes';

const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

const CLOUD = '<path d="M14 34h21a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 0 13z"/>';
const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315]
  .map((a) => {
    const r = (a * Math.PI) / 180;
    const p = (d: number) => `${(24 + Math.cos(r) * d).toFixed(1)} ${(24 + Math.sin(r) * d).toFixed(1)}`;
    return `<path d="M${p(13)}L${p(18)}"/>`;
  })
  .join('');

const SUN = svg(`<circle cx="24" cy="24" r="8"/>${SUN_RAYS}`);
const MOON = svg('<path d="M31 9a14 14 0 1 0 8 23A12 12 0 0 1 31 9z"/>');

const ICONS: Record<WeatherKind, string> = {
  clear: SUN,
  cloudy: svg(CLOUD),
  fog: svg('<path d="M14 26h21a8 8 0 0 0 0-16 11 11 0 0 0-21 3 6.5 6.5 0 0 0 0 13z"/><path d="M9 33h30M13 39h22"/>'),
  rain: svg(`${CLOUD}<path d="M17 38l-2 5M24 38l-2 5M31 38l-2 5"/>`),
  snow: svg('<path d="M24 4v40M6.7 14l34.6 20M6.7 34l34.6-20"/><path d="M19 7l5 4 5-4M19 41l5-4 5 4M7 21l6-1-2-6M41 27l-6 1 2 6M7 27l6 1-2 6M41 21l-6-1 2-6"/>'),
};

export function weatherIcon(kind: WeatherKind, daytime: Daytime): string {
  return kind === 'clear' && !isLit(daytime) ? MOON : ICONS[kind];
}
