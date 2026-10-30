import * as THREE from 'three';
import { TILE } from './base';
import { SHORE_MAX, waterShore } from './shore';
import { cityLight, glslColor, patchSurface, surfaceUniforms, type SurfaceRole } from './surface';

export interface MatOptions {
  roughness?: number;
  metalness?: number;
  emissive?: THREE.ColorRepresentation;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  flat?: boolean;
  /** How weather lies on it (see `SurfaceRole`); default `ground`, or `none` when `emissive` is set. */
  surface?: SurfaceRole;
}

const cache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * Shared, cached standard material. Identical arguments return the same
 * instance, which lets the static-geometry merger batch meshes by material.
 */
export function mat(color: THREE.ColorRepresentation, o: MatOptions = {}): THREE.MeshStandardMaterial {
  const surface = o.surface ?? (o.emissive === undefined ? 'ground' : 'none');
  const key = `${new THREE.Color(color).getHexString()}|${o.roughness ?? 0.85}|${o.metalness ?? 0}|${o.emissive ?? ''}|${o.emissiveIntensity ?? 1}|${o.transparent ?? false}|${o.opacity ?? 1}|${o.flat ?? false}|${surface}`;
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
    patchSurface(m, surface);
    cache.set(key, m);
  }
  return m;
}

/** Seconds, advanced by the stage each frame; drives every water surface. */
export const waterTime = { value: 0 };

/** Sky radiance the water mirrors: horizon colour scaled by sky-light strength. Set by `setWaterSky`. */
const waterSky = { value: new THREE.Color(0xdbe9ff).multiplyScalar(0.8) };

/** Point every water surface at the current sky (the hemisphere light's colour and intensity). */
export function setWaterSky(color: THREE.ColorRepresentation, intensity: number): void {
  waterSky.value.set(color).multiplyScalar(intensity);
}

const waterCache = new Map<number, THREE.MeshStandardMaterial>();
/** Frozen water, blended in by `surfaceUniforms.uIce`. */
const ICE = glslColor(0xc4d8e6);

/**
 * Water with animated ripples. Two crossing swell trains plus a fine chop tilt
 * the shading normal of upward-facing faces, derived from world position, so
 * the surface glints under the key light and needs no UVs (it still merges).
 * The surface does not mirror the studio environment map (its light panels read
 * as white smears); instead a Fresnel term blends the deepened body colour toward
 * a sky gradient, so water looks dark and saturated looking down into it and
 * silvers toward grazing angles and on wave flanks. Slow, drifting wind patches
 * vary the chop and the sheen across open water. Side faces (quay walls, slab
 * edges) keep their flat normal and plain shading. `surfaceUniforms.uIce`
 * freezes the top: pale matt ice without ripples, foam or glitter.
 */
export function waterMat(color: THREE.ColorRepresentation): THREE.MeshStandardMaterial {
  const hex = new THREE.Color(color).getHex();
  let m = waterCache.get(hex);
  if (m) return m;
  m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.12, metalness: 0 });
  m.userData.water = true;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = waterTime;
    shader.uniforms.uWaterSky = waterSky;
    shader.uniforms.uCityLight = cityLight;
    shader.uniforms.uIce = surfaceUniforms.uIce;
    shader.uniforms.uShore = waterShore.map;
    shader.uniforms.uShoreScale = waterShore.scale;
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vWaterPos;\nvarying float vWaterUp;\nvoid main() {')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvWaterPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWaterUp = normalize(mat3(modelMatrix) * objectNormal).y;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        'void main() {',
        `uniform float uWaterTime;
uniform vec3 uWaterSky;
uniform float uCityLight;
uniform float uIce;
uniform sampler2D uShore;
uniform float uShoreScale;
varying vec3 vWaterPos;
varying float vWaterUp;
float waterHash(vec2 c) { return fract(sin(dot(c, vec2(127.1, 311.7))) * 43758.5453); }
float waterNoise(vec2 x) {
  vec2 i = floor(x);
  vec2 f = x - i;
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(waterHash(i), waterHash(i + vec2(1.0, 0.0)), u.x), mix(waterHash(i + vec2(0.0, 1.0)), waterHash(i + vec2(1.0)), u.x), u.y);
}
void main() {
float waterTop = step(0.7, vWaterUp);
float waterWind = 0.0;
// Surf zone off a beach: its strength, the travelling wave phase and the onshore direction (world xz, pointing out to sea).
float waterSurf = 0.0;
float waterSurfPhase = 0.0;
vec2 waterOffshore = vec2(0.0);`,
      )
      // Looking down into water shows its absorbed, deeper body colour; slow wind patches shade it a little. Off a beach
      // or low bank the bed shows through: the margin is lighter and greener, and small waves roll in through a surf zone,
      // their broken crests foaming. Every shore gets a thin lapping foam line, fainter against walls and quays, where
      // the water stays deep.
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
if (waterTop > 0.5) {
  vec2 q = vWaterPos.xz * 0.23 + vec2(uWaterTime * 0.035, uWaterTime * -0.02);
  waterWind = 0.5 + 0.25 * sin(q.x * 2.3 + sin(q.y * 1.7)) + 0.25 * sin(q.y * 2.9 - q.x * 0.8 + 1.3);
  vec3 deep = pow(diffuseColor.rgb, vec3(1.18));
  // Desaturate a little by day and more at night, when water reads near-black under moonlight.
  deep = mix(vec3(dot(deep, vec3(0.2126, 0.7152, 0.0722))), deep, mix(0.86, 0.55, uCityLight));
  deep *= mix(0.82, 0.94, waterWind);
  vec2 shoreUV = vWaterPos.xz / (uShoreScale * ${TILE.toFixed(1)}) + 0.5;
  vec2 shoreD = texture2D(uShore, shoreUV).rg * ${SHORE_MAX.toFixed(2)};
  float shallow = 1.0 - smoothstep(0.0, 0.42, shoreD.g);
  vec3 bed = min(vec3(1.0), diffuseColor.rgb * vec3(1.12, 1.22, 1.08) + vec3(0.06, 0.07, 0.04));
  vec3 body = mix(deep, bed, shallow * shallow * 0.85);
  float lap = 0.6 + 0.4 * sin(uWaterTime * 1.7 + (vWaterPos.x - vWaterPos.z) * 2.3);
  float beach = 1.0 - smoothstep(0.0, 0.12, shoreD.g - shoreD.r);
  float foam = (1.0 - smoothstep(0.02, 0.05 + 0.04 * lap, shoreD.r)) * mix(0.25, 0.55, beach);
  // Surf: crests parallel to the beach, travelling in (the phase grows offshore and with time, so a crest's distance
  // shrinks), fading out ~0.35 from the beach and broken into patches so they never read as stripes.
  waterSurf = (1.0 - smoothstep(0.06, 0.36, shoreD.g)) * step(shoreD.g, ${SHORE_MAX.toFixed(2)} - 0.01);
  float sEps = ${(1 / 512).toFixed(5)};
  waterOffshore = vec2(
    texture2D(uShore, shoreUV + vec2(sEps, 0.0)).g - texture2D(uShore, shoreUV - vec2(sEps, 0.0)).g,
    texture2D(uShore, shoreUV + vec2(0.0, sEps)).g - texture2D(uShore, shoreUV - vec2(0.0, sEps)).g);
  waterOffshore = length(waterOffshore) > 1e-4 ? normalize(waterOffshore) : vec2(0.0);
  // Shelter: probe 0.9 out to sea. In a lagoon, between the Palm's fronds or across a narrow river the probe lands near
  // the far shore, so the swell has no room to build and only a faint lap remains; open sea gets the full surf.
  float farShore = texture2D(uShore, shoreUV + waterOffshore * (0.9 / (uShoreScale * ${TILE.toFixed(1)}))).r * ${SHORE_MAX.toFixed(2)};
  waterSurf *= mix(0.12, 1.0, smoothstep(0.3, 0.65, farShore));
  float sBreak = waterNoise(vWaterPos.xz * 5.0 + vec2(uWaterTime * 0.25, -uWaterTime * 0.2));
  waterSurfPhase = shoreD.g * 34.0 + uWaterTime * 2.4 + (sBreak - 0.5) * 1.6;
  float crest = smoothstep(0.72, 0.97, 0.5 + 0.5 * sin(waterSurfPhase));
  foam = max(foam, crest * waterSurf * smoothstep(0.25, 0.65, sBreak + 0.15) * 0.75);
  // Frozen (uIce): pale, matt ice with no foam.
  foam *= 1.0 - uIce;
  diffuseColor.rgb = mix(mix(body, vec3(0.92, 0.94, 0.95), foam), ${ICE}, uIce) * mix(1.0, 0.5, uCityLight);
}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
if (waterTop > 0.5) {
  vec2 p = vWaterPos.xz;
  float t = uWaterTime;
  vec2 g = 0.9 * cos(dot(p, vec2(1.3, 0.4)) * 2.1 + t * 1.1) * vec2(1.3, 0.4);
  g += 0.7 * cos(dot(p, vec2(-0.5, 1.1)) * 2.7 + t * 1.4) * vec2(-0.5, 1.1);
  g += (0.25 + 0.35 * waterWind) * cos(dot(p, vec2(0.8, -1.2)) * 6.3 + t * 2.2) * vec2(0.8, -1.2);
  g += (0.1 + 0.3 * waterWind) * cos(dot(p, vec2(1.7, 1.1)) * 9.7 - t * 2.9) * vec2(1.7, 1.1);
  // Fine chop from drifting value noise, not another plane wave: glints break into speckles instead of lining up in dashes.
  vec2 np = p * 9.0 + vec2(t * 0.6, -t * 0.45);
  float n0 = waterNoise(np);
  vec2 ng = vec2(waterNoise(np + vec2(0.12, 0.0)) - n0, waterNoise(np + vec2(0.0, 0.12)) - n0) / 0.12;
  g += (0.15 + 0.35 * waterWind) * ng;
  // Surf ripples: the rolling waves tilt the surface toward and away from the beach.
  g += waterSurf * 2.6 * cos(waterSurfPhase) * waterOffshore;
  // Ice is still: no ripples or surf, and a duller finish.
  g *= 1.0 - uIce;
  roughnessFactor = mix(roughnessFactor, 0.35, uIce);
  normal = normalize((viewMatrix * vec4(normalize(vec3(-g.x * 0.07, 1.0, -g.y * 0.07)), 0.0)).xyz);
}`,
      )
      // The scene environment overrides envMapIntensity, so drop its specular on the top here; the sky term below replaces it.
      .replace(
        '#include <lights_fragment_maps>',
        `#include <lights_fragment_maps>
#if defined( RE_IndirectSpecular )
radiance *= 1.0 - waterTop;
#endif`,
      )
      // Direct highlights (mostly the rim light, near the mirror direction from this corner view) would blanket open
      // water in white patches; a drifting fine noise mask breaks them into small glitter points.
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
float waterSparkle = smoothstep(0.72, 0.92, waterNoise(vWaterPos.xz * 34.0 + vec2(uWaterTime * 1.3, uWaterTime * -0.9)));
reflectedLight.directSpecular *= mix(1.0, mix(waterSparkle * 0.8, 1.0, uIce), waterTop);`,
      )
      // Sky reflection: Schlick Fresnel (F0 0.02) on the rippled normal, mirroring a horizon-to-zenith gradient.
      .replace(
        '#include <opaque_fragment>',
        `if (waterTop > 0.5) {
  vec3 waterR = (vec4(reflect(-geometryViewDir, normal), 0.0) * viewMatrix).xyz;
  float up = clamp(waterR.y, 0.0, 1.0);
  vec3 sky = uWaterSky * mix(vec3(1.0), vec3(0.62, 0.72, 0.9), up);
  float cosV = clamp(dot(normal, geometryViewDir), 0.0, 1.0);
  float fresnel = 0.02 + 0.98 * pow(1.0 - cosV, 5.0);
  fresnel = clamp(fresnel * mix(2.2, 3.4, waterWind), 0.0, 0.85) * mix(1.0, 0.4, uIce);
  outgoingLight = mix(outgoingLight, sky, fresnel);
}
#include <opaque_fragment>`,
      );
  };
  m.customProgramCacheKey = () => 'kit-water';
  waterCache.set(hex, m);
  return m;
}

// Window glass: sky reflection by day, dark once the room light behind it dominates at night, and that room light.
const WINDOW_DAY = 0x6d8197;
const WINDOW_NIGHT = 0x2a2f3a;
const WINDOW_GLOW = 0xffc46b;

/**
 * Window glass. Its emissive glow follows `setCityLights`, so every building
 * that uses it lights up together.
 */
export const windowMaterial = new THREE.MeshStandardMaterial({
  color: WINDOW_DAY,
  roughness: 0.25,
  metalness: 0.4,
  emissive: WINDOW_GLOW,
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

/**
 * Surface floodlit at night (a statue, a stadium pitch): plain `color` by day,
 * glowing `glow` at `peak` intensity at full night. Follows `setCityLights`.
 */
export function floodMat(color: THREE.ColorRepresentation, glow: THREE.ColorRepresentation, peak: number, o: Pick<MatOptions, 'roughness' | 'flat'> = {}): THREE.MeshStandardMaterial {
  const key = `${new THREE.Color(color).getHexString()}|${new THREE.Color(glow).getHexString()}|${peak}|${o.roughness ?? 0.85}|${o.flat ?? false}`;
  let f = floodCache.get(key);
  if (!f) {
    f = {
      m: new THREE.MeshStandardMaterial({ color, emissive: glow, emissiveIntensity: peak * cityLight.value, roughness: o.roughness ?? 0.85, flatShading: o.flat ?? false }),
      peak,
    };
    // Statues and pitches take snow like any ground (snow on heads and shoulders).
    patchSurface(f.m, 'ground');
    floodCache.set(key, f);
  }
  return f.m;
}

/**
 * Floor lines on a baked tower, measured in its mesh's own frame (a `shape()` mesh starts at the bake's bottom): line
 * centres at `first + k·step` for k < `count`, each `width` tall, all as fractions of `height`, so they are the bake's
 * normalised levels.
 */
export interface FloorLines {
  height: number;
  first: number;
  step: number;
  count: number;
  width: number;
}

const FLOOR_LINES_GLSL = `uniform vec4 uLines;
uniform float uCrownFrom;
uniform vec3 uCrownDay;
uniform vec3 uCrownGlow;
uniform vec3 uWash;
uniform vec3 uLineDay;
uniform vec3 uLineNight;
uniform vec3 uLineGlow;
uniform float uCityLight;
varying float vLineY;
varying float vLineUp;
// 1 on a floor line, 0 between them: the nearest line within the range, edges softened over one pixel, walls only.
float floorLine() {
  float k = clamp(floor((vLineY - uLines.x) / uLines.y + 0.5), 0.0, uLines.w - 1.0);
  float d = abs(vLineY - (uLines.x + k * uLines.y));
  float aa = fwidth(vLineY);
  float on = 1.0 - smoothstep(0.5 * uLines.z - aa, 0.5 * uLines.z + aa, d);
  return on * (1.0 - smoothstep(0.6, 0.75, abs(vLineUp)));
}
// 1 at and above the crown's foot, 0 below it, softened over one pixel.
float crownBand() {
  float aa = fwidth(vLineY);
  return smoothstep(uCrownFrom - aa, uCrownFrom + aa, vLineY);
}`;

/**
 * Tower glass whose shader paints floor lines across its walls, with no extra geometry: window glass by day and lit
 * floors at night, following `setCityLights` exactly like `windowMaterial`. Flat decks and roofs stay plain glass.
 * `line` tints the lines by day (default: the window glass) for glass of another hue. `glow` at `peak` adds a night wash
 * over the rest of the surface, as `floodMat` does. `crown` gives the top of the tower, from `from` (a fraction of
 * `height`) up, its own colour by day and its own light at night (`glow` at `peak`, like a lit LED crown), without
 * floor lines. The lines are read in the mesh's own frame, so the material is flagged `userData.objectSpace` and
 * `mergeStatic` leaves its meshes in place. Not cached: each tower gets its own, since its lines live in the material's
 * uniforms.
 */
export function floorLinesGlass(
  color: THREE.ColorRepresentation,
  lines: FloorLines,
  o: Pick<MatOptions, 'roughness' | 'metalness' | 'flat'> & {
    line?: THREE.ColorRepresentation;
    glow?: THREE.ColorRepresentation;
    peak?: number;
    crown?: { from: number; color: THREE.ColorRepresentation; glow: THREE.ColorRepresentation; peak: number };
  } = {},
): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color, roughness: o.roughness ?? 0.85, metalness: o.metalness ?? 0, flatShading: o.flat ?? false });
  m.userData.objectSpace = true;
  const h = lines.height;
  const uniforms = {
    uLines: { value: new THREE.Vector4(lines.first * h, lines.step * h, lines.width * h, lines.count) },
    uWash: { value: new THREE.Color(o.glow ?? 0x000000).multiplyScalar(o.peak ?? 0) },
    uLineDay: { value: new THREE.Color(o.line ?? WINDOW_DAY) },
    uLineNight: { value: new THREE.Color(WINDOW_NIGHT) },
    uLineGlow: { value: new THREE.Color(WINDOW_GLOW) },
    uCityLight: cityLight,
    uCrownFrom: { value: o.crown ? o.crown.from * h : 1e9 },
    uCrownDay: { value: new THREE.Color(o.crown?.color ?? 0x000000) },
    uCrownGlow: { value: new THREE.Color(o.crown?.glow ?? 0x000000).multiplyScalar(o.crown?.peak ?? 0) },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying float vLineY;\nvarying float vLineUp;\nvoid main() {')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvLineY = transformed.y;\nvLineUp = objectNormal.y;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${FLOOR_LINES_GLSL}\nvoid main() {`)
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\nfloat crownMix = crownBand();\nfloat floorMix = floorLine() * (1.0 - crownMix);\ndiffuseColor.rgb = mix(diffuseColor.rgb, uCityLight > 0.5 ? uLineNight : uLineDay, floorMix);\ndiffuseColor.rgb = mix(diffuseColor.rgb, uCityLight > 0.5 ? uLineNight : uCrownDay, crownMix);',
      )
      // The lines take the window glass's finish (roughness 0.25, metalness 0.4).
      .replace(
        '#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.25, floorMix);\nmetalnessFactor = mix(metalnessFactor, 0.4, floorMix);',
      )
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += uCityLight * mix(mix(uWash, uLineGlow, floorMix), uCrownGlow, crownMix);');
  };
  m.customProgramCacheKey = () => 'kit-floor-lines';
  return m;
}

/** `level` 0 (full day, lights off) to 1 (deep night, every window lit). */
export function setCityLights(level: number): void {
  cityLight.value = level;
  windowMaterial.emissiveIntensity = level;
  // Glass reads dark once the room light behind it dominates the sky reflection.
  windowMaterial.color.set(level > 0.5 ? WINDOW_NIGHT : WINDOW_DAY);
  lampMaterial.emissiveIntensity = 0.15 + 2.3 * level;
  for (const { m, peak } of floodCache.values()) m.emissiveIntensity = peak * level;
}

/** Common palette. Cities may also call `mat()` for one-off colours. */
export const M = {
  get asphalt() { return mat(0x5d636b, { roughness: 0.95, surface: 'road' }); },
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
