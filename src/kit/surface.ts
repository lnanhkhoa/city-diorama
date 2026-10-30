import * as THREE from 'three';
import type { Surface } from '../weather/surface';

/**
 * How weather lies on a material. `ground` (the default for `mat()`): snow on
 * upward faces, wet darkening and puddles. `road`: the same, but snow only as
 * grey slush, like ploughed streets. `none`: untouched (people, vehicle paint,
 * screens, lit glass).
 */
export type SurfaceRole = 'ground' | 'road' | 'none';

/** Weather on every patched material, each 0..1; eased by `updateSurface`. Shared by reference, so no recompiles. */
export const surfaceUniforms = { uSnow: { value: 0 }, uWet: { value: 0 }, uIce: { value: 0 } };

/** Window/lamp glow level 0 (day) to 1 (deep night), set by `setCityLights`; shaders read it as a uniform. */
export const cityLight = { value: 0 };

const target: Omit<Surface, 'fog'> = { snow: 0, wet: 0, ice: 0 };
/** Full change per second: a whole switch blends over ~2 s. */
const RATE = 0.5;

/** Aim the surface layer at `s`; `immediate` jumps there (first frame of a scene). */
export function setSurface(s: Surface, immediate = false): void {
  target.snow = s.snow;
  target.wet = s.wet;
  target.ice = s.ice;
  if (immediate) {
    surfaceUniforms.uSnow.value = s.snow;
    surfaceUniforms.uWet.value = s.wet;
    surfaceUniforms.uIce.value = s.ice;
  }
}

const approach = (u: { value: number }, to: number, step: number) => {
  u.value = u.value < to ? Math.min(to, u.value + step) : Math.max(to, u.value - step);
};

/** Ease the uniforms toward the target; once per frame. */
export function updateSurface(dt: number): void {
  const step = RATE * dt;
  approach(surfaceUniforms.uSnow, target.snow, step);
  approach(surfaceUniforms.uWet, target.wet, step);
  approach(surfaceUniforms.uIce, target.ice, step);
}

/** GLSL literal of a colour in the working (linear) space, as `diffuseColor` is. */
export const glslColor = (c: THREE.ColorRepresentation) => {
  const { r, g, b } = new THREE.Color(c);
  return `vec3(${r.toFixed(4)}, ${g.toFixed(4)}, ${b.toFixed(4)})`;
};

const SNOW = glslColor(0xf4f7fb);
const SLUSH = glslColor(0xb9bec4);
const SHEEN = glslColor(0xffc46b);

const FRAGMENT_HEAD = `uniform float uSnow;
uniform float uWet;
uniform float uCityLight;
varying vec3 vSurfWorld;
float surfHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float surfNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = x - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(surfHash(i), surfHash(i + vec2(1.0, 0.0)), u.x), mix(surfHash(i + vec2(0.0, 1.0)), surfHash(i + vec2(1.0)), u.x), u.y);
}
`;

// Runs after the normal is final and before lighting reads albedo, roughness and metalness.
const surfaceBody = (role: Exclude<SurfaceRole, 'none'>) => `
float surfPuddle = 0.0;
{
  float surfUp = transformDirectionByInverseViewMatrix(normal, viewMatrix).y;
  vec2 sp = vSurfWorld.xz;
  // Rain: darker, glossier everywhere; puddles (a noise mask) on flat ground go mirror-smooth.
  surfPuddle = uWet * smoothstep(0.86, 0.97, surfUp) * smoothstep(0.5, 0.66, surfNoise(sp * 0.9 + 7.3));
  diffuseColor.rgb *= mix(1.0, 0.65, uWet) * (1.0 - 0.2 * surfPuddle);
  roughnessFactor = mix(roughnessFactor * mix(1.0, 0.35, uWet), 0.05, surfPuddle);
  // Snow on faces pointing up: flat tops fill first, steep ones (conifers, pitched roofs) stay patchy. Noise also
  // varies with height so a steep face gets bands rather than one value; at partial depth flat ground is patchy too.
  float n = surfNoise(sp * 1.6 + vSurfWorld.y * 2.3) * 0.65 + surfNoise(sp * 5.3 + vSurfWorld.y * 7.1 + 3.1) * 0.35;
  float flatness = smoothstep(0.35, 0.8, surfUp);
  float cover = smoothstep(n - 0.12, n + 0.12, uSnow * mix(0.6, 1.25, flatness) - 0.12) * smoothstep(0.12, 0.25, surfUp);
${
  role === 'road'
    ? `  cover *= 0.35;
  diffuseColor.rgb = mix(diffuseColor.rgb, ${SLUSH}, cover);
  roughnessFactor = mix(roughnessFactor, 0.6, cover);`
    : `  diffuseColor.rgb = mix(diffuseColor.rgb, ${SNOW}, cover);
  roughnessFactor = mix(roughnessFactor, 0.9, cover);
  metalnessFactor = mix(metalnessFactor, 0.0, cover);`
}
}`;

// No screen-space reflections: at night street-level puddles glow warm toward grazing angles, standing in for mirrored
// city lights (roofs are above the lights, so they stay dark).
const SHEEN_BODY = `
{
  float surfFacing = clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0);
  float surfStreet = 1.0 - smoothstep(0.15, 0.5, vSurfWorld.y);
  totalEmissiveRadiance += ${SHEEN} * (0.3 * uCityLight * surfPuddle * surfStreet * pow(1.0 - surfFacing, 2.0) * (0.4 + surfNoise(vSurfWorld.xz * 3.1)));
}`;

/**
 * Patch a standard material so it shows `surfaceUniforms`. Chains any existing
 * `onBeforeCompile` and keys the program by role, so all materials of a role
 * share one program. Idempotent; `none` leaves the material alone.
 */
export function patchSurface(m: THREE.MeshStandardMaterial, role: SurfaceRole): void {
  if (role === 'none' || m.userData.surface) return;
  m.userData.surface = role;
  const prevCompile = m.onBeforeCompile;
  const prevKey = Object.hasOwn(m, 'customProgramCacheKey') ? m.customProgramCacheKey : () => prevCompile.toString();
  const body = surfaceBody(role);
  m.onBeforeCompile = (shader, renderer) => {
    prevCompile.call(m, shader, renderer);
    shader.uniforms.uSnow = surfaceUniforms.uSnow;
    shader.uniforms.uWet = surfaceUniforms.uWet;
    shader.uniforms.uCityLight = cityLight;
    shader.vertexShader = shader.vertexShader.replace('void main() {', 'varying vec3 vSurfWorld;\nvoid main() {').replace(
      '#include <project_vertex>',
      `#include <project_vertex>
vec4 surfP = vec4(transformed, 1.0);
#ifdef USE_BATCHING
surfP = batchingMatrix * surfP;
#endif
#ifdef USE_INSTANCING
surfP = instanceMatrix * surfP;
#endif
vSurfWorld = (modelMatrix * surfP).xyz;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${FRAGMENT_HEAD}void main() {`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>${body}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${SHEEN_BODY}`);
  };
  m.customProgramCacheKey = () => `${prevKey.call(m)}|kit-surface-${role}`;
}
