import * as THREE from 'three';
import {
  Animator, M, archHole, area, beam, box, building, bus, car, cone, createBase, crosswalk, cylinder, floodMat, gableRoof, group,
  hipRoof, lamp, lampMaterial, mansardRoof, mat, mergeStatic, patch, person, prism, profile, rng, road, scatter, shape, sphere, tree,
  tube, waterMat, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';
import MOTORBIKE from '../shapes/motorbike-lite.shape';

// Layout follows assets/ho-chi-minh.png: positions were read off the poster through a homography fitted to the plinth
// corners, and the roads, river and plazas traced on a rectified top-down copy of its ground plane. The Saigon River runs
// along the left (x = -10) edge; the Ba Son bridge crosses it at the back and ramps down behind the Independence Palace,
// which faces the oval park and its fountain. The Notre-Dame Cathedral and the Opera House stand behind the park, Bitexco
// and three apartment blocks at the back right. The shophouse rows, the Central Post Office and Ben Thanh Market fill the
// right; Landmark 81, the palm plaza and the night-market stalls the left front. The avenue along the front edge carries
// most of the traffic and widens into the Quach Thi Trang roundabout in front of Ben Thanh's south gate, with Tran
// Nguyen Han on horseback at its centre. The river stays inside a stone curb along the plinth's top edge.

type Mat = THREE.Material;
type XZ = [number, number];
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
const PYLON = floodMat(0xf4f4f0, 0xfff0d6, 0.55, { roughness: 0.5 });
// Ba Son's stay cables, the "harp of light": pale by day, glowing blue-white at night.
const CABLE = floodMat(0xf4f4f0, 0x8fd2ff, 1.8, { roughness: 0.4 });
// Aviation lights: a pale lens by day, red at night only.
const BEACON = floodMat(0xd9d4cc, 0xff2211, 2.5);
const SLATE = mat(0x5f5c66, { roughness: 0.7 });
const SPIRE = mat(0xd6dae0, { roughness: 0.5 });
const L81_GLASS = mat(0x86a6c4, { roughness: 0.2, metalness: 0.5 });
const L81_FRAME = mat(0xdfe7ee, { roughness: 0.4 });
// Bitexco's glass: pale steel blue by day, washed in blue LED light at night.
const BITEXCO_GLASS = floodMat(0x9db4c9, 0x6fa8ff, 0.55, { roughness: 0.25 });
const FIN = mat(0xd9e2ea, { roughness: 0.35, metalness: 0.2 });
const BELT = mat(0x56616e, { roughness: 0.3, metalness: 0.5 });
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
const AVE_Z = 8.1; // avenue along the front edge
const PARK: XZ = [0.15, -0.65]; // oval lawn centre
// Quach Thi Trang roundabout on the avenue, centred on Ben Thanh's south gate.
const RB: XZ = [5.9, 8.15];
const RB_R = 1.45; // outer edge of its ring road

// Streets [x1, z1, x2, z2, width]; trees and props keep clear of them.
const ROADS: [number, number, number, number, number][] = [
  [V1_X, -9.94, V1_X, 9.94, 1.1],
  [-5.35, AVE_Z, RB[0] - RB_R + 0.25, AVE_Z, 2.2], // the avenue, west and east of the roundabout
  [RB[0] + RB_R - 0.25, AVE_Z, 9.94, AVE_Z, 2.2],
  [-5.35, 2.6, -2.4, 2.6, 0.9], // between the palace and Landmark 81
  [-4.95, 2.15, -4.95, 7.0, 0.8], // riverside road
  [-1.5, 3.0, -1.5, 7.0, 0.9], // between Landmark 81 and the stalls
  [3.1, -2.25, 9.94, -2.25, 0.9], // in front of the shophouses
  [3.1, 1.05, 8.8, 1.05, 0.9], // between the post office and Ben Thanh
  [9.2, -2.7, 9.2, 7.0, 0.9], // along the right edge
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

function addMesh(g: THREE.Group, geo: THREE.BufferGeometry, m: Mat): void {
  const o = new THREE.Mesh(geo, m);
  o.castShadow = true;
  o.receiveShadow = true;
  g.add(o);
}

// Vietnamese flag: red field with a gold star on both faces, on a pole of height h.
function flag(p: Place & { h?: number; s?: number }): THREE.Group {
  const g = group(p);
  const h = p.h ?? 1.3;
  const s = p.s ?? 1;
  g.add(cylinder(0.015 * s, 0.022 * s, h, M.steel, { segments: 5 }));
  g.add(sphere(0.025 * s, M.gold, { y: h, segments: 5 }));
  g.add(box(0.5 * s, 0.33 * s, 0.015, M.red, { x: 0.25 * s, y: h - 0.36 * s }));
  for (const side of [1, -1]) {
    const star = cone(0.07 * s, 0.012, M.gold, { x: 0.25 * s, y: h - 0.195 * s, z: side * 0.008, segments: 5 });
    star.rotation.x = (side * Math.PI) / 2;
    g.add(star);
  }
  return g;
}

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

// Landmark 81 (461 m): nine square glass tubes bundled like bamboo. The corner tubes stop lower, so the tower steps up to
// the central one, which carries a slim two-stage crown, a spire and an aviation light. Pale frames run up every tube
// corner and glass floor bands glow at night. A podium with a glazed ground floor, an entrance canopy and flags.
function landmark81(p: Place): THREE.Group {
  const g = group(p);
  const ph = 0.34;
  g.add(box(2.3, ph, 2.3, L81_FRAME));
  g.add(box(2.33, 0.17, 2.33, windowMaterial, { y: 0.05 }));
  g.add(box(2.38, 0.05, 2.38, L81_FRAME, { y: ph - 0.05 }));
  g.add(box(0.9, 0.035, 0.42, L81_FRAME, { y: 0.24, z: 1.36 }));
  for (const x of [-0.4, 0.4]) g.add(cylinder(0.015, 0.015, 0.24, M.steel, { x, z: 1.52, segments: 4 }));
  const c = 0.5;
  // Tube heights by [x column][z row]; the lowest corner faces the default camera, so every setback shows.
  const heights = [
    [7.4, 9.0, 6.6],
    [9.4, 10.2, 8.4],
    [8.0, 8.8, 5.6],
  ];
  heights.forEach((col, i) =>
    col.forEach((h, k) => {
      const x = (i - 1) * c;
      const z = (k - 1) * c;
      g.add(box(c - 0.03, h, c - 0.03, L81_GLASS, { x, y: ph, z }));
      for (let y = ph + 0.3; y < ph + h - 0.2; y += 0.42) g.add(box(c - 0.01, 0.14, c - 0.01, windowMaterial, { x, y, z }));
      for (const [sx, sz] of CORNERS) g.add(box(0.03, h, 0.03, L81_FRAME, { x: x + sx * (c / 2 - 0.015), y: ph, z: z + sz * (c / 2 - 0.015) }));
      g.add(box(c + 0.01, 0.06, c + 0.01, L81_FRAME, { x, y: ph + h, z }));
    }),
  );
  const top = ph + heights[1][1] + 0.06;
  g.add(box(0.34, 0.6, 0.34, L81_GLASS, { y: top }));
  g.add(box(0.37, 0.05, 0.37, L81_FRAME, { y: top + 0.6 }));
  g.add(box(0.2, 0.42, 0.2, L81_GLASS, { y: top + 0.65 }));
  g.add(cylinder(0.018, 0.045, 0.75, M.steel, { y: top + 1.07, segments: 6 }));
  g.add(sphere(0.03, BEACON, { y: top + 1.8, segments: 6 }));
  for (const x of [-0.95, -0.7, 0.7, 0.95]) g.add(flag({ x, z: 1.4, h: 0.75, s: 0.5 }));
  return g;
}

// Bitexco Financial Tower (262 m), a lotus bud: elliptical glass floors that swell a little and then taper, a crown cut on a
// slant that rises away from the helipad, and the helipad cantilevered toward the river three quarters of the way up. A
// pale spine climbs the helipad side from the podium to the crown, a pale lip edges the slanted cut, and mullions and floor
// fins grid the glass; two dark glass belts circle it. It stands on a three-tier podium of rounded glazed terraces with a
// roof garden. The glass glows at night.
function bitexco(p: Place): THREE.Group {
  const g = group(p);
  const H = 6.5; // shaft height on the helipad side
  const CROWN = 0.9; // the crown's high side rises this much more
  const RX = 0.72;
  const RZ = 0.5;
  const NS = 20;
  const NY = 16;
  const hx = -Math.SQRT1_2; // helipad side: toward the river
  const hz = Math.SQRT1_2;
  // Podium terraces, bottom to top: half-width, half-depth, corner radius, height. Each steps in, like the real one.
  const TIERS: [number, number, number, number][] = [[1.1, 0.85, 0.42, 0.2], [0.98, 0.74, 0.36, 0.18], [0.86, 0.63, 0.3, 0.16]];
  let base = 0;
  for (const [w, d, r, h] of TIERS) {
    g.add(prism(roundRect(-w, -d, w, d, r), h, FIN, { y: base }));
    // Glazed band set into the terrace face, and a pale lip round its roof.
    g.add(prism(roundRect(-w - 0.012, -d - 0.012, w + 0.012, d + 0.012, r), h * 0.55, windowMaterial, { y: base + h * 0.2 }));
    g.add(prism(roundRect(-w - 0.03, -d - 0.03, w + 0.03, d + 0.03, r + 0.03), 0.03, M.white, { y: base + h - 0.03 }));
    base += h;
  }
  const taper = (y: number) => {
    const t = y / (H + CROWN);
    return 1 + 0.1 * Math.sin(Math.PI * Math.min(1, t * 1.7)) - 0.52 * t * t;
  };
  const topAt = (a: number) => H + (CROWN * (1 - (Math.cos(a) * hx + Math.sin(a) * hz))) / 2;
  /** Point on the glass at angle `a`, floor row `j` of NY, pushed `out` beyond the surface (for ribs). */
  const at = (j: number, a: number, out = 1): [number, number, number] => {
    const y = (topAt(a) * j) / NY;
    const r = taper(y) * out;
    return [Math.cos(a) * RX * r, base + y, Math.sin(a) * RZ * r];
  };
  const col = (i: number) => (i / NS) * Math.PI * 2;
  const pos: number[] = [];
  for (let j = 0; j <= NY; j++) for (let i = 0; i < NS; i++) pos.push(...at(j, col(i)));
  const idx: number[] = [];
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NS; i++) {
      const a = j * NS + i;
      const b = j * NS + ((i + 1) % NS);
      idx.push(a, a + NS, b, b, a + NS, b + NS);
    }
  }
  const shaft = new THREE.BufferGeometry();
  shaft.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  shaft.setIndex(idx);
  shaft.computeVertexNormals();
  addMesh(g, shaft, BITEXCO_GLASS);
  // Mullions on every other column (two floors per segment: the city is near the triangle cap), the spine up the helipad
  // side, and the lip round the slanted cut.
  for (let i = 0; i < NS; i += 2) {
    for (let j = 0; j < NY; j += 2) g.add(beam(at(j, col(i), 1.01), at(j + 2, col(i), 1.01), 0.016, FIN));
  }
  const spineA = Math.atan2(hz / RZ, hx / RX);
  for (let j = 0; j < NY; j++) g.add(beam(at(j, spineA, 1.04), at(j + 1, spineA, 1.04), 0.07, M.white));
  for (let i = 0; i < NS; i++) g.add(beam(at(NY, col(i), 1.01), at(NY, col(i + 1), 1.01), 0.04, M.white));
  // Slanted crown: a flat cap over the top ring.
  const rim = Array.from({ length: NS }, (_, i) => at(NY, col(i)));
  const mid = [0, 1, 2].map((k) => rim.reduce((s, q) => s + q[k], 0) / NS);
  const capPos: number[] = [];
  for (let i = 0; i < NS; i++) capPos.push(...mid, ...rim[(i + 1) % NS], ...rim[i]);
  const cap = new THREE.BufferGeometry();
  cap.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
  cap.computeVertexNormals();
  addMesh(g, cap, FIN);
  for (let y = 0.32; y < H - 0.15; y += 0.3) {
    const r = taper(y);
    const fin = cylinder(1, 1, 0.035, FIN, { y: base + y, segments: NS, open: true });
    fin.scale.set(RX * r + 0.012, 1, RZ * r + 0.012);
    g.add(fin);
  }
  for (const t of [0.42, 0.71]) {
    const r = taper(H * t);
    const belt = cylinder(1, 1, 0.16, BELT, { y: base + H * t, segments: NS, open: true });
    belt.scale.set(RX * r + 0.015, 1, RZ * r + 0.015);
    g.add(belt);
  }
  // Helipad.
  const yh = base + H * 0.74;
  const rh = taper(H * 0.74);
  const reach = 1 / Math.hypot(hx / (RX * rh), hz / (RZ * rh));
  const px = hx * (reach + 0.38);
  const pz = hz * (reach + 0.38);
  const ry = Math.atan2(hx, hz);
  g.add(cylinder(0.44, 0.44, 0.05, M.white, { x: px, y: yh, z: pz, segments: 16 }));
  g.add(cylinder(0.42, 0.08, 0.3, FIN, { x: px, y: yh - 0.3, z: pz, segments: 16 }));
  g.add(cylinder(0.445, 0.445, 0.02, lampMaterial, { x: px, y: yh + 0.035, z: pz, segments: 16, open: true }));
  g.add(box(0.14, 0.1, 0.4, FIN, { x: hx * (reach + 0.05), y: yh - 0.08, z: hz * (reach + 0.05), ry }));
  const mark = group({ x: px, y: yh + 0.05, z: pz, ry });
  for (const x of [-0.06, 0.06]) mark.add(box(0.025, 0.004, 0.16, BELT, { x }));
  mark.add(box(0.12, 0.004, 0.025, BELT));
  g.add(mark);
  // Roof garden on the top terrace.
  const garden = cylinder(0.6, 0.6, 0.03, LAWN, { y: base, segments: 20 });
  garden.scale.z = 0.72;
  g.add(garden);
  for (const [x, z] of [[0.72, 0.18], [0.5, 0.42], [-0.25, 0.5], [0.62, -0.32]] as const) g.add(sphere(0.08, HEDGE, { x, y: base, z, segments: 5 }));
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
  g.add(flag({ y: 1.38, h: 0.95, s: 1.0 }));
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
  t.add(flag({ y: 2.36, h: 0.7, s: 0.55 }));
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

/** Round planted bed with a hedge ring: the base of the plaza monument and the roundabout statue. */
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

// Tran Nguyen Han on horseback, in bronze on a tall stepped granite pedestal, at the centre of the roundabout in front of
// Ben Thanh: a hedged island with flower beds. The horse faces local +z.
function equestrianStatue(p: Place): THREE.Group {
  const g = group(p);
  hedgedBed(g, 0.62);
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    g.add(sphere(0.04, mat(AWNINGS[i % 2 === 0 ? 0 : 3]), { x: Math.cos(a) * 0.4, y: 0.08, z: Math.sin(a) * 0.4, segments: 4 }));
  }
  g.add(box(0.5, 0.08, 0.56, GRANITE, { y: 0.08 }));
  g.add(box(0.38, 0.08, 0.46, GRANITE, { y: 0.16 }));
  g.add(box(0.26, 0.48, 0.36, GRANITE, { y: 0.24 }));
  g.add(box(0.3, 0.04, 0.4, GRANITE, { y: 0.72 }));
  const top = 0.76;
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
  root.add(area(roundRect(3.2, -9.9, 9.9, -5.85, 0.55), LAWN, { h: 0.03 }));
  root.add(area(roundRect(-4.55, 3.05, -1.95, 7.0, 0.2), LAWN, { h: 0.03 }));

  // Streets, the park ring and the roundabout in front of Ben Thanh.
  for (const [x1, z1, x2, z2, w] of ROADS) root.add(road(x1, z1, x2, z2, w, { lines: w > 2, material: ASPHALT }));
  root.add(area(roundRect(-2.4, -4.4, 3.15, 3.05, 0.7), ASPHALT, { h: 0.05 }));
  root.add(area(ellipse(RB[0], RB[1], RB_R, RB_R, 40), ASPHALT, { h: 0.05 }));
  for (const z of [-4.75, 3.35, 6.75]) root.add(crosswalk(V1_X, z, 1.1));
  for (const x of [3.7, 8.4]) root.add(crosswalk(x, -2.25, 0.9, { ry: Math.PI / 2 }));
  root.add(crosswalk(3.7, 1.05, 0.9, { ry: Math.PI / 2 }));
  for (const z of [0.0, 6.55]) root.add(crosswalk(9.2, z, 0.9));
  for (const x of [-3.6, 0.3, RB[0] - RB_R - 0.35, RB[0] + RB_R + 0.35]) root.add(crosswalk(x, AVE_Z, 2.2, { ry: Math.PI / 2 }));
  root.add(crosswalk(-1.5, 3.35, 0.9));
  root.add(crosswalk(-4.95, 3.35, 0.8));
  // Paved plazas: the palm plaza, the apron round Ben Thanh, the Landmark 81 forecourt.
  root.add(patch(3.15, 1.75, PLAZA, { x: 0.425, z: 3.975, h: 0.045 }));
  root.add(patch(5.1, 4.7, PLAZA, { x: 5.9, z: 4.1, h: 0.045 }));
  root.add(patch(2.3, 0.6, PLAZA, { x: -3.2, z: 6.7, h: 0.045 }));

  // Oval park (30/4 Park) with its fountain and flag, in the middle of the traffic ring.
  root.add(area(ellipse(PARK[0], PARK[1], 1.68, 2.58), CURB, { h: 0.065 }));
  root.add(area(ellipse(PARK[0], PARK[1], 1.6, 2.5), LAWN, { h: 0.075 }));
  root.add(fountain({ x: PARK[0], y: 0.075, z: PARK[1] }));
  root.add(flag({ x: -0.75, y: 0.075, z: -2.0, h: 1.5, s: 0.9 }));

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
  root.add(bitexco({ x: 5.45, z: -7.6 }));
  root.add(postOffice({ x: 5.9, z: -0.68 }));
  root.add(benThanh({ x: 5.9, z: 4.05 }));
  root.add(monument({ x: 0.4, y: 0.045, z: 3.95 }));
  root.add(equestrianStatue({ x: RB[0], y: 0.05, z: RB[1], ry: Math.PI }));

  // Apartment blocks at the back right.
  const aptWall = mat(0xdcc6b8);
  const aptTrim = mat(0xf0e6dc);
  for (const [x, z, w, d, h] of [[6.95, -9.05, 1.3, 1.2, 3.4], [8.85, -8.8, 1.2, 1.3, 3.0], [8.75, -6.55, 1.3, 1.2, 3.2]] as const) {
    root.add(building({ x, z, w, d, h, wall: aptWall, trim: aptTrim, windows: 'grid', roof: 'flat', floorH: 0.4 }));
  }

  // Shophouses: a front row of shops along the street, a taller row behind it.
  for (let x = 3.3, i = 0; x < 9.6; i++) {
    const w = Math.min(0.6 + rand() * 0.28, 9.8 - x);
    root.add(shophouse(x + w / 2, -3.45, w - 0.03, 1.2, 1.15 + rand() * 0.45, SHOP_WALLS[i % SHOP_WALLS.length], AWNINGS[i % AWNINGS.length], rand() < 0.35));
    x += w;
  }
  for (let x = 3.6, i = 3; x < 7.8; i++) {
    const w = Math.min(0.65 + rand() * 0.3, 7.9 - x);
    root.add(shophouse(x + w / 2, -4.95, w - 0.03, 1.5, 1.85 + rand() * 0.55, SHOP_WALLS[i % SHOP_WALLS.length], undefined, rand() < 0.5));
    x += w;
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
    [-4.55, 3.0, -1.9, 7.1], // Landmark 81 block, planted below
    [-7.1, -9.6, -3.8, -6.6], // Opera House and its steps
    [-1.5, -9.8, 2.0, -4.4], // cathedral
    [-2.45, -4.45, 3.2, 3.1], // park ring
    [-7.1, -4.5, -2.3, -3.2], // under the bridge ramp
    [-1.2, 3.0, 2.05, 7.1], // palm plaza and stalls
    [3.1, -5.85, 9.95, 9.95], // shophouses, post office, Ben Thanh, front plaza
    [4.3, -8.5, 6.6, -6.7], // Bitexco podium
    [6.2, -9.75, 7.7, -8.35], // apartments
    [8.1, -9.55, 9.6, -8.05],
    [8.0, -7.25, 9.5, -5.85],
    [-5.6, 9.1, 3.2, 9.95], // avenue sidewalk palms
    [1.55, -9.95, 3.65, -4.4], // V1 sidewalks
  ];
  for (let gx = -9.4; gx <= 9.4; gx += 0.95) {
    for (let gz = -9.4; gz <= 9.4; gz += 0.95) {
      const x = Math.max(-9.4, Math.min(9.4, gx + (rand() - 0.5) * 0.45));
      const z = Math.max(-9.4, Math.min(9.4, gz + (rand() - 0.5) * 0.45));
      const s = 0.85 + rand() * 0.35;
      if (x < shoreAt(z) + 0.4 || onRoad(x, z, 0.3) || blocked.some(([ax, az, bx, bz]) => x > ax && x < bx && z > az && z < bz)) continue;
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
  crowd(5.9, 6.3, 4.6, 0.2, 4);
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
  // Round the roundabout counter-clockwise from above (traffic keeps right), from angle a0 to a1 in degrees at radius r.
  const arc = (r: number, a0: number, a1: number, n = 6) =>
    Array.from({ length: n + 1 }, (_, i): XZ => {
      const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
      return [RB[0] + Math.cos(a) * r, RB[1] - Math.sin(a) * r];
    });
  const market: XZ[] = [[2.75, 1.29], [8.96, 1.29], [8.96, 7.7], ...arc(1.2, 22, 158), [2.75, 7.7]];
  const aveWest: XZ[] = [[9.0, 7.3], ...arc(1.2, 45, 135), [-4.71, 7.3], [-4.71, 2.84], [2.75, 2.84], [2.75, -9.0]];
  const aveEast: XZ[] = [[2.45, -9.0], [2.45, 8.5], ...arc(1.2, 197, 343), [9.0, 8.5]];
  ride(ring, 'bikes', 6, 0.9, 0, true);
  ride(ring, 'taxi', 3, 0.9, 0.5, true);
  // Scooters circling the statue on the inner lane of the roundabout.
  const circle = arc(0.95, 0, 360, 32).slice(0, -1);
  ride(circle, 'bikes', 3, 0.7, 0, true);
  ride(circle, 'bikes', 3, 0.7, 0.5, true);
  ride(market, 'car', 3, 1.0, 0.5, true);
  // A swarm circling the Landmark 81 block: down the riverside road, along the avenue, back up past the stalls.
  ride([[-5.19, 2.36], [-5.19, 8.5], [-1.26, 8.5], [-1.26, 2.36]], 'bikes', 6, 0.95, 0, true);
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
