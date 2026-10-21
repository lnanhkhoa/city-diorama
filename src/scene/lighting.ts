import * as THREE from 'three';
import { isLit, type Daytime } from '../weather/api';
import type { WeatherKind } from '../weather/codes';

export interface Lighting {
  sun: number;
  sunColor: number;
  rim: number;
  hemi: number;
  sky: number;
  ground: number;
  env: number;
  exposure: number;
  /** Window and lamp glow, see `setCityLights`. */
  lights: number;
}

/** Clear-sky lighting outside full day; cloud cover scales the lit phases in `lightingFor`. */
const PHASE_LIGHTING: Record<Exclude<Daytime, 'day'>, Lighting> = {
  dawn: { sun: 1.7, sunColor: 0xffc2a0, rim: 0.9, hemi: 0.75, sky: 0xf2c6cf, ground: 0x6e6272, env: 0.35, exposure: 1.0, lights: 0.2 },
  dusk: { sun: 1.9, sunColor: 0xff9d5c, rim: 0.7, hemi: 0.65, sky: 0xe9a98f, ground: 0x5c4a5c, env: 0.3, exposure: 1.0, lights: 0.45 },
  night: { sun: 0.45, sunColor: 0x9fb4ff, rim: 0.5, hemi: 0.45, sky: 0x3a4a78, ground: 0x1b1f2b, env: 0.15, exposure: 1.0, lights: 0.9 },
  dark: { sun: 0.2, sunColor: 0x8095d6, rim: 0.3, hemi: 0.28, sky: 0x232c52, ground: 0x0c0e15, env: 0.08, exposure: 1.0, lights: 1 },
};

export function lightingFor(kind: WeatherKind, daytime: Daytime): Lighting {
  if (daytime === 'day') {
    switch (kind) {
      case 'clear':
        return { sun: 3.0, sunColor: 0xfff0d8, rim: 0.9, hemi: 0.8, sky: 0xdbe9ff, ground: 0x9a8f80, env: 0.45, exposure: 1.0, lights: 0 };
      case 'partly':
        return { sun: 2.3, sunColor: 0xfff4e6, rim: 0.8, hemi: 1.0, sky: 0xdde6f2, ground: 0x8f8a82, env: 0.45, exposure: 1.0, lights: 0 };
      default:
        return { sun: 1.0, sunColor: 0xe6ecf5, rim: 0.5, hemi: 1.5, sky: 0xe4e9f0, ground: 0x7d8086, env: 0.55, exposure: 0.95, lights: 0 };
    }
  }
  const l = PHASE_LIGHTING[daytime];
  // Moonlight is already soft; at dawn and dusk cloud trades direct sun for sky light, as by day.
  if (!isLit(daytime) || kind === 'clear') return l;
  return kind === 'partly' ? { ...l, sun: l.sun * 0.8, hemi: l.hemi * 1.2 } : { ...l, sun: l.sun * 0.35, hemi: l.hemi * 1.8, env: l.env * 1.2 };
}

/** Unit vector toward `azimuth` (from +z toward +x) and `elevation`, degrees. */
function direction(azimuth: number, elevation: number): THREE.Vector3 {
  const a = THREE.MathUtils.degToRad(azimuth);
  const e = THREE.MathUtils.degToRad(elevation);
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
}

/** Orbit centre: a little above the tile so tall landmarks stay framed. */
export const TARGET = new THREE.Vector3(0, 3.2, 0);
/** Every city is laid out for this corner view; each city opens from it. */
export const VIEW_DIR = direction(45, 33);
// A key from camera-left (−15°) lights the +z facades and shades the +x ones,
// so every block shows two values and casts its shadow to screen-right, as in
// the reference prints. The rim comes from behind and picks out tower edges.
export const KEY_DIR = direction(-15, 52);
export const RIM_DIR = direction(200, 28);
