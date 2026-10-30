import type { CityDef } from '../cities/types';
import type { Weather } from './api';

/** How much weather lies on the diorama's surfaces, each 0..1. */
export interface Surface {
  /** Snow cover on upward faces (slush on roads). */
  snow: number;
  /** Darkened, glossy ground with puddles. */
  wet: number;
  /** Frozen water. */
  ice: number;
  /** Depth haze. */
  fog: number;
}

/** Snow depth that reads as full cover. */
const FULL_COVER_M = 0.05;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

export function surfaceFor(w: Weather, city: Pick<CityDef, 'snow'>): Surface {
  const snow = !city.snow ? 0 : w.kind === 'snow' ? 1 : clamp01(w.snowDepthM / FULL_COVER_M);
  const wet = snow >= 0.5 ? 0 : w.kind === 'rain' ? 1 : w.kind === 'fog' ? 0.3 : 0;
  const ice = city.snow && (w.kind === 'snow' || w.tempC <= -2) ? 1 : 0;
  const fog = w.kind === 'fog' ? 1 : w.kind === 'rain' ? 0.25 : 0;
  return { snow, wet, ice, fog };
}
