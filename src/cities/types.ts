import type * as THREE from 'three';
import type { WeatherKind } from '../weather/codes';

export interface CityScene {
  /** Diorama contents, including the base slab. Top surface at y = 0. */
  root: THREE.Group;
  /** Per-frame animation (traffic, boats). `t` seconds since start. */
  update?: (t: number, dt: number) => void;
}

/** Everything known about a city before its scene module loads. */
export interface CityDef {
  /** URL slug, e.g. `new-york`; the scene module is `./list/<slug>.ts`. */
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  /** IANA zone, used to show the city's local date. */
  timezone: string;
  /** Page background gradient (top, bottom) and text colour. */
  theme: { bg: [string, string]; ink: string };
  /** Shown before / instead of live weather. */
  fallback: { kind: WeatherKind; tempC: number };
}

/** Default export of a city scene module. */
export type CityBuild = () => CityScene;
