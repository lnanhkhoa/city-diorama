import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  Animator, M, archHole, area, beam, box, building, bus, car, cone, createBase, crosswalk, cylinder, floodMat, floorLinesGlass,
  gableRoof, group, hipRoof, lamp, lampMaterial, mansardRoof, mat, mergeStatic, patch, person, prism, profile, rng, road, scatter,
  shape, sphere, tree, tube, vietnamFlag, waterMat, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';
import LANDMARK_81 from '../shapes/landmark-81.shape';
import MOTORBIKE from '../shapes/motorbike-lite.shape';

// Layout follows assets/ho-chi-minh.png: positions were read off the poster through a homography fitted to the plinth
// corners, and the roads, river and plazas traced on a rectified top-down copy of its ground plane. The Saigon River runs
// along the left (x = -10) edge; the Ba Son bridge crosses it at the back and ramps down behind the Independence Palace,
// which faces the oval park and its fountain. The Notre-Dame Cathedral and the Opera House stand behind the park; Bitexco
// stands alone on a round forecourt at the back right, with two apartment blocks along the edge beyond it. A row of
// shophouses, the Central Post Office and Ben Thanh Market fill the right; Landmark 81, the palm plaza and the night-market
// stalls the left front. The avenue along the front edge carries
// most of the traffic past the Ben Thanh square, where Tran Nguyen Han on horseback faces the south gate and the Quach Thi
// Trang bust stands on a lawn at the corner; the junction at the market's corner is a signalised crossroads, as it has been
// since the roundabout made way for the metro station. The river stays inside a stone curb along the plinth's top edge.

type Mat = THREE.Material;
type XZ = [number, number];
type V3 = [number, number, number];
type Face = '+x' | '-x' | '+z' | '-z';
type PackKind = 'car' | 'taxi' | 'bikes';

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;

const ASPHALT = mat(0x8e8a89, { roughness: 0.95 });
const PLAZA = mat(0xe3ddcf);
const CURB = mat(0xf2efe7);
const LAWN = mat(0x9cc35b);
const HEDGE = mat(0x4f8a3e, { flat: true });
const EMBANK = mat(0xb7b0a2, { roughness: 0.9 });
const RIVER = waterMat(0x3f9aa5);
const POOL = waterMat(0x7cc3dc);
const TILE_RED = mat(0xc9553b, { roughness: 0.8 });
const TILE_ORANGE = mat(0xd9783e, { roughness: 0.8 });
const CREAM = mat(0xf3e8cc);
const SHUTTER = mat(0x3d6b52, { roughness: 0.8 });
const IRON = mat(0x3a3f3c, { roughness: 0.6, metalness: 0.3 });
const GRANITE = mat(0x8f8a84, { roughness: 0.8 });
const HELI = mat(0x58663f, { roughness: 0.6 });
// Landmarks are plain by day and floodlit at night.
const BRICK = floodMat(0xb85b3d, 0xff9a62, 0.4);
const OPERA_WALL = floodMat(0xeedcb2, 0xffd59a, 0.45);
const PALACE_WHITE = floodMat(0xf6f5f0, 0xfff1d8, 0.35);
const POST_YELLOW = floodMat(0xeec567, 0xffd27a, 0.45);
const MARKET_WALL = floodMat(0xf1e4c3, 0xffdfa6, 0.4);
const STATUE = floodMat(0xf0ede6, 0xffe6bf, 0.6);
const BRONZE = floodMat(0x6b5536, 0xffb466, 0.5, { roughness: 0.45 });
// Traffic signal lenses, lit day and night.
const SIGNAL_RED = mat(0xe8402f, { emissive: 0xff3a22, emissiveIntensity: 0.8 });
const SIGNAL_GREEN = mat(0x33c06a, { emissive: 0x33ff77, emissiveIntensity: 0.8 });
const PYLON = floodMat(0xf4f4f0, 0xfff0d6, 0.55, { roughness: 0.5 });
// Ba Son's stay cables, the "harp of light": pale by day, glowing blue-white at night.
const CABLE = floodMat(0xf4f4f0, 0x8fd2ff, 1.8, { roughness: 0.4 });
// Aviation lights: a pale lens by day, red at night only.
const BEACON = floodMat(0xd9d4cc, 0xff2211, 2.5);
const SLATE = mat(0x5f5c66, { roughness: 0.7 });
const SPIRE = mat(0xd6dae0, { roughness: 0.5 });
const SPRAY = mat(0xeaf6fb, { roughness: 0.2, transparent: true, opacity: 0.75 });
const AWNINGS = [0xc8433a, 0x2f7a4f, 0x3d6fb6, 0xe0b43a, 0xe2702e];
const SHOP_WALLS = [0xf2c95e, 0xf4dd98, 0xf0b98e, 0xd7e3b5, 0xf3e6c8, 0xe9a96b].map((c) => mat(c));
// Scooter paints; riders' shirts come from the same list, so a pack of traffic needs few materials.
const BIKE_PAINTS = [0xcc2e20, 0xf7f6f2, 0x3d6fb6, 0x2e3238, 0x7a828c, 0xe0b43a, 0x4a9a5b];
const HELMETS = [0xf7f6f2, 0xc8433a, 0x3d6fb6, 0xe0b43a];
const CAR_PAINTS = [0xf7f6f2, 0xb9bec4, 0x2f343b, 0x3d6fb6];

// ---------------------------------------------------------------------------
// Ground plan
// ---------------------------------------------------------------------------

// Saigon River shore, from the back edge to the front edge; the river fills everything left of it.
const SHORE: XZ[] = [
  [-7.85, -9.92], [-7.8, -8.6], [-7.55, -7.3], [-7.25, -6.1], [-7.0, -5.0], [-6.92, -3.8], [-6.85, -2.2],
  [-6.65, -0.4], [-6.4, 1.6], [-6.2, 3.6], [-6.12, 5.4], [-6.2, 7.2], [-6.35, 8.6], [-6.45, 9.92],
];

function shoreAt(z: number): number {
  let i = 1;
  while (i < SHORE.length - 1 && z > SHORE[i][1]) i++;
  const [x0, z0] = SHORE[i - 1];
  const [x1, z1] = SHORE[i];
  return x0 + ((x1 - x0) * (z - z0)) / (z1 - z0);
}

// Ba Son bridge: the deck runs along x at z = DECK_Z, the main span from the far edge to the city bank, then the ramp.
const DECK_Z = -3.85;
const DECK_Y = 0.95;
const DECK_W = 0.9;
const SPAN_X = -6.35;
const RAMP_X = -2.6;
const PYLON_X = -8.75;

const V1_X = 2.6; // street past the cathedral, the park and Ben Thanh
const AVE_Z = 8.4; // avenue along the front edge
const AVE_W = 1.6;
const PARK: XZ = [0.15, -0.65]; // oval lawn centre
const BITEXCO_AT: XZ = [5.45, -7.6];
const BITEXCO_PLAZA_R = 1.98; // its forecourt; the podium reaches 1.6 from the centre, its entrance canopy 1.8 in the opening

// Streets [x1, z1, x2, z2, width]; trees and props keep clear of them.
const ROADS: [number, number, number, number, number][] = [
  [V1_X, -9.94, V1_X, 9.94, 1.1],
  [-5.35, AVE_Z, 9.94, AVE_Z, AVE_W],
  [-5.35, 2.6, -2.4, 2.6, 0.9], // between the palace and Landmark 81
  [-4.95, 2.15, -4.95, AVE_Z - AVE_W / 2, 0.8], // riverside road
  [-1.5, 3.0, -1.5, AVE_Z - AVE_W / 2, 0.9], // between Landmark 81 and the stalls
  [3.1, -2.25, 9.94, -2.25, 0.9], // in front of the shophouses
  [3.1, 1.05, 8.8, 1.05, 0.9], // between the post office and Ben Thanh
  [9.2, -2.7, 9.2, AVE_Z - AVE_W / 2, 0.9], // along the right edge
  [-3.0, DECK_Z, -1.8, DECK_Z, DECK_W], // foot of the bridge, into the park ring
];

function onRoad(x: number, z: number, margin: number): boolean {
  return ROADS.some(([x1, z1, x2, z2, w]) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - x1 - t * dx, z - z1 - t * dz) < w / 2 + margin;
  });
}

function ellipse(cx: number, cz: number, rx: number, rz: number, n = 36): XZ[] {
  return Array.from({ length: n }, (_, i): XZ => [cx + Math.cos((i / n) * Math.PI * 2) * rx, cz + Math.sin((i / n) * Math.PI * 2) * rz]);
}

function roundRect(x0: number, z0: number, x1: number, z1: number, r: number): XZ[] {
  const pts: XZ[] = [];
  const corners: [number, number, number][] = [[x1 - r, z1 - r, 0], [x0 + r, z1 - r, 0.5], [x0 + r, z0 + r, 1], [x1 - r, z0 + r, 1.5]];
  for (const [cx, cz, a0] of corners) {
    for (let i = 0; i <= 4; i++) {
      const a = (a0 + i / 8) * Math.PI;
      pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  return pts;
}

// The river stays inside the plinth: the water stops at RIM, behind a stone curb along the plinth's top edge.
const RIM = 9.68;
const CORNER = 9.34; // centre of the plinth's rounded corners

/** The city bank, from the back curb to the front curb. */
function riverShore(): XZ[] {
  return [[shoreAt(-RIM), -RIM], ...SHORE.filter(([, z]) => Math.abs(z) < RIM), [shoreAt(RIM), RIM]];
}

/** Outer edge of the river `off` beyond the water line: along the front, round the corner, up the left edge, round the back corner. */
function riverRim(off: number): XZ[] {
  const r = RIM - CORNER + off;
  const pts: XZ[] = [[shoreAt(RIM), RIM + off]];
  for (const [a0, cz] of [[0.5, CORNER], [1, -CORNER]] as const) {
    for (let i = 0; i <= 6; i++) {
      const a = (a0 + i / 12) * Math.PI;
      pts.push([-CORNER + Math.cos(a) * r, cz + Math.sin(a) * r]);
    }
  }
  pts.push([shoreAt(-RIM), -RIM - off]);
  return pts;
}

/** Ground between the shore (z0..z1) and the line x = x1, kept just inland of the embankment. */
function shoreBand(z0: number, z1: number, x1: number): XZ[] {
  const pts: XZ[] = [[shoreAt(z0) + 0.06, z0]];
  for (const [sx, sz] of SHORE) if (sz > z0 && sz < z1) pts.push([sx + 0.06, sz]);
  pts.push([shoreAt(z1) + 0.06, z1], [x1, z1], [x1, z0]);
  return pts;
}

// ---------------------------------------------------------------------------
// Shared details
// ---------------------------------------------------------------------------

/** Arched window or doorway `w` wide whose arch springs at `h`; local +z points out of the wall. */
function archWin(w: number, h: number, glass: Mat, p: Place): THREE.Mesh {
  return profile(archHole(0, w, h, 4), 0.02, glass, p);
}

/** Round window of radius `r`, standing proud of the wall along local +z. */
function disc(r: number, m: Mat, p: Place): THREE.Group {
  const g = group(p);
  const d = cylinder(r, r, 0.025, m, { segments: 12 });
  d.rotation.x = Math.PI / 2;
  g.add(d);
  return g;
}

/** Lit clock dial with two hands, facing local +z. */
function clock(r: number, p: Place): THREE.Group {
  const g = disc(r, lampMaterial, p);
  g.add(box(0.012, r * 0.75, 0.01, M.dark, { z: 0.03 }));
  g.add(box(r * 0.5, 0.012, 0.01, M.dark, { x: r * 0.25, y: -0.006, z: 0.03 }));
  return g;
}

/** `n` evenly spaced copies of `make` across face `f` of a w × d block centred on the group origin, at height `y`. */
function onFace(g: THREE.Group, w: number, d: number, f: Face, n: number, inset: number, y: number, make: (p: Place) => THREE.Object3D): void {
  const alongZ = f === '+x' || f === '-x';
  const len = alongZ ? d : w;
  const off = ((alongZ ? w : d) / 2 + 0.012) * (f[0] === '+' ? 1 : -1);
  const ry = f === '+z' ? 0 : f === '-z' ? Math.PI : f === '+x' ? Math.PI / 2 : -Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const a = -len / 2 + inset + ((len - 2 * inset) * (i + 0.5)) / n;
    g.add(make(alongZ ? { x: off, y, z: a, ry } : { x: a, y, z: off, ry }));
  }
}

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

// Landmark 81 (461 m): baked Rodin shape (scripts/rodin/assets.ts): nine bundled square tubes stepping up to the central
// one, its crown and needle spire, on a stepped podium. The bake's colour split smeared frames into the glass, so one
// glass material covers it, and its shader paints the floor lines (`floorLinesGlass`): glazing by day, lit floors at
// night. Rodin made it stockier than the real tower, so the footprint is narrowed (`xzScale`) to the old procedural
// tower's: tubes ~1.5 wide, podium ~2.3 at ground. The base plate and the lowest podium tier (the bake's bottom 0.04)
// are sunk below ground. An aviation light tops the spire; the flags stand in front of the podium.
const L81_H = 12.4;
const L81_SINK = 0.04;
// The crown and needle spire (the bake's top fifth, above the central tube's last setback) are a pale metal frame by day
// and lit red at night, as the real tower's LED crown is.
const L81_GLASS = floorLinesGlass(0x86a6c4, { height: L81_H, first: 0.055, step: 0.068, count: 12, width: 0.01 }, {
  roughness: 0.2, metalness: 0.5, crown: { from: 0.79, color: 0xc9d3db, glow: 0xe8101e, peak: 1.1 },
});
// LED strips on the tube corners, grey by day, red at night like the crown, from about half height up to the crown. Each
// is a convex vertical corner edge of the bake (found where two faces meet sharply): plan position, height range as
// fractions of the bake before the footprint is narrowed, and the outward direction the strip stands proud along.
const L81_LED = floodMat(0x8f9aa3, 0xe8101e, 1.2);
const L81_STRIPS: [number, number, number, number, number, number][] = [
  [0.0248, -0.0277, 0.676, 0.79, 1, -1], // central tube, all four corners
  [-0.0266, 0.0176, 0.687, 0.79, -1, 1],
  [0.0248, 0.0202, 0.68, 0.79, 1, 1],
  [-0.0266, -0.0277, 0.68, 0.79, -1, -1],
  [0.0234, 0.0202, 0.476, 0.558, 1, 1], // outer tubes
  [0.0556, 0.0213, 0.523, 0.671, 0.3, 1],
  [-0.0555, 0.0169, 0.477, 0.622, -0.3, 1],
  [-0.0239, -0.0614, 0.511, 0.671, -1, -0.8],
  [-0.0556, -0.0288, 0.453, 0.576, -0.4, -1],
];
function landmark81(p: Place): THREE.Group {
  const g = group(p);
  g.add(shape(LANDMARK_81, L81_GLASS, { y: -L81_SINK * L81_H, height: L81_H, xzScale: 0.7 }));
  const xz = L81_H * 0.7;
  for (const [x, z, t0, t1, nx, nz] of L81_STRIPS) {
    const out = 0.012 / Math.hypot(nx, nz);
    g.add(box(0.03, (t1 - t0) * L81_H, 0.03, L81_LED, { x: x * xz + nx * out, y: (t0 - L81_SINK) * L81_H, z: z * xz + nz * out }));
  }
  g.add(sphere(0.03, BEACON, { y: (1 - L81_SINK) * L81_H, segments: 6 }));
  for (const x of [-0.95, -0.7, 0.7, 0.95]) g.add(vietnamFlag({ x, z: 1.4, h: 0.75, s: 0.5 }));
  return g;
}

// Bitexco Financial Tower (262 m, 68 floors; Carlos Zapata, 2010), a lotus bud, built from its photographs. The glass
// shaft swells a little at a third of its height and then tapers; above the swell its south side, toward the helipad,
// recedes faster than the north, so the bud leans back and ends in a crown cut on a slant that rises away from the
// helipad. A glass drum leans out of the shaft's south side as the shaft narrows, drawing the curved petal seam across
// the facade, and carries the helipad on a dark cantilever dish at the 52nd floor (191 m); the bud tip rises behind it
// with a silver fin along its edge. Dark mechanical bands ring the shaft at 42% and under the helipad. Shaft, drum and
// crown roof are one smooth skin of `BITEXCO_GLASS`, whose shader paints the floor lines (glazing by day, lit floors at
// night) under a faint blue LED wash (a stronger glow swamps the shading). Local +z is the helipad side; turning it -π/4
// aims it at the river, as on the real tower. It rises from Icon 68, the five-storey podium: two tiers of curved white
// walls with ribbon windows and roof gardens, entered from the forecourt's opening.
const BITEXCO_H = 8.2; // crown peak
const BITEXCO_HELI = 5.97; // helipad deck: 191 of 262 m
// Colours from daylight photographs: blue-green glass with dark fin shadows for floor lines, silver-grey frames, a dark
// grey-green cantilever dish, mechanical bands and petal seam.
const BITEXCO_GLASS = floorLinesGlass(0x5296a3, { height: BITEXCO_H, first: 0.116, step: 0.068, count: 13, width: 0.008 }, { roughness: 0.25, line: 0x2f6871, glow: 0x3d6fd6, peak: 0.16 });
const BITEXCO_FRAME = mat(0xa9b4b8, { roughness: 0.35, metalness: 0.5 });
const BITEXCO_DARK = mat(0x2f3d42, { roughness: 0.35, metalness: 0.4 });
const BITEXCO_WALL = floodMat(0xe9edf0, 0xfff1d8, 0.35);
const MARK_YELLOW = mat(0xe0b43a);

/** Smooth curve through `[t, value]` keys in increasing t (monotone cubic, so it never overshoots a key), clamped at the ends. */
function keyed(keys: [number, number][]): (t: number) => number {
  const n = keys.length;
  const h = keys.slice(1).map(([t], i) => t - keys[i][0]);
  const d = keys.slice(1).map(([, v], i) => (v - keys[i][1]) / h[i]);
  const m = keys.map((_, i) => {
    if (i === 0) return d[0];
    if (i === n - 1) return d[n - 2];
    if (d[i - 1] * d[i] <= 0) return 0;
    const w1 = 2 * h[i] + h[i - 1];
    const w2 = h[i] + 2 * h[i - 1];
    return (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  });
  return (t) => {
    if (t <= keys[0][0]) return keys[0][1];
    if (t >= keys[n - 1][0]) return keys[n - 1][1];
    let k = 0;
    while (t > keys[k + 1][0]) k++;
    const s = (t - keys[k][0]) / h[k];
    const s2 = s * s;
    const s3 = s2 * s;
    return (2 * s3 - 3 * s2 + 1) * keys[k][1] + (s3 - 2 * s2 + s) * h[k] * m[k] + (3 * s2 - 2 * s3) * keys[k + 1][1] + (s3 - s2) * h[k] * m[k + 1];
  };
}

/** Mesh that casts and receives shadows, like every kit solid. */
function solid(geo: THREE.BufferGeometry, m: Mat): THREE.Mesh {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  o.receiveShadow = true;
  return o;
}

/**
 * Smooth skin through closed rings of equal length, each list running from the first ring to the last. Normals average
 * along a list and round the seam; separate lists share no vertices, so their meeting edges stay crisp. Rings run with
 * angle 0 at +z and π/2 at +x; a list rising faces out, a list running inward at one height faces up.
 */
function skin(...lists: V3[][][]): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  for (const rings of lists) {
    const n = rings[0].length;
    const base = pos.length / 3;
    for (const r of rings) for (const p of r) pos.push(...p);
    for (let j = 0; j < rings.length - 1; j++) {
      for (let i = 0; i < n; i++) {
        const a = base + j * n + i;
        const b = base + j * n + ((i + 1) % n);
        idx.push(a, b, a + n, b, b + n, a + n);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** Flat cap over a planar ring (triangle fan from its centroid), facing up for rings ordered as in `skin`. */
function fan(ring: V3[]): THREE.BufferGeometry {
  const c = [0, 1, 2].map((k) => ring.reduce((s, p) => s + p[k], 0) / ring.length);
  const pos = [...c, ...ring.flat()];
  const idx: number[] = [];
  for (let i = 0; i < ring.length; i++) idx.push(0, 1 + i, 1 + ((i + 1) % ring.length));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** `n` points round a circle at height `y`, ordered as `skin` expects. */
function circle(cx: number, y: number, cz: number, r: number, n: number): V3[] {
  return Array.from({ length: n }, (_, i): V3 => [cx + r * Math.sin((i / n) * Math.PI * 2), y, cz + r * Math.cos((i / n) * Math.PI * 2)]);
}

/** Superellipse plan, half-sizes `a` (x) by `b` (z): exponent 2 is an ellipse, higher is squarer. Ordered as `skin` expects. */
function superellipse(a: number, b: number, e: number, n = 48): XZ[] {
  return Array.from({ length: n }, (_, i): XZ => {
    const s = Math.sin((i / n) * Math.PI * 2);
    const c = Math.cos((i / n) * Math.PI * 2);
    return [a * Math.sign(s) * Math.abs(s) ** (2 / e), b * Math.sign(c) * Math.abs(c) ** (2 / e)];
  });
}

const lift = (outline: XZ[], y: number): V3[] => outline.map(([x, z]): V3 => [x, y, z]);

// Shaft plan at height fraction t: an ellipse from its south end (+z, the helipad side) to its north end, and its
// half-width across (x). Read off photographs from the river, the long axis running through the helipad, then widened
// by a quarter as the poster draws it, so the bud still reads at the tile's scale.
const BIT_S = keyed([[0, 0.93], [0.3, 0.97], [0.52, 0.76], [0.73, 0.6], [0.85, 0.36], [1, -0.12]]);
const BIT_N = keyed([[0, -0.93], [0.3, -0.97], [0.52, -0.86], [0.73, -0.76], [0.85, -0.73], [1, -0.68]]);
const BIT_W = keyed([[0, 0.72], [0.3, 0.75], [0.52, 0.7], [0.73, 0.56], [0.85, 0.46], [1, 0.28]]);
/** Crown cut: a plane rising 40° away from the helipad to the peak at the shaft's north end. */
const bitexcoCut = (z: number) => BITEXCO_H - (z - BIT_N(1)) * Math.tan(0.7);
// Glass drum under the helipad, leaning out toward it: axis, radius and height at its foot (inside the shaft) and its head
// (under the dish).
const DRUM: [XZ, XZ] = [[0.12, 0.3], [0.12, 0.38]];
const DRUM_R: [number, number] = [0.41, 0.44];
const DRUM_Y: [number, number] = [3.6, 5.72];
const HELI_AT: XZ = [0.12, 0.7];
const HELI_R = 0.6;

/** Point on the shaft's glass at plan angle `a` (0 south, π/2 +x) and height `y`, pushed `out` beyond it. */
function bitexcoAt(a: number, y: number, out = 0): V3 {
  const t = y / BITEXCO_H;
  const s = BIT_S(t);
  const n = BIT_N(t);
  return [(BIT_W(t) + out) * Math.sin(a), y, (s + n) / 2 + ((s - n) / 2 + out) * Math.cos(a)];
}

/** Height at which plan angle `a` meets the crown cut. */
function bitexcoTop(a: number): number {
  let y = BITEXCO_H;
  for (let k = 0; k < 6; k++) y = bitexcoCut(bitexcoAt(a, y)[2]);
  return y;
}

/** How far out of the shaft the point (x, y, z) lies: below 1 inside, above 1 outside. */
function shaftLevel([x, y, z]: V3): number {
  const t = y / BITEXCO_H;
  const s = BIT_S(t);
  const n = BIT_N(t);
  return (x / BIT_W(t)) ** 2 + ((2 * z - s - n) / (s - n)) ** 2;
}

/** Point on the drum's glass at angle `a` round its axis (0 south, π/2 +x) and height `y`, pushed `out` beyond it. */
function drumAt(a: number, y: number, out = 0): V3 {
  const f = (y - DRUM_Y[0]) / (DRUM_Y[1] - DRUM_Y[0]);
  const r = DRUM_R[0] + (DRUM_R[1] - DRUM_R[0]) * f + out;
  return [DRUM[0][0] + (DRUM[1][0] - DRUM[0][0]) * f + r * Math.sin(a), y, DRUM[0][1] + (DRUM[1][1] - DRUM[0][1]) * f + r * Math.cos(a)];
}

/**
 * The petal seam, where the drum leaves the shaft: a U from the drum's head on one side down to the point where the
 * drum first breaks through the glass, and up again on the other. Points stand just proud of the drum.
 */
function drumSeam(): THREE.Vector3[] {
  /** The drum's angle that stands furthest out of the shaft at height `y`, and how far. */
  const peak = (y: number): [number, number] => {
    let best: [number, number] = [0, 0];
    for (let d = -90; d <= 90; d++) {
      const v = shaftLevel(drumAt((d * Math.PI) / 180, y));
      if (v > best[1]) best = [(d * Math.PI) / 180, v];
    }
    return best;
  };
  let lo = DRUM_Y[0];
  let hi = DRUM_Y[1];
  for (let k = 0; k < 30; k++) {
    const y = (lo + hi) / 2;
    if (peak(y)[1] < 1) lo = y;
    else hi = y;
  }
  const side = (sign: number) => Array.from({ length: 17 }, (_, k) => {
    const y = hi + (DRUM_Y[1] - hi) * (k / 16) ** 2;
    let a0 = peak(y)[0]; // outside the shaft
    let a1 = a0 + sign * Math.PI; // inside
    for (let i = 0; i < 30; i++) {
      const a = (a0 + a1) / 2;
      if (shaftLevel(drumAt(a, y)) < 1) a1 = a;
      else a0 = a;
    }
    return new THREE.Vector3(...drumAt(a0, y, 0.01));
  });
  return [...side(-1).reverse(), ...side(1).slice(1)];
}

function bitexco(p: Place): THREE.Group {
  const g = group({ ...p, ry: -Math.PI / 4 });
  const NA = 64;
  const NY = 30;
  const angle = (i: number) => (i / NA) * Math.PI * 2;
  // Shaft rows run from the ground to the crown cut, so the top row lies in the cut's plane.
  const tops = Array.from({ length: NA }, (_, i) => bitexcoTop(angle(i)));
  const shaft = Array.from({ length: NY + 1 }, (_, j) => tops.map((top, i) => bitexcoAt(angle(i), (top * j) / NY)));
  const drumRing = (y: number, n: number, out = 0) => Array.from({ length: n }, (_, i) => drumAt((i / n) * Math.PI * 2, y, out));
  const drum = DRUM_Y.map((y) => drumRing(y, 40));
  // Crown: a glass roof in the cut's plane, inside a silver lip that overhangs the walls a little.
  const rim = shaft[NY];
  const mid = [0, 1, 2].map((k) => rim.reduce((s, q) => s + q[k], 0) / NA);
  const scaled = (s: number) => rim.map((q): V3 => [mid[0] + (q[0] - mid[0]) * s, mid[1] + (q[1] - mid[1]) * s, mid[2] + (q[2] - mid[2]) * s]);
  const inner = scaled(0.84);
  const outer = scaled(1.04);
  const drop = (ring: V3[]) => ring.map(([x, y, z]): V3 => [x, y - 0.035, z]);
  g.add(solid(mergeGeometries([skin(shaft, drum), fan(inner)]), BITEXCO_GLASS));
  g.add(solid(skin([drop(outer), outer], [outer, inner], [drop(rim), drop(outer)]), BITEXCO_FRAME));
  g.add(tube(drumSeam(), 0.018, BITEXCO_DARK, { segments: 48 }));
  g.add(sphere(0.03, BEACON, { y: BITEXCO_H - 0.02, z: BIT_N(1), segments: 6 }));
  // Dark mechanical bands round the shaft: one at 42%, one under the helipad, which the drum's collar continues.
  const band = (y0: number, y1: number) => [y0, y1].map((y) => Array.from({ length: NA }, (_, i) => bitexcoAt(angle(i), y, 0.008)));
  g.add(solid(skin(band(3.36, 3.52), band(DRUM_Y[1] - 0.12, DRUM_Y[1])), BITEXCO_DARK));
  // Helipad: the drum's dark collar and the cantilever dish from its head to the deck, which carries a silver parapet with
  // the landing lights along it, and the touchdown circle and H on the part clear of the bud tip.
  const [hx, hz] = HELI_AT;
  const deckY = BITEXCO_HELI - 0.05;
  g.add(solid(skin(
    [DRUM_Y[1] - 0.12, DRUM_Y[1]].map((y) => drumRing(y, 40, 0.006)),
    [drumRing(DRUM_Y[1], 48), circle(hx, deckY, hz, HELI_R, 48)],
  ), BITEXCO_DARK));
  g.add(cylinder(HELI_R, HELI_R, 0.05, ASPHALT, { x: hx, y: deckY, z: hz, segments: 48 }));
  const parapet = [HELI_R + 0.02, HELI_R].map((r) => [BITEXCO_HELI - 0.01, BITEXCO_HELI + 0.03].map((y) => circle(hx, y, hz, r, 48)));
  g.add(solid(skin(parapet[0], [parapet[0][1], parapet[1][1]], [parapet[1][1], parapet[1][0]]), BITEXCO_FRAME));
  g.add(solid(skin([circle(hx, BITEXCO_HELI + 0.031, hz, HELI_R + 0.016, 48), circle(hx, BITEXCO_HELI + 0.031, hz, HELI_R + 0.004, 48)]), lampMaterial));
  const mz = hz + 0.43 * HELI_R;
  g.add(solid(skin([circle(hx, BITEXCO_HELI + 0.003, mz, 0.5 * HELI_R, 40), circle(hx, BITEXCO_HELI + 0.003, mz, 0.43 * HELI_R, 40)]), MARK_YELLOW));
  for (const x of [-0.11, 0.11]) g.add(box(0.03, 0.006, 0.3 * HELI_R, CURB, { x: hx + x * HELI_R, y: BITEXCO_HELI, z: mz }));
  g.add(box(0.22 * HELI_R, 0.006, 0.03, CURB, { x: hx, y: BITEXCO_HELI, z: mz }));
  // Silver fin up the bud tip's leading edge, from the deck to the crown.
  const finTop = bitexcoTop(0);
  const fin = Array.from({ length: 11 }, (_, k) => new THREE.Vector3(...bitexcoAt(0, BITEXCO_HELI + ((finTop - BITEXCO_HELI) * k) / 10, 0.012)));
  g.add(tube(fin, 0.016, BITEXCO_FRAME, { segments: 20 }));
  // Icon 68, the five-storey retail podium: two tiers of curved white walls banded with ribbon windows under a white roof
  // edge, roof gardens on both, entered from the forecourt's opening through glass doors under a white canopy.
  const tiers: [number, number, number, number, [number, number][]][] = [
    [1.32, 1.45, 0, 0.5, [[0.05, 0.2], [0.28, 0.42]]],
    [1.0, 1.12, 0.5, 0.82, [[0.08, 0.22]]],
  ];
  for (const [a, b, y0, y1, ribbons] of tiers) {
    const plan = superellipse(a, b, 3);
    g.add(solid(skin([lift(plan, y0), lift(plan, y1)]), BITEXCO_WALL));
    const glazed = superellipse(a + 0.012, b + 0.012, 3);
    for (const [r0, r1] of ribbons) g.add(solid(skin([lift(glazed, y0 + r0), lift(glazed, y0 + r1)]), windowMaterial));
    g.add(prism(superellipse(a + 0.025, b + 0.025, 3), 0.03, BITEXCO_WALL, { y: y1 }));
  }
  const garden = prism(superellipse(1.24, 1.37, 3), 0.02, LAWN, { y: 0.53, holes: [superellipse(1.01, 1.13, 3)] });
  garden.castShadow = false;
  g.add(garden);
  g.add(area(superellipse(0.95, 1.07, 3), LAWN, { y: 0.85, h: 0.015 }));
  const ea = -0.72; // the entrance's bearing, between the people at the forecourt's opening
  for (const [x, z] of superellipse(1.13, 1.26, 3, 14)) if (Math.abs(Math.atan2(x, z) - ea) > 0.5) g.add(sphere(0.07, HEDGE, { x, y: 0.54, z, segments: 5 }));
  const er = (Math.abs(Math.sin(ea) / 1.32) ** 3 + Math.abs(Math.cos(ea) / 1.45) ** 3) ** (-1 / 3); // wall radius there
  g.add(box(0.36, 0.42, 0.03, windowMaterial, { x: Math.sin(ea) * er, z: Math.cos(ea) * er, ry: ea }));
  g.add(box(0.5, 0.025, 0.22, BITEXCO_WALL, { x: Math.sin(ea) * (er + 0.11), y: 0.44, z: Math.cos(ea) * (er + 0.11), ry: ea }));
  return g;
}

// Ba Son bridge (2022), an asymmetric cable-stayed crossing. One arch-shaped pylon stands in the river by the far (Thu
// Thiem) bank and leans back away from the main span; stay cables fan from its upper half to both deck edges, and
// backstays run to the back span at the edge. The deck lands on the city bank and ramps down behind the Independence
// Palace. Pylon, cables and parapet strips are lit at night like the real bridge's "harp of light".
function baSonBridge(): THREE.Group {
  const g = group({ z: DECK_Z });
  const t = 0.14;
  g.add(profile([[-9.92, DECK_Y - t], [SPAN_X, DECK_Y - t], [RAMP_X, 0], [RAMP_X, 0.05], [SPAN_X, DECK_Y], [-9.92, DECK_Y]], DECK_W, ASPHALT));
  const edge: XZ[] = [[-9.92, DECK_Y - t - 0.03], [SPAN_X, DECK_Y - t - 0.03], [RAMP_X, 0], [RAMP_X, 0.08], [SPAN_X, DECK_Y + 0.07], [-9.92, DECK_Y + 0.07]];
  for (const s of [-1, 1]) {
    const z = s * (DECK_W / 2 + 0.0175);
    g.add(profile(edge, 0.035, M.white, { z }));
    g.add(box(SPAN_X + 9.92, 0.015, 0.02, lampMaterial, { x: (SPAN_X - 9.92) / 2, y: DECK_Y + 0.07, z }));
    g.add(beam([SPAN_X, DECK_Y + 0.077, z], [RAMP_X, 0.087, z], 0.015, lampMaterial));
  }
  for (let x = -9.5; x < SPAN_X - 0.2; x += 0.6) for (const z of [-0.15, 0.15]) g.add(box(0.3, 0.012, 0.025, M.roadLine, { x, y: DECK_Y, z }));
  // Piers under the ramp and the abutment on the city bank.
  const under = (x: number) => ((DECK_Y - t) * (RAMP_X - x)) / (RAMP_X - SPAN_X);
  for (const x of [-5.3, -4.3]) g.add(box(0.14, under(x), 0.6, M.white, { x }));
  g.add(box(0.36, DECK_Y - t, 1.0, M.white, { x: SPAN_X + 0.16 }));
  // The pylon: two legs straddle the deck, curve inward and meet at the top, leaning back over the far bank.
  const legs = [-1, 1].map((s) => {
    const pts = [
      new THREE.Vector3(PYLON_X, -0.05, s * 0.66),
      new THREE.Vector3(PYLON_X - 0.1, 1.2, s * 0.63),
      new THREE.Vector3(PYLON_X - 0.3, 2.4, s * 0.5),
      new THREE.Vector3(PYLON_X - 0.55, 3.4, s * 0.26),
      new THREE.Vector3(PYLON_X - 0.7, 4.0, 0),
    ];
    g.add(tube(pts, 0.08, PYLON, { segments: 20 }));
    return { s, curve: new THREE.CatmullRomCurve3(pts) };
  });
  g.add(sphere(0.1, PYLON, { x: PYLON_X - 0.7, y: 3.9, segments: 8 }));
  g.add(sphere(0.035, BEACON, { x: PYLON_X - 0.7, y: 4.08, segments: 6 }));
  g.add(box(0.2, 0.16, 1.36, PYLON, { x: PYLON_X - 0.07, y: DECK_Y - t - 0.18 }));
  g.add(box(0.36, 0.12, 1.7, M.white, { x: PYLON_X, y: -0.05 }));
  for (const { s, curve } of legs) {
    const deckZ = s * (DECK_W / 2 - 0.05);
    for (let i = 0; i < 7; i++) {
      const a = curve.getPoint(0.5 + (0.45 * i) / 6);
      g.add(beam([a.x, a.y, a.z], [PYLON_X + 0.5 + i * 0.32, DECK_Y + 0.03, deckZ], 0.014, CABLE));
    }
    for (const [u, x] of [[0.7, -9.2], [0.82, -9.48], [0.94, -9.76]] as const) {
      const a = curve.getPoint(u);
      g.add(beam([a.x, a.y, a.z], [x, DECK_Y + 0.03, deckZ], 0.014, CABLE));
    }
  }
  return g;
}

// Saigon Opera House (1900): a cream hall with two storeys of arched windows under a grey mansard roof. The entrance front
// (+x) projects as a tall bay, one great arch between paired columns under a pediment with a statue at each corner.
function operaHouse(p: Place): THREE.Group {
  const g = group(p);
  const W = 2.6;
  const D = 2.5;
  const H = 1.05;
  g.add(box(W, H, D, OPERA_WALL));
  g.add(box(W + 0.06, 0.2, D + 0.06, CREAM));
  g.add(box(W + 0.04, 0.04, D + 0.04, CREAM, { y: 0.52 }));
  g.add(box(W + 0.12, 0.08, D + 0.12, CREAM, { y: H - 0.08 }));
  g.add(mansardRoof(W + 0.02, D + 0.02, 0.44, SLATE, { y: H, inset: 0.32 }));
  const win = (q: Place) => archWin(0.15, 0.2, windowMaterial, q);
  for (const f of ['+z', '-z', '-x'] as const) for (const y of [0.25, 0.62]) onFace(g, W, D, f, 6, 0.15, y, win);
  for (const sz of [-1, 1]) for (const y of [0.25, 0.62]) for (const z of [0.78, 1.05]) g.add(win({ x: W / 2 + 0.012, y, z: sz * z, ry: Math.PI / 2 }));
  const bw = 1.1;
  const bh = 1.38;
  // Arch feet lifted so the opening does not share the bay's bottom edge.
  const arch = archHole(0, 0.56, 0.68, 8).map(([x, y]): XZ => [x, Math.max(y, 0.04)]);
  g.add(profile([[-bw / 2, 0], [bw / 2, 0], [bw / 2, bh], [0, bh + 0.3], [-bw / 2, bh]], 0.26, OPERA_WALL, { x: W / 2 + 0.11, ry: Math.PI / 2, holes: [arch] }));
  g.add(box(0.03, 0.95, 0.56, windowMaterial, { x: W / 2 + 0.01 }));
  for (const sz of [-1, 1]) for (const z of [0.36, 0.48]) g.add(cylinder(0.04, 0.045, 1.32, CREAM, { x: W / 2 + 0.28, z: sz * z, segments: 8 }));
  g.add(box(0.38, 0.08, bw + 0.1, CREAM, { x: W / 2 + 0.14, y: bh - 0.04 }));
  for (const sz of [-1, 1]) {
    g.add(cylinder(0.035, 0.045, 0.14, STATUE, { x: W / 2 + 0.2, y: bh + 0.04, z: sz * 0.48, segments: 6 }));
    g.add(sphere(0.03, STATUE, { x: W / 2 + 0.2, y: bh + 0.18, z: sz * 0.48, segments: 6 }));
  }
  g.add(box(0.34, 0.05, 1.3, CREAM, { x: W / 2 + 0.38 }));
  return g;
}

// Notre-Dame Cathedral Basilica of Saigon (1880), red brick. The front (+z) is two square bell towers with arched belfries
// under grey spires and crosses, and between them a gable with a rose window over three portals; behind it a nave with
// lower aisles, a transept with rose windows and a round apse, all under orange tile. Floodlit at night.
function cathedral(p: Place): THREE.Group {
  const g = group(p);
  const L = 3.7;
  const nz = -0.55 - L / 2;
  const tz = -2.6;
  g.add(box(1.0, 1.2, L, BRICK, { z: nz }));
  g.add(gableRoof(L, 1.12, 0.5, TILE_ORANGE, { y: 1.2, z: nz, ry: Math.PI / 2 }));
  for (const sx of [-1, 1]) {
    g.add(box(0.38, 0.72, L - 0.5, BRICK, { x: sx * 0.68, z: nz - 0.25 }));
    g.add(profile([[sx * 0.48, 0], [sx * 0.9, 0], [sx * 0.48, 0.28]], L - 0.5, TILE_ORANGE, { y: 0.72, z: nz - 0.25 }));
    for (let i = 0; i < 6; i++) {
      const z = -1.3 - i * 0.52;
      if (Math.abs(z - tz) > 0.45) g.add(archWin(0.09, 0.24, windowMaterial, { x: sx * 0.882, y: 0.18, z, ry: (sx * Math.PI) / 2 }));
    }
    for (let i = 0; i < 5; i++) g.add(box(0.06, 0.62, 0.08, BRICK, { x: sx * 0.9, z: -1.56 - i * 0.52 }));
  }
  g.add(box(2.5, 1.2, 0.72, BRICK, { z: tz }));
  g.add(gableRoof(2.6, 0.82, 0.45, TILE_ORANGE, { y: 1.2, z: tz }));
  for (const sx of [-1, 1]) {
    g.add(disc(0.19, CREAM, { x: sx * 1.25, y: 0.75, z: tz, ry: (sx * Math.PI) / 2 }));
    g.add(disc(0.15, windowMaterial, { x: sx * 1.27, y: 0.75, z: tz, ry: (sx * Math.PI) / 2 }));
  }
  const az = -0.55 - L;
  g.add(cylinder(0.5, 0.5, 1.12, BRICK, { z: az, segments: 10 }));
  g.add(cone(0.56, 0.42, TILE_ORANGE, { y: 1.12, z: az, segments: 10 }));
  // The front between the towers: gable, rose window, three portals.
  g.add(box(0.86, 1.45, 0.3, BRICK, { z: -0.4 }));
  g.add(profile([[-0.43, 0], [0.43, 0], [0, 0.36]], 0.3, BRICK, { y: 1.45, z: -0.4 }));
  g.add(disc(0.2, CREAM, { y: 1.08, z: -0.25 }));
  g.add(disc(0.16, windowMaterial, { y: 1.08, z: -0.23 }));
  for (const [x, w] of [[-0.25, 0.12], [0, 0.2], [0.25, 0.12]] as const) g.add(archWin(w, w * 1.5, M.dark, { x, y: 0.04, z: -0.238 }));
  for (const sx of [-1, 1]) {
    const tw = group({ x: sx * 0.72, z: -0.3 });
    tw.add(box(0.6, 2.55, 0.6, BRICK));
    for (const y of [0.9, 1.62, 2.48]) tw.add(box(0.66, 0.06, 0.66, CREAM, { y }));
    for (const [bx, bz] of CORNERS) tw.add(box(0.08, 2.45, 0.08, BRICK, { x: bx * 0.3, z: bz * 0.3 }));
    for (const f of ['+x', '-x', '+z', '-z'] as const) onFace(tw, 0.6, 0.6, f, 2, 0.1, 1.75, (q) => archWin(0.11, 0.3, M.dark, q));
    onFace(tw, 0.6, 0.6, '+z', 1, 0.2, 0.04, (q) => archWin(0.16, 0.3, M.dark, q));
    onFace(tw, 0.6, 0.6, '+z', 1, 0.2, 1.05, (q) => archWin(0.12, 0.28, windowMaterial, q));
    tw.add(box(0.5, 0.12, 0.5, SPIRE, { y: 2.54 }));
    tw.add(cylinder(0, 0.3, 1.45, SPIRE, { y: 2.66, segments: 8 }));
    for (const [bx, bz] of CORNERS) tw.add(cone(0.05, 0.24, SPIRE, { x: bx * 0.24, y: 2.66, z: bz * 0.24, segments: 4 }));
    tw.add(box(0.02, 0.22, 0.02, M.gold, { y: 4.1 }));
    tw.add(box(0.1, 0.02, 0.02, M.gold, { y: 4.24 }));
    g.add(tw);
  }
  // Our Lady of Peace on her pedestal in the forecourt.
  g.add(box(0.12, 0.2, 0.12, GRANITE, { z: 0.32 }));
  g.add(cylinder(0.025, 0.04, 0.13, STATUE, { y: 0.2, z: 0.32, segments: 6 }));
  g.add(sphere(0.022, STATUE, { y: 0.33, z: 0.32, segments: 6 }));
  return g;
}

// Independence Palace (1966): a long white modernist block facing the park (+x). Pilotis and glazing beneath, the "stone
// bamboo" screen of slim vertical fins on every front, projecting floor slabs and a deep roof canopy; a rooftop pavilion
// with the flag, and the helicopter kept on the roof.
function palace(p: Place): THREE.Group {
  const g = group(p);
  const W = 1.7;
  const L = 4.8;
  g.add(box(W - 0.3, 0.36, L - 0.5, windowMaterial));
  for (const sx of [-1, 1]) for (let z = -L / 2 + 0.25; z < L / 2 - 0.2; z += 0.43) g.add(box(0.07, 0.36, 0.07, PALACE_WHITE, { x: sx * (W / 2 - 0.1), z }));
  g.add(box(W + 0.14, 0.05, L + 0.14, PALACE_WHITE, { y: 0.36 }));
  g.add(box(W, 0.6, L, PALACE_WHITE, { y: 0.41 }));
  g.add(box(W + 0.1, 0.04, L + 0.1, PALACE_WHITE, { y: 0.7 }));
  g.add(box(W + 0.34, 0.07, L + 0.34, PALACE_WHITE, { y: 1.01 }));
  for (const sx of [-1, 1]) {
    g.add(box(0.02, 0.52, L - 0.16, windowMaterial, { x: sx * (W / 2 + 0.005), y: 0.45 }));
    for (let z = -L / 2 + 0.12; z < L / 2 - 0.1; z += 0.16) g.add(box(0.035, 0.58, 0.05, PALACE_WHITE, { x: sx * (W / 2 + 0.06), y: 0.42, z }));
  }
  for (const sz of [-1, 1]) {
    g.add(box(W - 0.16, 0.52, 0.02, windowMaterial, { y: 0.45, z: sz * (L / 2 + 0.005) }));
    for (let x = -W / 2 + 0.12; x < W / 2 - 0.1; x += 0.16) g.add(box(0.05, 0.58, 0.035, PALACE_WHITE, { x, y: 0.42, z: sz * (L / 2 + 0.06) }));
  }
  // Entrance canopy and steps on the park front.
  g.add(box(0.5, 0.05, 1.2, PALACE_WHITE, { x: W / 2 + 0.25, y: 0.36 }));
  g.add(box(0.36, 0.06, 1.0, PALACE_WHITE, { x: W / 2 + 0.2 }));
  // Roof: pavilion and flag, and the helicopter.
  g.add(box(0.62, 0.26, 1.5, PALACE_WHITE, { y: 1.08 }));
  g.add(box(0.78, 0.04, 1.66, PALACE_WHITE, { y: 1.34 }));
  g.add(vietnamFlag({ y: 1.38, h: 0.95, s: 1.0 }));
  const heli = group({ x: 0.15, y: 1.08, z: -1.7, ry: 0.6 });
  heli.add(box(0.1, 0.08, 0.22, HELI, { y: 0.03 }));
  heli.add(beam([0, 0.08, -0.1], [0, 0.1, -0.36], 0.025, HELI));
  heli.add(box(0.03, 0.05, 0.03, HELI, { y: 0.11, z: -0.36 }));
  for (const r of [0.4, 0.4 + Math.PI / 2]) heli.add(box(0.48, 0.006, 0.025, M.dark, { y: 0.115, ry: r }));
  for (const sx of [-1, 1]) heli.add(box(0.008, 0.01, 0.26, M.dark, { x: sx * 0.06 }));
  g.add(heli);
  return g;
}

// Saigon Central Post Office (1891): a long yellow front (+z) with two storeys of arched windows between white courses, a
// taller central pavilion whose arched gable carries the clock, and orange tile roofs. Floodlit at night.
function postOffice(p: Place): THREE.Group {
  const g = group(p);
  const D = 1.8;
  const H = 1.05;
  const win = (q: Place) => archWin(0.14, 0.2, SHUTTER, q);
  for (const sx of [-1, 1]) {
    const wing = group({ x: sx * 1.55 });
    wing.add(box(1.8, H, D, POST_YELLOW));
    wing.add(box(1.84, 0.16, D + 0.04, CREAM));
    wing.add(box(1.84, 0.04, D + 0.04, CREAM, { y: 0.52 }));
    wing.add(box(1.9, 0.07, D + 0.1, CREAM, { y: H - 0.07 }));
    wing.add(hipRoof(1.98, D + 0.14, 0.42, TILE_ORANGE, { y: H }));
    for (const f of ['+z', '-z'] as const) for (const y of [0.2, 0.6]) onFace(wing, 1.8, D, f, 4, 0.12, y, win);
    for (const y of [0.2, 0.6]) onFace(wing, 1.8, D, sx > 0 ? '+x' : '-x', 3, 0.2, y, win);
    g.add(wing);
  }
  const front = D / 2 + 0.1;
  g.add(box(1.3, 1.32, D + 0.2, POST_YELLOW));
  g.add(box(1.34, 0.16, D + 0.24, CREAM));
  g.add(box(1.4, 0.08, D + 0.3, CREAM, { y: 1.24 }));
  const gable = Array.from({ length: 9 }, (_, i): XZ => [Math.cos((1 - i / 8) * Math.PI) * 0.55, Math.sin((1 - i / 8) * Math.PI) * 0.32]);
  g.add(profile(gable, 0.1, POST_YELLOW, { y: 1.3, z: front - 0.05 }));
  g.add(clock(0.12, { y: 1.45, z: front }));
  g.add(hipRoof(1.46, D + 0.32, 0.5, TILE_ORANGE, { y: 1.32 }));
  g.add(archWin(0.3, 0.42, windowMaterial, { y: 0.04, z: front + 0.012 }));
  for (const x of [-0.42, 0.42]) for (const y of [0.2, 0.7]) g.add(archWin(0.14, 0.24, SHUTTER, { x, y, z: front + 0.012 }));
  g.add(box(0.6, 0.04, 0.24, CREAM, { y: 0.62, z: front + 0.1 }));
  return g;
}

// Ben Thanh Market (1914): cream arcaded halls under red tile hip roofs, the central hall raised on clerestories, square
// pavilions at the corners, and the south gate (+z) under the clock tower: clock faces on three sides, the red name band, a
// small hip roof and the flag. Stall awnings run along the outside walls.
function benThanh(p: Place): THREE.Group {
  const g = group(p);
  const W = 4.3;
  const D = 3.85;
  g.add(box(W, 0.62, D, MARKET_WALL));
  g.add(box(W + 0.04, 0.05, D + 0.04, CREAM, { y: 0.6 }));
  const arcade = (q: Place) => archWin(0.2, 0.2, windowMaterial, q);
  onFace(g, W, D, '+x', 7, 0.45, 0.04, arcade);
  onFace(g, W, D, '-x', 7, 0.45, 0.04, arcade);
  onFace(g, W, D, '-z', 8, 0.45, 0.04, arcade);
  for (const x of [-1.55, -1.15, -0.75, 0.75, 1.15, 1.55]) g.add(arcade({ x, y: 0.04, z: D / 2 + 0.012 }));
  g.add(hipRoof(W + 0.2, D + 0.2, 0.5, TILE_RED, { y: 0.65 }));
  g.add(box(1.9, 0.5, D - 0.6, MARKET_WALL, { y: 0.65 }));
  for (const sx of [-1, 1]) g.add(box(0.02, 0.16, D - 0.9, windowMaterial, { x: sx * 0.96, y: 0.88 }));
  g.add(hipRoof(2.1, D - 0.4, 0.55, TILE_RED, { y: 1.15 }));
  for (const [sx, sz] of CORNERS) {
    const x = sx * (W / 2 - 0.2);
    const z = sz * (D / 2 - 0.2);
    g.add(box(0.5, 0.86, 0.5, MARKET_WALL, { x, z }));
    g.add(hipRoof(0.62, 0.62, 0.28, TILE_RED, { x, y: 0.86, z }));
  }
  // Awnings of the stalls let into the outside walls.
  const awning = (i: number, q: Place) => g.add(box(0.4, 0.025, 0.2, mat(AWNINGS[i % AWNINGS.length]), q));
  for (let i = 0; i < 6; i++) {
    const z = -D / 2 + 0.7 + i * 0.49;
    awning(i, { x: W / 2 + 0.1, y: 0.4, z, ry: Math.PI / 2 });
    awning(i + 2, { x: -W / 2 - 0.1, y: 0.4, z, ry: Math.PI / 2 });
  }
  for (const [i, x] of [-1.35, -0.85, 0.85, 1.35].entries()) awning(i + 1, { x, y: 0.4, z: D / 2 + 0.1 });
  // South gate and clock tower.
  const t = group({ z: D / 2 + 0.05 });
  t.add(box(0.9, 1.2, 0.5, MARKET_WALL));
  t.add(archWin(0.38, 0.5, M.dark, { z: 0.262 }));
  t.add(box(0.62, 0.12, 0.03, M.red, { y: 0.98, z: 0.26 }));
  t.add(box(0.94, 0.06, 0.54, CREAM, { y: 1.2 }));
  t.add(box(0.56, 0.78, 0.44, MARKET_WALL, { y: 1.26 }));
  for (const [x, z, ry] of [[0, 0.22, 0], [0.28, 0, Math.PI / 2], [-0.28, 0, -Math.PI / 2]] as const) t.add(clock(0.13, { x, y: 1.68, z, ry }));
  t.add(box(0.62, 0.06, 0.5, CREAM, { y: 2.04 }));
  t.add(hipRoof(0.7, 0.6, 0.34, TILE_RED, { y: 2.1 }));
  t.add(vietnamFlag({ y: 2.36, h: 0.7, s: 0.55 }));
  g.add(t);
  return g;
}

// Saigon shophouse: a lit shopfront under an awning (front row only), shuttered windows with iron balconies, a terracotta
// roof with the gable to the street or hipped.
function shophouse(x: number, z: number, w: number, d: number, h: number, wall: Mat, awning: number | undefined, hip: boolean): THREE.Group {
  const g = group({ x, z });
  g.add(building({ w, d, h, wall, windows: 'grid', roof: 'flat', floorH: 0.42, plain: true, shop: awning }));
  const startY = awning === undefined ? 0.3 : 0.62;
  const floors = Math.max(1, Math.floor((h - startY) / 0.42));
  for (let f = 0; f < floors; f++) {
    const y = startY + f * 0.42;
    for (const sx of [-1, 1]) g.add(box(0.05, 0.2, 0.02, SHUTTER, { x: sx * w * 0.36, y: y + 0.08, z: d / 2 + 0.02 }));
    if (f % 2 === 0) {
      g.add(box(w * 0.86, 0.03, 0.14, IRON, { y: y - 0.01, z: d / 2 + 0.07 }));
      g.add(box(w * 0.86, 0.08, 0.012, IRON, { y: y + 0.02, z: d / 2 + 0.14 }));
    }
  }
  if (hip) g.add(hipRoof(w + 0.08, d + 0.08, 0.34, TILE_RED, { y: h }));
  else g.add(gableRoof(d + 0.08, w + 0.08, 0.32, TILE_ORANGE, { y: h, ry: Math.PI / 2 }));
  return g;
}

// Night-market stall: a counter of goods under a peaked awning on four posts, facing local +z.
function stall(x: number, z: number, i: number, ry: number): THREE.Group {
  const g = group({ x, z, ry });
  g.add(box(0.42, 0.15, 0.3, M.wood));
  g.add(box(0.38, 0.04, 0.26, mat(AWNINGS[(i + 2) % AWNINGS.length]), { y: 0.15 }));
  for (const [sx, sz] of CORNERS) g.add(box(0.018, 0.34, 0.018, M.dark, { x: sx * 0.2, z: sz * 0.15 }));
  g.add(gableRoof(0.5, 0.42, 0.1, mat(AWNINGS[i % AWNINGS.length]), { y: 0.34 }));
  return g;
}

// Street vendor: conical hat, carrying pole with two baskets.
function vendor(x: number, z: number, ry: number): THREE.Group {
  const g = group({ x, z, ry });
  g.add(person({ color: 0x8a6a4a, ry: 0 }));
  g.add(cone(0.07, 0.05, mat(0xefe0a8), { y: 0.215, segments: 8 }));
  g.add(box(0.3, 0.01, 0.01, M.wood, { y: 0.16 }));
  for (const sx of [-1, 1]) g.add(cylinder(0.04, 0.03, 0.04, mat(0xc99a4a), { x: sx * 0.15, y: 0.07, segments: 6 }));
  return g;
}

/** Round planted bed with a hedge ring: the base of the plaza monument. */
function hedgedBed(g: THREE.Group, r: number): void {
  g.add(cylinder(r + 0.04, r + 0.06, 0.06, CURB, { segments: 16 }));
  g.add(cylinder(r, r, 0.08, LAWN, { segments: 16 }));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(sphere(0.06, HEDGE, { x: Math.cos(a) * (r - 0.08), y: 0.05, z: Math.sin(a) * (r - 0.08), segments: 5 }));
  }
}

// Statue on a stepped granite pedestal (the palm plaza).
function monument(p: Place): THREE.Group {
  const g = group(p);
  hedgedBed(g, 0.46);
  g.add(box(0.3, 0.1, 0.3, GRANITE, { y: 0.08 }));
  g.add(box(0.2, 0.4, 0.2, GRANITE, { y: 0.18 }));
  g.add(cylinder(0.05, 0.07, 0.2, STATUE, { y: 0.58, segments: 6 }));
  g.add(sphere(0.035, STATUE, { y: 0.78, segments: 6 }));
  return g;
}

// Tran Nguyen Han on horseback, in bronze on a tall stepped granite pedestal over a round step: the monument the 2025
// renovation returns to its old spot in the square in front of Ben Thanh. The horse faces local +z.
function equestrianStatue(p: Place): THREE.Group {
  const g = group(p);
  g.add(cylinder(0.42, 0.44, 0.05, GRANITE, { segments: 16 }));
  g.add(box(0.5, 0.08, 0.56, GRANITE, { y: 0.05 }));
  g.add(box(0.38, 0.08, 0.46, GRANITE, { y: 0.13 }));
  g.add(box(0.26, 0.48, 0.36, GRANITE, { y: 0.21 }));
  g.add(box(0.3, 0.04, 0.4, GRANITE, { y: 0.69 }));
  const top = 0.73;
  for (const [x, z] of [[-0.025, 0.08], [0.025, 0.08], [-0.025, -0.08], [0.025, -0.08]] as const) g.add(box(0.022, 0.1, 0.022, BRONZE, { x, y: top, z }));
  g.add(box(0.075, 0.08, 0.22, BRONZE, { y: top + 0.1 }));
  g.add(beam([0, top + 0.15, 0.09], [0, top + 0.25, 0.15], 0.05, BRONZE));
  g.add(beam([0, top + 0.26, 0.13], [0, top + 0.22, 0.21], 0.04, BRONZE));
  g.add(beam([0, top + 0.16, -0.11], [0, top + 0.07, -0.15], 0.02, BRONZE));
  g.add(cylinder(0.025, 0.032, 0.1, BRONZE, { y: top + 0.17, segments: 6 }));
  g.add(sphere(0.022, BRONZE, { y: top + 0.27, segments: 6 }));
  g.add(beam([0.03, top + 0.25, 0.01], [0.05, top + 0.34, 0.07], 0.012, BRONZE));
  return g;
}

// Quach Thi Trang (1964), the student the square is named after: a white bust on a granite pedestal.
function quachThiTrang(p: Place): THREE.Group {
  const g = group(p);
  g.add(box(0.16, 0.28, 0.16, GRANITE));
  g.add(cylinder(0.045, 0.06, 0.07, STATUE, { y: 0.28, segments: 6 }));
  g.add(sphere(0.035, STATUE, { y: 0.35, segments: 6 }));
  return g;
}

// Traffic light on a street corner: a pole with two heads, red facing the avenue (+x) and green facing the cross street (+z).
function signal(p: Place): THREE.Group {
  const g = group(p);
  g.add(cylinder(0.014, 0.018, 0.5, M.dark, { segments: 5 }));
  for (const [ry, lens, y] of [[Math.PI / 2, SIGNAL_RED, 0.095], [0, SIGNAL_GREEN, 0.025]] as const) {
    const head = group({ y: 0.38, ry });
    head.add(box(0.045, 0.12, 0.035, M.dark));
    head.add(disc(0.014, lens, { y, z: 0.018 }));
    g.add(head);
  }
  return g;
}

// Fountain in the oval park: basin, pedestal bowl and spray, the basin rim lit at night.
function fountain(p: Place): THREE.Group {
  const g = group(p);
  g.add(cylinder(0.44, 0.46, 0.1, CURB, { segments: 16 }));
  g.add(cylinder(0.39, 0.39, 0.105, POOL, { segments: 16 }));
  g.add(cylinder(0.395, 0.395, 0.02, lampMaterial, { y: 0.09, segments: 16, open: true }));
  g.add(cylinder(0.08, 0.1, 0.22, CURB, { y: 0.1, segments: 8 }));
  g.add(cylinder(0.2, 0.06, 0.06, CURB, { y: 0.3, segments: 10 }));
  g.add(cylinder(0.02, 0.17, 0.26, SPRAY, { y: 0.34, segments: 10 }));
  g.add(cylinder(0.035, 0.045, 0.16, CURB, { y: 0.36, segments: 6 }));
  return g;
}

// ---------------------------------------------------------------------------
// River craft and traffic (everything faces +z, the direction Animator.follow moves)
// ---------------------------------------------------------------------------

// Hull: a side profile along z with a raked bow, `l` long and `w` wide, `h` freeboard.
function hull(l: number, w: number, h: number, m: Mat): THREE.Mesh {
  return profile([[-l / 2, 0], [l / 2 - 0.16, 0], [l / 2, h], [-l / 2, h]], w, m, { ry: -Math.PI / 2 });
}

function cargoShip(): THREE.Group {
  const g = group();
  const l = 1.25;
  g.add(hull(l, 0.3, 0.13, M.red));
  g.add(box(0.31, 0.03, l - 0.18, M.dark, { z: -0.08 }));
  g.add(box(0.28, 0.02, l - 0.12, M.white, { y: 0.13 }));
  for (const [i, z] of [-0.1, 0.06, 0.22, 0.38].entries()) {
    g.add(box(0.26, 0.1, 0.14, mat(AWNINGS[i % 2 === 0 ? 4 : 2]), { y: 0.15, z }));
    if (i < 3) g.add(box(0.26, 0.09, 0.14, mat(AWNINGS[i % 2 === 0 ? 2 : 4]), { y: 0.25, z }));
  }
  g.add(box(0.24, 0.24, 0.2, M.white, { y: 0.15, z: -l / 2 + 0.16 }));
  g.add(box(0.25, 0.05, 0.21, windowMaterial, { y: 0.33, z: -l / 2 + 0.16 }));
  g.add(box(0.06, 0.12, 0.06, M.red, { y: 0.39, z: -l / 2 + 0.12 }));
  mergeStatic(g);
  return g;
}

// Saigon Waterbus: white hull with a blue band, glazed cabin, blue roof.
function waterBus(): THREE.Group {
  const g = group();
  const l = 0.8;
  const blue = mat(0x2f6fb6, { roughness: 0.5 });
  g.add(hull(l, 0.24, 0.08, M.white));
  g.add(box(0.245, 0.025, l - 0.2, blue, { y: 0.045, z: -0.05 }));
  g.add(box(0.2, 0.1, l * 0.6, windowMaterial, { y: 0.08, z: -0.05 }));
  g.add(box(0.22, 0.025, l * 0.66, blue, { y: 0.18, z: -0.05 }));
  mergeStatic(g);
  return g;
}

// Wooden river boat with an orange canopy on posts.
function sampan(): THREE.Group {
  const g = group();
  g.add(hull(0.5, 0.14, 0.06, M.wood));
  for (const [sx, sz] of CORNERS) g.add(box(0.012, 0.1, 0.012, M.dark, { x: sx * 0.05, y: 0.06, z: sz * 0.09 - 0.03 }));
  g.add(box(0.15, 0.015, 0.26, TILE_ORANGE, { y: 0.16, z: -0.03 }));
  return g;
}

// Dinner cruise boat moored at the promenade: two glazed decks under red roofs, a string of lights.
function cruiseBoat(): THREE.Group {
  const g = group();
  const l = 1.0;
  const roof = mat(0xb8352c, { roughness: 0.6 });
  g.add(hull(l, 0.3, 0.09, M.white));
  g.add(box(0.26, 0.11, l * 0.8, windowMaterial, { y: 0.09, z: -0.04 }));
  g.add(box(0.29, 0.02, l * 0.84, roof, { y: 0.2, z: -0.04 }));
  g.add(box(0.22, 0.09, l * 0.5, windowMaterial, { y: 0.22, z: -0.08 }));
  g.add(box(0.25, 0.02, l * 0.54, roof, { y: 0.31, z: -0.08 }));
  for (let i = 0; i < 7; i++) g.add(sphere(0.013, lampMaterial, { y: 0.33, z: -0.4 + i * 0.13, segments: 4 }));
  mergeStatic(g);
  return g;
}

/** One rider on the Rodin scooter (+z forward) with a headlight; scooter body and shirt painted per bike. */
function rider(g: THREE.Group, x: number, z: number, body: Mat, shirt: Mat, helmet: Mat): void {
  g.add(shape(MOTORBIKE, [M.dark, shirt, body, helmet], { x, z, height: 0.34 }));
  g.add(box(0.035, 0.03, 0.02, lampMaterial, { x, y: 0.12, z: z + 0.17 }));
}

/**
 * Saigon traffic moving as one: a car or taxi with scooters ahead and behind, or a swarm of scooters alone. Pre-merged,
 * so a pack costs one draw call per material (5 for a swarm, 7 with a car).
 */
function pack(rand: () => number, kind: PackKind, n: number): THREE.Group {
  const g = group();
  const ia = Math.floor(rand() * BIKE_PAINTS.length);
  const ib = (ia + 1 + Math.floor(rand() * (BIKE_PAINTS.length - 1))) % BIKE_PAINTS.length;
  const a = mat(BIKE_PAINTS[ia]);
  const b = mat(BIKE_PAINTS[ib]);
  const helmet = mat(HELMETS[Math.floor(rand() * HELMETS.length)]);
  const slots: XZ[] =
    kind === 'bikes'
      ? [[-0.1, 0.4], [0.1, 0.2], [-0.1, 0.0], [0.1, -0.2], [-0.1, -0.4], [0.1, -0.6]]
      : [[-0.08, 0.47], [0.08, -0.47], [0.1, 0.72], [-0.1, -0.72], [-0.06, 0.97]];
  if (kind !== 'bikes') g.add(car({ taxi: kind === 'taxi', color: CAR_PAINTS[Math.floor(rand() * CAR_PAINTS.length)] }));
  slots.slice(0, n).forEach(([x, z], i) => rider(g, x, z, i % 2 ? a : b, i % 2 ? b : a, helmet));
  mergeStatic(g);
  return g;
}

/** Keep a mover on the Ba Son deck and ramp: height and pitch follow the deck while it is on the bridge. */
function onDeck(anim: Animator, outer: THREE.Object3D, inner: THREE.Object3D): void {
  const slope = Math.atan2(DECK_Y - 0.05, RAMP_X - SPAN_X);
  anim.add(() => {
    const x = outer.position.x;
    const bridge = x < RAMP_X && Math.abs(outer.position.z - DECK_Z) < DECK_W / 2;
    const ramp = bridge && x > SPAN_X;
    outer.position.y = !bridge ? 0.05 : ramp ? DECK_Y + ((x - SPAN_X) / (RAMP_X - SPAN_X)) * (0.05 - DECK_Y) : DECK_Y;
    inner.rotation.x = ramp ? (Math.sin(outer.rotation.y) > 0 ? slope : -slope) : 0;
  });
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

export default function build(): CityScene {
  const rand = rng(1975);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: M.pavement, side: mat(0x94603b) }));

  // Saigon River inside a stone curb along the plinth's top edge, with the embankment along the city bank.
  root.add(area([...riverShore(), ...riverRim(0).slice(1, -1)], RIVER, { h: 0.04 }));
  for (const line of [riverShore(), riverRim(0.05)]) {
    for (let i = 1; i < line.length; i++) root.add(beam([line[i - 1][0], 0.05, line[i - 1][1]], [line[i][0], 0.05, line[i][1]], 0.1, EMBANK));
  }

  // Green ground: the riverside park, the park round the Opera House, the front-left corner, the back right, Landmark 81.
  root.add(area(shoreBand(-3.25, 2.15, -4.85), LAWN, { h: 0.03 }));
  root.add(area(shoreBand(-9.92, -4.45, -1.5), LAWN, { h: 0.03 }));
  root.add(area(shoreBand(7.2, 9.92, -5.35), LAWN, { h: 0.03 }));
  root.add(area(roundRect(3.2, -9.9, 9.9, -4.15, 0.55), LAWN, { h: 0.03 }));
  root.add(area(roundRect(-4.55, 3.05, -1.95, 7.55, 0.2), LAWN, { h: 0.03 }));

  // Streets, the park ring and the signalised crossroads at Ben Thanh's corner.
  for (const [x1, z1, x2, z2, w] of ROADS) root.add(road(x1, z1, x2, z2, w, { lines: w > 1.5, material: ASPHALT }));
  root.add(area(roundRect(-2.4, -4.4, 3.15, 3.05, 0.7), ASPHALT, { h: 0.05 }));
  for (const z of [-4.75, 3.35, AVE_Z - AVE_W / 2 - 0.35, AVE_Z + AVE_W / 2 + 0.35]) root.add(crosswalk(V1_X, z, 1.1));
  for (const x of [3.7, 8.4]) root.add(crosswalk(x, -2.25, 0.9, { ry: Math.PI / 2 }));
  root.add(crosswalk(3.7, 1.05, 0.9, { ry: Math.PI / 2 }));
  for (const z of [0.0, AVE_Z - AVE_W / 2 - 0.35]) root.add(crosswalk(9.2, z, 0.9));
  for (const x of [-3.6, 0.3, V1_X - 0.85, V1_X + 0.85, 5.9]) root.add(crosswalk(x, AVE_Z, AVE_W, { ry: Math.PI / 2 }));
  root.add(crosswalk(-1.5, 3.35, 0.9));
  root.add(crosswalk(-4.95, 3.35, 0.8));
  // Paved plazas: the palm plaza, the apron round Ben Thanh running out into its square, the Landmark 81 forecourt.
  root.add(patch(3.15, 1.75, PLAZA, { x: 0.425, z: 3.975, h: 0.045 }));
  root.add(patch(5.1, 5.85, PLAZA, { x: 5.9, z: 4.675, h: 0.045 }));
  root.add(patch(2.3, 1.15, PLAZA, { x: -3.2, z: 6.975, h: 0.045 }));

  // Oval park (30/4 Park) with its fountain and flag, in the middle of the traffic ring.
  root.add(area(ellipse(PARK[0], PARK[1], 1.68, 2.58), CURB, { h: 0.065 }));
  root.add(area(ellipse(PARK[0], PARK[1], 1.6, 2.5), LAWN, { h: 0.075 }));
  root.add(fountain({ x: PARK[0], y: 0.075, z: PARK[1] }));
  root.add(vietnamFlag({ x: -0.75, y: 0.075, z: -2.0, h: 1.5, s: 0.9 }));

  // Independence Palace facing the park across its lawn and curved drive.
  root.add(patch(0.65, 4.9, CURB, { x: -2.68, z: -0.5, h: 0.05 }));
  root.add(patch(0.57, 4.82, LAWN, { x: -2.68, z: -0.5, h: 0.06 }));
  const drive: XZ[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = -1.3 + (i / 8) * 2.6;
    drive.push([-3.0 + Math.cos(a) * 0.55, -0.5 + Math.sin(a) * 0.55]);
  }
  for (let i = 8; i >= 0; i--) {
    const a = -1.3 + (i / 8) * 2.6;
    drive.push([-3.0 + Math.cos(a) * 0.38, -0.5 + Math.sin(a) * 0.38]);
  }
  root.add(area(drive, PLAZA, { h: 0.07 }));
  root.add(palace({ x: -3.85, z: -0.5 }));

  root.add(baSonBridge());
  root.add(landmark81({ x: -3.2, z: 5.22 }));
  root.add(operaHouse({ x: -5.6, z: -8.15 }));
  root.add(cathedral({ x: 0.25, z: -4.85 }));
  // Bitexco on its own round forecourt, which opens onto the street past the cathedral (-x); clipped shrubs ring the rest.
  const [bitX, bitZ] = BITEXCO_AT;
  root.add(bitexco({ x: bitX, z: bitZ }));
  root.add(area(ellipse(bitX, bitZ, BITEXCO_PLAZA_R + 0.07, BITEXCO_PLAZA_R + 0.07, 40), CURB, { h: 0.045 }));
  root.add(area(ellipse(bitX, bitZ, BITEXCO_PLAZA_R, BITEXCO_PLAZA_R, 40), PLAZA, { h: 0.055 }));
  for (let i = 0; i < 12; i++) {
    const a = ((i + 0.5) / 12) * Math.PI * 2;
    if (Math.cos(a) < -0.7) continue;
    root.add(sphere(0.08, HEDGE, { x: bitX + Math.cos(a) * (BITEXCO_PLAZA_R - 0.14), y: 0.055, z: bitZ + Math.sin(a) * (BITEXCO_PLAZA_R - 0.14), segments: 5 }));
  }
  for (const [dx, dz] of [[-1.75, -0.25], [-1.7, 0.5], [-1.25, 1.15]] as const) root.add(person({ x: bitX + dx, y: 0.055, z: bitZ + dz }));
  root.add(postOffice({ x: 5.9, z: -0.68 }));
  root.add(benThanh({ x: 5.9, z: 4.05 }));
  root.add(monument({ x: 0.4, y: 0.045, z: 3.95 }));
  // Ben Thanh square, as the 2025 renovation lays it out: lawns either side of the central walk with small shade trees that
  // leave the market in view, Tran Nguyen Han back on his old spot facing the south gate, the Quach Thi Trang bust among the
  // trees on the east lawn.
  for (const x of [4.475, 7.325]) {
    root.add(patch(1.53, 0.83, CURB, { x, z: 7.05, h: 0.05 }));
    root.add(patch(1.45, 0.75, LAWN, { x, z: 7.05, h: 0.06 }));
    for (const dx of [-0.58, -0.28, 0.28, 0.58]) root.add(sphere(0.035, mat(AWNINGS[dx < 0 ? 0 : 3]), { x: x + dx, y: 0.06, z: 7.36, segments: 4 }));
  }
  root.add(equestrianStatue({ x: 5.9, y: 0.045, z: 7.05, ry: Math.PI }));
  root.add(quachThiTrang({ x: 7.4, y: 0.06, z: 7.1 }));
  for (const [x, z] of [[3.95, 6.85], [4.95, 6.85], [4.45, 7.25], [6.85, 6.85], [7.95, 6.85], [7.95, 7.28]] as const) root.add(tree({ x, y: 0.06, z, s: 0.55 }));
  // Signalised crossroads at the market's corner: a light on each corner.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) root.add(signal({ x: V1_X + sx * 0.65, z: AVE_Z + sz * (AVE_W / 2 + 0.1) }));

  // Two apartment blocks along the right edge, clear of Bitexco's forecourt.
  const aptWall = mat(0xdcc6b8);
  const aptTrim = mat(0xf0e6dc);
  for (const [x, z, w, d, h] of [[8.85, -8.8, 1.2, 1.3, 3.0], [8.95, -6.75, 1.3, 1.2, 3.2]] as const) {
    root.add(building({ x, z, w, d, h, wall: aptWall, trim: aptTrim, windows: 'grid', roof: 'flat', floorH: 0.4 }));
  }

  // Shophouses: one row of shops along the street.
  for (let x = 3.3, i = 0; x < 9.6; i++) {
    const w = Math.min(0.6 + rand() * 0.28, 9.8 - x);
    root.add(shophouse(x + w / 2, -3.45, w - 0.03, 1.2, 1.15 + rand() * 0.45, SHOP_WALLS[i % SHOP_WALLS.length], AWNINGS[i % AWNINGS.length], rand() < 0.35));
    x += w;
  }
  // A taller row once stood behind it and boxed Bitexco in. Its numbers are still drawn, so the trees, crowds and traffic
  // that draw from `rand` after it keep their layout.
  for (let x = 3.6; x < 7.8;) {
    x += Math.min(0.65 + rand() * 0.3, 7.9 - x);
    rand(); // height
    rand(); // roof
  }

  // Night-market stalls in two facing rows, a string of lanterns over the aisle between them.
  for (let i = 0; i < 6; i++) root.add(stall(-0.7 + i * 0.5, 5.35, i, 0));
  for (let i = 0; i < 5; i++) root.add(stall(-0.55 + i * 0.55, 6.5, i + 3, Math.PI));
  for (const x of [-0.95, 1.75]) root.add(cylinder(0.012, 0.012, 0.5, M.dark, { x, z: 5.93, segments: 4 }));
  for (let i = 0; i < 9; i++) root.add(sphere(0.022, lampMaterial, { x: -0.95 + i * 0.3375, y: 0.44, z: 5.93, segments: 5 }));

  // River craft: moored dinner cruise and sampans, the cargo ship and the waterbus underway.
  root.add(anim.bob(group({ x: -6.62, y: 0.03, z: 6.3 }, cruiseBoat()), 0.008, 1.1));
  for (const [x, z, ry] of [[-7.2, 4.6, 0.3], [-7.35, 0.6, -0.4], [-7.0, 8.45, 2.8]] as const) root.add(group({ x, y: 0.03, z, ry }, sampan()));
  root.add(anim.follow(group({ y: 0.03 }, cargoShip()), [[-8.3, 8.85], [-8.3, -8.85]], 0.2, 0.3));
  root.add(anim.follow(group({ y: 0.03 }, waterBus()), [[-9.35, -9.1], [-9.35, 9.1]], 0.45, 0));

  // Palms along the street past the cathedral, the avenue sidewalk, the promenade, the plaza and the Landmark 81 forecourt.
  const palms: XZ[] = [];
  for (const z of [-9.2, -8.0, -6.8, -5.6]) palms.push([1.8, z]);
  for (const z of [-9.2, -8.0, -6.8]) palms.push([3.4, z]);
  // Fronds reach ~0.5 from the trunk, so the avenue row stands 0.55 inside the front edge.
  for (const x of [-4.5, -3.5, -2.5, -1.5, -0.5, 0.5, 1.5, 3.75, 8.35]) palms.push([x, 9.45]);
  for (const z of [3.0, 4.2, 5.4, 6.6]) palms.push([shoreAt(z) + 0.32, z]);
  for (const [x, z] of [[-0.85, 3.3], [-0.85, 4.6], [1.65, 3.3], [1.65, 4.6], [-0.2, 3.25], [1.05, 4.65], [-4.4, 6.75], [-2.05, 6.75]] as const) palms.push([x, z]);
  for (const [x, z] of palms) root.add(tree({ x, z, kind: 'palm', s: 0.85 + rand() * 0.25 }));
  // V1 median with clipped shrubs.
  root.add(patch(0.14, 4.6, LAWN, { x: V1_X, z: -7.2, h: 0.07 }));
  for (let z = -9.3; z < -5.0; z += 0.55) root.add(sphere(0.07, HEDGE, { x: V1_X, y: 0.07, z, segments: 5 }));

  // Shade trees fill the open ground on a jittered grid, clear of the river, streets and footprints.
  const blocked: [number, number, number, number][] = [
    [-4.9, -3.1, -2.3, 2.1], // palace and its lawn
    [-4.55, 3.0, -1.9, 7.65], // Landmark 81 block, planted below
    [-7.1, -9.6, -3.8, -6.6], // Opera House and its steps
    [-1.5, -9.8, 2.0, -4.4], // cathedral
    [-2.45, -4.45, 3.2, 3.1], // park ring
    [-7.1, -4.5, -2.3, -3.2], // under the bridge ramp
    [-1.2, 3.0, 2.05, 7.65], // palm plaza and stalls
    [3.1, -5.85, 9.95, 9.95], // shophouses, post office, Ben Thanh and its square, the avenue's east end
    [8.1, -9.55, 9.6, -8.05], // apartments
    [8.2, -7.45, 9.7, -6.05],
    [-5.6, 9.1, 3.2, 9.95], // avenue sidewalk palms
    [1.55, -9.95, 3.65, -4.4], // V1 sidewalks
  ];
  for (let gx = -9.4; gx <= 9.4; gx += 0.95) {
    for (let gz = -9.4; gz <= 9.4; gz += 0.95) {
      const x = Math.max(-9.4, Math.min(9.4, gx + (rand() - 0.5) * 0.45));
      const z = Math.max(-9.4, Math.min(9.4, gz + (rand() - 0.5) * 0.45));
      const s = 0.85 + rand() * 0.35;
      if (x < shoreAt(z) + 0.4 || onRoad(x, z, 0.3) || Math.hypot(x - bitX, z - bitZ) < BITEXCO_PLAZA_R + 0.35) continue;
      if (blocked.some(([ax, az, bx, bz]) => x > ax && x < bx && z > az && z < bz)) continue;
      root.add(tree({ x, z, s }));
    }
  }
  for (let z = -2.8; z < 2.0; z += 0.85) root.add(tree({ x: -6.05 + (rand() - 0.5) * 0.15, z, s: 0.9 + rand() * 0.25 }));
  for (const [x, z] of [[-4.25, 3.4], [-3.2, 3.35], [-2.2, 3.4], [-5.75, 7.75], [-6.0, 8.55], [-5.7, 9.35]] as const) root.add(tree({ x, z, s: 1.0 }));

  // Lamps along the avenue, the promenade, the street past the cathedral and round Ben Thanh.
  for (const x of [-4.0, -2.0, 0.0, 2.0, 4.3, 7.5]) root.add(lamp({ x, z: 9.25, ry: Math.PI / 2 }));
  for (const z of [3.6, 5.8]) root.add(lamp({ x: shoreAt(z) + 0.5, z, ry: 0 }));
  for (const z of [-8.6, -6.2]) root.add(lamp({ x: 1.85, z, ry: 0 }));
  for (const [x, z] of [[3.5, 6.3], [8.3, 6.3], [3.5, 1.9], [8.3, 1.9]] as const) root.add(lamp({ x, z, ry: x < 5 ? Math.PI : 0 }));

  // People: shoppers, vendors with carrying poles, strollers by the river and in the park.
  const crowd = (x: number, z: number, w: number, d: number, n: number, y = 0.045, avoid?: (x: number, z: number) => boolean) =>
    root.add(scatter({ x, z, w, d }, n, rand, (px, pz) => person({ x: px, y, z: pz }), avoid));
  crowd(0.4, 3.95, 3.0, 1.6, 5, 0.045, (x, z) => Math.hypot(x - 0.4, z - 3.95) < 0.6);
  crowd(0.45, 5.93, 2.6, 0.2, 4, 0);
  crowd(5.9, 6.55, 4.6, 0.12, 4);
  crowd(3.55, 4.0, 0.2, 3.6, 2);
  crowd(8.25, 4.0, 0.2, 3.6, 2);
  crowd(5.9, 0.45, 4.6, 0.12, 4, 0);
  crowd(6.4, -2.78, 5.4, 0.1, 3, 0);
  crowd(-5.75, 4.4, 0.25, 3.6, 4, 0);
  crowd(PARK[0], PARK[1] + 1.4, 1.6, 1.0, 3, 0.075, (x, z) => Math.hypot(x - PARK[0], z - PARK[1]) < 0.55);
  crowd(0.25, -4.6, 1.6, 0.25, 3, 0);
  crowd(-3.2, 6.7, 2.0, 0.35, 3);
  for (const [x, z, ry] of [[4.6, 6.35, 0.4], [7.3, 6.3, -0.3], [1.4, 4.2, 1.2]] as const) root.add(vendor(x, z, ry));

  // Traffic keeps right. Each pack is one mover; paths end a pack's length inside the plinth edge.
  const ride = (path: XZ[], kind: PackKind, n: number, speed: number, offset: number, closed = false) =>
    root.add(anim.follow(group({ y: 0.05 }, pack(rand, kind, n)), path, speed, offset, closed));
  const deckRide = (path: XZ[], kind: PackKind, n: number, speed: number, offset: number) => {
    const inner = group({}, pack(rand, kind, n));
    const outer = group({ y: 0.05 }, inner);
    root.add(anim.follow(outer, path, speed, offset));
    onDeck(anim, outer, inner);
  };
  const ring = Array.from({ length: 28 }, (_, i): XZ => [PARK[0] + Math.cos((i / 28) * Math.PI * 2) * 1.95, PARK[1] - Math.sin((i / 28) * Math.PI * 2) * 2.9]);
  // Avenue lanes: westbound 7.8 at the curb (the market loop) and 8.15, eastbound 8.8.
  const market: XZ[] = [[2.75, 1.29], [8.96, 1.29], [8.96, 7.8], [2.75, 7.8]];
  const aveWest: XZ[] = [[9.0, 8.15], [-4.71, 8.15], [-4.71, 2.84], [2.75, 2.84], [2.75, -9.0]];
  const aveEast: XZ[] = [[2.45, -9.0], [2.45, 8.8], [9.0, 8.8]];
  ride(ring, 'bikes', 6, 0.9, 0, true);
  ride(ring, 'taxi', 3, 0.9, 0.5, true);
  ride(market, 'bikes', 4, 1.0, 0, true);
  ride(market, 'car', 3, 1.0, 0.5, true);
  // A swarm circling the Landmark 81 block: down the riverside road, along the avenue, back up past the stalls.
  ride([[-5.19, 2.36], [-5.19, 8.8], [-1.26, 8.8], [-1.26, 2.36]], 'bikes', 6, 0.95, 0, true);
  ride(aveWest, 'taxi', 4, 1.1, 0.15);
  ride(aveEast, 'bikes', 6, 1.0, 0.45);
  ride([[9.0, -2.49], [3.0, -2.49], [3.0, -9.0]], 'bikes', 4, 1.05, 0.2);
  deckRide([[-9.0, -3.53], [3.0, -3.53], [3.0, -9.0]], 'taxi', 4, 1.0, 0.1);
  deckRide([[-9.0, -3.73], [2.45, -3.73], [2.45, -2.01], [9.0, -2.01]], 'car', 3, 1.0, 0.6);
  deckRide([[2.2, -9.0], [2.2, -4.17], [-9.0, -4.17]], 'bikes', 5, 1.0, 0.3);
  for (const [path, offset] of [[aveWest, 0.62], [aveEast, 0.05]] as const) {
    const b = bus({ color: 0x3f9a5b });
    mergeStatic(b);
    root.add(anim.follow(group({ y: 0.05 }, b), [...path], 0.9, offset));
  }

  return { root, update: anim.update };
}
