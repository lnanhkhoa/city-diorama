import * as THREE from 'three';

export interface MatOptions {
  roughness?: number;
  metalness?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  flat?: boolean;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Shared, cached standard material. Identical arguments return the same
 * instance, which lets the static-geometry merger batch meshes by material.
 */
export function mat(color: THREE.ColorRepresentation, o: MatOptions = {}): THREE.MeshStandardMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${o.roughness ?? 0.85}|${o.metalness ?? 0}|${o.emissive ?? ''}|${o.emissiveIntensity ?? 1}|${o.transparent ?? false}|${o.opacity ?? 1}|${o.flat ?? false}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.roughness ?? 0.85,
      metalness: o.metalness ?? 0,
      emissive: o.emissive ?? 0x000000,
      emissiveIntensity: o.emissiveIntensity ?? 1,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      flatShading: o.flat ?? false,
    });
    cache.set(key, m);
  }
  return m;
}

/** Seconds, advanced by the stage each frame; drives every water surface. */
export const waterTime = { value: 0 };

const waterCache = new Map<number, THREE.MeshStandardMaterial>();

/**
 * Water with animated ripples. Two crossing swell trains plus a fine chop tilt
 * the shading normal of upward-facing faces, derived from world position, so
 * the surface glints under the key light and needs no UVs (it still merges).
 * Side faces (quay walls, slab edges) keep their flat normal.
 */
export function waterMat(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const hex = new THREE.Color(color).getHex();
  let m = waterCache.get(hex);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.24, metalness: 0.05 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = waterTime;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vWaterPos;\nvarying float vWaterUp;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWaterUp = normalize(mat3(modelMatrix) * objectNormal).y;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', 'uniform float uWaterTime;\nvarying vec3 vWaterPos;\nvarying float vWaterUp;\nvoid main() {')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
if (vWaterUp > 0.7) {
  vec2 p = vWaterPos.xz;
  float t = uWaterTime;
  vec2 g = 0.9 * cos(dot(p, vec2(1.3, 0.4)) * 2.1 + t * 1.1) * vec2(1.3, 0.4);
  g += 0.7 * cos(dot(p, vec2(-0.5, 1.1)) * 2.7 + t * 1.4) * vec2(-0.5, 1.1);
  g += 0.35 * cos(dot(p, vec2(0.8, -1.2)) * 6.3 + t * 2.2) * vec2(0.8, -1.2);
  normal = normalize((viewMatrix * vec4(normalize(vec3(-g.x * 0.05, 1.0, -g.y * 0.05)), 0.0)).xyz);
}`,
      );
  };
  m.customProgramCacheKey = () => 'kit-water';
  waterCache.set(hex, m);
  return m;
}

/**
 * Window glass. Its emissive glow follows `setCityLights`, so every building
 * that uses it lights up together.
 */
export const windowMaterial = new THREE.MeshStandardMaterial({
  color: 0x6d8197,
  roughness: 0.25,
  metalness: 0.4,
  emissive: 0xffc46b,
  emissiveIntensity: 0,
});

/** Street-lamp bulbs; brighten with `setCityLights`. */
export const lampMaterial = new THREE.MeshStandardMaterial({
  color: 0xfff3d6,
  roughness: 0.4,
  emissive: 0xffd28a,
  emissiveIntensity: 0.15,
});

const floodCache = new Map<string, { m: THREE.MeshStandardMaterial; peak: number }>();
/** Last `setCityLights` level, so a city built later starts at the right glow. */
let lightLevel = 0;

/**
 * Surface floodlit at night (a statue, a stadium pitch): plain `color` by day,
 * glowing `glow` at `peak` intensity at full night. Follows `setCityLights`.
 */
export function floodMat(color: THREE.ColorRepresentation, glow: THREE.ColorRepresentation, peak: number, o: Pick<MatOptions, 'roughness' | 'flat'> = {}): THREE.MeshStandardMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${new THREE.Color(glow).getHexString()}|${peak}|${o.roughness ?? 0.85}|${o.flat ?? false}`;
  let f = floodCache.get(key);
  if (!f) {
    f = {
      m: new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: peak * lightLevel, roughness: o.roughness ?? 0.85, flatShading: o.flat ?? false }),
      peak,
    };
    floodCache.set(key, f);
  }
  return f.m;
}

/** `level` 0 (full day, lights off) to 1 (deep night, every window lit). */
export function setCityLights(level: number): void {
  lightLevel = level;
  windowMaterial.emissiveIntensity = level;
  // Glass reads dark once the room light behind it dominates the sky reflection.
  windowMaterial.color.set(level > 0.5 ? 0x2a2f3a : 0x6d8197);
  lampMaterial.emissiveIntensity = 0.15 + 2.3 * level;
  for (const { m, peak } of floodCache.values()) m.emissiveIntensity = peak * level;
}

/** Common palette. Cities may also call `mat()` for one-off colours. */
export const M = {
  get asphalt() { return mat(0x5d636b, { roughness: 0.95 }); },
  get roadLine() { return mat(0xf2efe6); },
  get pavement() { return mat(0xc9c4ba); },
  get cobble() { return mat(0x8d8f93, { roughness: 0.9 }); },
  get stone() { return mat(0xd9cdb6); },
  get limestone() { return mat(0xe8dcc3); },
  get sandstone() { return mat(0xd6b47e); },
  get marble() { return mat(0xf3efe7, { roughness: 0.5 }); },
  get brick() { return mat(0xb5583f); },
  get terracotta() { return mat(0xc9693f); },
  get ochre() { return mat(0xe0a75e); },
  get slate() { return mat(0x5f6b7a, { roughness: 0.7 }); },
  get copper() { return mat(0x6fae96, { roughness: 0.6 }); },
  get concrete() { return mat(0xbfc2c4); },
  get white() { return mat(0xf7f6f2); },
  get dark() { return mat(0x2e3238); },
  get steel() { return mat(0x9aa3ab, { roughness: 0.4, metalness: 0.6 }); },
  get iron() { return mat(0x8a6d4e, { roughness: 0.7, metalness: 0.3 }); },
  get glass() { return mat(0x8fb4cf, { roughness: 0.15, metalness: 0.5 }); },
  get glassDark() { return mat(0x4f6b85, { roughness: 0.15, metalness: 0.6 }); },
  get gold() { return mat(0xe1b13a, { roughness: 0.3, metalness: 0.8 }); },
  get grass() { return mat(0x8cc063); },
  get grassDark() { return mat(0x5e9b46); },
  get leaf() { return mat(0x5fa046, { flat: true }); },
  get leafDark() { return mat(0x3f7d3a, { flat: true }); },
  get trunk() { return mat(0x7a5536); },
  get water() { return waterMat(0x4fa3d1); },
  get sand() { return mat(0xe9d3a3); },
  get wood() { return mat(0x9c6b43); },
  get snow() { return mat(0xf4f7fb, { roughness: 0.9 }); },
  get red() { return mat(0xc8433a); },
};
