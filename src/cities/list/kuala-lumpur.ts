import * as THREE from 'three';
import {
  Animator, M, archHole, area, beam, box, boat, building, car, createBase, cylinder, dome, floodMat, gableRoof, group, lamp,
  lathe, mat, mergeStatic, patch, person, prism, profile, rng, road, row, scatter, shape, sphere, tree, tube, waterMat, windowMaterial,
  crosswalk, type Place,
} from '../../kit';
import type { CityScene } from '../types';
import BATU from '../shapes/batu-cliff.shape';
import MURUGAN from '../shapes/murugan-statue.shape';

// Petronas stainless steel: a pewter grey, so the fine ribbon windows read as texture, not as stripes.
const SILVER = mat(0xb4b7ba, { roughness: 0.35, metalness: 0.55 });
// Samad's terracotta hip roof (the shophouse terraces have their own roof colour).
const TERRA = mat(0xc8663f, { roughness: 0.8 });
// Copper onion domes: metallic, so they read apart from the matte terracotta roofs.
const COPPER = mat(0xb8795a, { roughness: 0.35, metalness: 0.6 });
const CREAM = mat(0xf0e2c4);
// Samad's cream sandstone walls, as the poster draws them (the real building is red brick).
const SAMAD_WALL = mat(0xdcc4a2);
// The two colonial blocks: lighter walls and a darker, lower roof than Samad, so they support it.
const OLD_WALL = mat(0xece3d0);
const OLD_ROOF = mat(0x8c4b38, { roughness: 0.8 });
// Masjid Jamek's minarets: brick red with thin white bands.
const MINARET_BRICK = mat(0xc9715b);
const ROCK = mat(0xb7a48b, { flat: true });
// Baked Batu hill and Murugan heights: the hill must stay inside the plinth corner (its footprint is ~0.9 of its height).
const BATU_H = 4.8;
const MURUGAN_H = 2.6;
// Merdeka 118 glass: two steel blue-grey tones, alternating facet by facet.
const BLUE_GLASS_A = mat(0x7d90a8, { roughness: 0.25, metalness: 0.45, flat: true });
const BLUE_GLASS_B = mat(0xa4b2c3, { roughness: 0.25, metalness: 0.45, flat: true });
const TRACK = mat(0xb9bec4, { roughness: 0.6, metalness: 0.2 });
const RAINBOW = [0xd9473f, 0xf08a3a, 0xf2cd48, 0x6cbf5c, 0x4f9bd6, 0x8a5fc4].map((c) => mat(c));
// Shophouse terraces: muted cream, ochre, pale green, salmon and white-cream fronts under terracotta roofs.
const SHOP_WALLS = [0xe9dcc0, 0xd9b27a, 0xc9d3ad, 0xe3a98c, 0xf0e6d2];
const SHOP_ROOF = mat(0xad6449, { roughness: 0.8 });
// Shopfront awnings on the office towers.
const AWNINGS = [0xc8433a, 0x2f6f5e, 0xd9a03a];
// KL lawns: olive greens, as the poster draws them (the kit's grass reads lime here).
const KL_LAWN = mat(0x7a9a52);
const KL_LAWN_DARK = mat(0x5f8442);
// Traffic: white, silver, black, red, blue and grey cars.
const CAR_PALETTE = [0xf2efe6, 0xb9bec4, 0x2b2b33, 0xc8433a, 0x3d6fb6, 0x7a8590];
// River: stone parapet walls and a desaturated teal, as the poster draws the Klang.
const EMBANK = mat(0xcdbb9c);
const KL_WATER = waterMat(0x5f9aae);
// Monorail accent band.
const MONORAIL_RED = mat(0xc8433a);
// Murugan statue and Batu cave mouth: plain by day, floodlit at night.
const GOLD = floodMat(0xe1b13a, 0xffc060, 0.5, { roughness: 0.35 });
const CAVE = floodMat(0x23190f, 0xff9a40, 0.5);

// Tree spots of the current build, so standing people keep off the trunks. Reset at the top of build(): the module outlives
// every visit of the city.
const treeSpots: [number, number][] = [];
const T = (x: number, z: number, s = 1, kind: 'round' | 'cone' | 'palm' | 'blossom' = 'round', y = 0) => {
  treeSpots.push([x, z]);
  return tree({ x, y, z, s, kind });
};

type XZ = [number, number];
type V3 = [number, number, number];

/**
 * Side faces between consecutive rings of equal vertex count, ordered by increasing angle so the faces look outward.
 * Non-indexed, so every face keeps a flat normal. Each quad gives an up then a down triangle; `pick` sends each face to one
 * of `materials`.
 */
function loft(rings: V3[][], materials: THREE.Material[], pick: (face: number) => number = () => 0): THREE.Group {
  const buckets: number[][] = materials.map(() => []);
  let face = 0;
  for (let r = 0; r + 1 < rings.length; r++) {
    const a = rings[r];
    const b = rings[r + 1];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      buckets[pick(face++)].push(...a[i], ...b[i], ...a[j]);
      buckets[pick(face++)].push(...a[j], ...b[i], ...b[j]);
    }
  }
  const g = group();
  buckets.forEach((pos, k) => {
    if (!pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, materials[k]);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  });
  return g;
}

const ringAt = (plan: XZ[], y: number, s = 1): V3[] => plan.map(([x, z]): V3 => [x * s, y, z * s]);

/**
 * Thin lit bands where a lofted skin crosses each height in `levels`, `h` tall and pushed `off` out along each face
 * normal: floor lines that follow every facet (the windows of a faceted glass tower at night).
 */
function skinLines(rings: V3[][], levels: number[], h: number, material: THREE.Material, off = 0.012): THREE.Mesh {
  const pos: number[] = [];
  const band = (tri: V3[]) => {
    const [a, b, c] = tri.map((p) => new THREE.Vector3(...p));
    const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize();
    for (const y of levels) {
      const hits: THREE.Vector3[] = [];
      for (const [p, q] of [[a, b], [b, c], [c, a]]) if ((p.y - y) * (q.y - y) < 0) hits.push(p.clone().lerp(q, (y - p.y) / (q.y - p.y)));
      if (hits.length !== 2) continue;
      let [p, q] = hits;
      // Order the segment along increasing angle (up × direction points out), so the band faces out like the skin.
      if (new THREE.Vector3(0, 1, 0).cross(new THREE.Vector3().subVectors(q, p)).dot(n) < 0) [p, q] = [q, p];
      const o = n.clone().multiplyScalar(off);
      const lo = (s: THREE.Vector3) => [s.x + o.x, y - h / 2, s.z + o.z];
      const hi = (s: THREE.Vector3) => [s.x + o.x, y + h / 2, s.z + o.z];
      pos.push(...lo(p), ...hi(p), ...lo(q), ...lo(q), ...hi(p), ...hi(q));
    }
  };
  for (let r = 0; r + 1 < rings.length; r++) {
    const a = rings[r];
    const b = rings[r + 1];
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      band([a[i], b[i], a[j]]);
      band([a[j], b[i], b[j]]);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/**
 * Petronas floor plan: two squares turned 45° (8 right-angle points) with a round lobe filling each inner corner, 16
 * protrusions in all; 6 vertices per 45° sector, increasing angle.
 */
function petronasPlan(R: number): XZ[] {
  const pts: XZ[] = [];
  const at = (a: number, r: number): XZ => [Math.cos(a) * r, Math.sin(a) * r];
  const lerp = (p: XZ, q: XZ, t: number): XZ => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  // Where the edges of the two squares cross: the inner corner each lobe fills.
  const inner = (R * Math.SQRT1_2) / Math.cos(Math.PI / 8);
  for (let k = 0; k < 8; k++) {
    const a0 = (k * Math.PI) / 4;
    const tip = at(a0, R);
    const corner = at(a0 + Math.PI / 8, inner);
    const s = lerp(tip, corner, 0.4);
    const e = lerp(at(a0 + Math.PI / 4, R), corner, 0.4);
    const peak = at(a0 + Math.PI / 8, R * 0.92);
    // Quadratic Bezier from s to e through the lobe's peak at t = 0.5.
    const c: XZ = [2 * peak[0] - (s[0] + e[0]) / 2, 2 * peak[1] - (s[1] + e[1]) / 2];
    const bez = (t: number): XZ => [
      (1 - t) ** 2 * s[0] + 2 * (1 - t) * t * c[0] + t * t * e[0],
      (1 - t) ** 2 * s[1] + 2 * (1 - t) * t * c[1] + t * t * e[1],
    ];
    pts.push(tip, s, bez(0.25), bez(0.5), bez(0.75), e);
  }
  return pts;
}

const PETRONAS_PLAN = petronasPlan(1);

/**
 * One Petronas tower, tip ≈ 13: straight to 55% of the height, five short sloped setbacks to the roof at 84%, a stepped
 * pinnacle with a ring ball a third of the way up its mast, fine low-contrast ribbon windows, and the round annex (44
 * storeys) on the flank at local +z, which faces the camera for ry = π/4.
 */
function petronas(p: Place): THREE.Group {
  const g = group(p);
  // [radius, bottom, top] of each straight section; a sloped loft joins each to the next.
  const sections: [number, number, number][] = [
    [1.0, 0, 7.2], [0.86, 7.32, 8.8], [0.74, 8.92, 10.0], [0.62, 10.1, 10.45], [0.52, 10.53, 10.9],
  ];
  const roof = 11.0;
  const top = 0.44;
  sections.forEach(([r, y0, y1], k) => {
    const [nr, ny] = k + 1 < sections.length ? sections[k + 1] : [top, roof];
    g.add(loft([ringAt(PETRONAS_PLAN, y0, r), ringAt(PETRONAS_PLAN, y1, r), ringAt(PETRONAS_PLAN, ny, nr)], [SILVER]));
    for (let y = y0 + 0.16; y + 0.065 < y1 - 0.06; y += 0.22) {
      g.add(loft([ringAt(PETRONAS_PLAN, y, r * 1.02), ringAt(PETRONAS_PLAN, y + 0.065, r * 1.02)], [windowMaterial]));
    }
  });
  g.add(prism(PETRONAS_PLAN.map(([x, z]): XZ => [x * top, z * top]), 0.04, SILVER, { y: roof - 0.02 }));
  g.add(cylinder(0.32, 0.4, 0.2, SILVER, { y: roof, segments: 16 }));
  g.add(cylinder(0.22, 0.3, 0.2, SILVER, { y: roof + 0.2, segments: 16 }));
  g.add(cylinder(0.06, 0.2, 0.2, SILVER, { y: roof + 0.4, segments: 12 }));
  g.add(cylinder(0.012, 0.045, 1.36, M.steel, { y: roof + 0.6, segments: 8 }));
  g.add(sphere(0.07, M.steel, { y: roof + 1.0, segments: 10 }));
  g.add(sphere(0.03, M.steel, { y: roof + 1.93, segments: 8 }));
  const ah = 5.1;
  g.add(cylinder(0.45, 0.45, ah, SILVER, { z: 1.25, segments: 18 }));
  for (let y = 0.16; y + 0.065 < ah - 0.1; y += 0.22) {
    g.add(cylinder(0.46, 0.46, 0.065, windowMaterial, { z: 1.25, y, segments: 18, open: true }));
  }
  g.add(cylinder(0.36, 0.47, 0.12, SILVER, { z: 1.25, y: ah, segments: 18 }));
  return g;
}

/** Double-deck skybridge at 37.6% of the height on inverted-V legs from 26%; spans local x (give it ry = π/4). */
function skybridge(p: Place, len: number): THREE.Group {
  const g = group(p);
  const y = 4.9;
  g.add(box(len, 0.12, 0.3, SILVER, { y }));
  g.add(box(len, 0.16, 0.26, windowMaterial, { y: y + 0.12 }));
  g.add(box(len, 0.1, 0.3, SILVER, { y: y + 0.28 }));
  g.add(box(len, 0.16, 0.26, windowMaterial, { y: y + 0.38 }));
  g.add(box(len, 0.08, 0.32, SILVER, { y: y + 0.54 }));
  for (const dz of [-0.11, 0.11]) {
    g.add(beam([-0.62, 3.4, dz], [0, y, dz], 0.06, SILVER));
    g.add(beam([0.62, 3.4, dz], [0, y, dz], 0.06, SILVER));
  }
  return g;
}

// Bukit Nanas: [radius, height] of the mound under the KL Tower, foot to summit.
const KL_HILL: XZ[] = [[1.8, 0], [1.72, 0.18], [1.5, 0.42], [1.18, 0.68], [0.8, 0.86], [0.42, 0.96], [0, 1.0]];

/** Height of the Bukit Nanas surface at distance `r` from the tower axis. */
function hillY(r: number): number {
  for (let i = 1; i < KL_HILL.length; i++) {
    const [r0, y0] = KL_HILL[i - 1];
    const [r1, y1] = KL_HILL[i];
    if (r <= r0 && r >= r1) return y0 + ((r0 - r) / (r0 - r1)) * (y1 - y0);
  }
  return r > KL_HILL[0][0] ? 0 : KL_HILL[KL_HILL.length - 1][1];
}

/**
 * KL Tower on Bukit Nanas: a shaft tapering to 0.55 of its base up to 66% of the height, a layered head with three dark
 * glazed bands between white slabs to 80%, and a red-and-white banded mast for the top 20%. The hill's trees are added in
 * build(), so they register in `treeSpots`.
 */
function klTower(p: Place): THREE.Group {
  const g = group(p);
  g.add(lathe(KL_HILL, KL_LAWN, { segments: 20 }));
  const base = KL_HILL[KL_HILL.length - 1][1];
  // The shaft starts just below the summit so no gap shows where the lathe meets the mound.
  g.add(lathe([[0.3, -0.05], [0.28, 1.6], [0.23, 3.8], [0.19, 5.7], [0.17, 6.7]], M.white, { y: base, segments: 14 }));
  const hy = base + 6.7;
  g.add(cylinder(0.2, 0.17, 0.06, M.red, { y: hy - 0.06, segments: 14 }));
  g.add(lathe([[0.17, 0], [0.42, 0.14], [0.6, 0.32], [0.66, 0.42]], M.white, { y: hy, segments: 20 }));
  // Bottom up: [radius, height, material, open]; glazed bands are open walls between closed white slabs.
  const stack: [number, number, THREE.Material, boolean][] = [
    [0.665, 0.15, windowMaterial, true], [0.71, 0.05, M.white, false], [0.67, 0.15, windowMaterial, true],
    [0.74, 0.05, M.white, false], [0.64, 0.13, windowMaterial, true],
  ];
  let y = hy + 0.42;
  for (const [r, h, m, open] of stack) {
    g.add(cylinder(r, r, h, m, { y, segments: 20, open }));
    y += h;
  }
  g.add(lathe([[0.66, 0], [0.56, 0.12], [0.36, 0.24], [0.2, 0.3]], M.white, { y, segments: 20 }));
  y += 0.3;
  g.add(cylinder(0.24, 0.26, 0.2, M.white, { y, segments: 12 }));
  g.add(cylinder(0.265, 0.265, 0.07, windowMaterial, { y: y + 0.06, segments: 12, open: true }));
  y += 0.2;
  const mast: [number, number, THREE.Material][] = [[0.06, 0.075, M.white], [0.045, 0.06, M.red], [0.032, 0.045, M.white], [0.02, 0.032, M.red]];
  for (const [rt, rb, m] of mast) {
    g.add(cylinder(rt, rb, 0.45, m, { y, segments: 8 }));
    y += 0.45;
  }
  g.add(cylinder(0.008, 0.02, 0.25, M.red, { y, segments: 6 }));
  return g;
}

/**
 * Merdeka 118: a near-straight shaft of large triangular facets (each ring turned half a step on the one below) in two
 * glass tones, thin lit floor lines for the night, a faceted crown and an off-centre spire for the top 24%.
 */
function merdeka(p: Place): THREE.Group {
  const g = group(p);
  g.add(box(2.8, 0.5, 2.2, M.concrete));
  g.add(box(2.2, 0.35, 1.7, mat(0x8a98a8, { roughness: 0.3, metalness: 0.4 }), { y: 0.5 }));
  const n = 8;
  const step = (Math.PI * 2) / n;
  const ring = (k: number, r: number, y: number): V3[] =>
    Array.from({ length: n }, (_, i): V3 => [Math.cos((i + k / 2) * step) * r, y, Math.sin((i + k / 2) * step) * r]);
  const radii = [0.98, 1.04, 1.0, 0.93, 0.86, 0.78, 0.72];
  const y0 = 0.85;
  const roof = 9.88;
  const tier = (roof - y0) / (radii.length - 1);
  const rings = radii.map((r, k) => ring(k, r, y0 + k * tier));
  // Crown: one short faceted tier that leaves a broad flat top for the spire, not a pencil point.
  rings.push(ring(radii.length, 0.54, roof + 0.5));
  g.add(loft(rings, [BLUE_GLASS_A, BLUE_GLASS_B], (f) => f % 2));
  const crown = rings[rings.length - 1];
  g.add(prism(crown.map(([x, , z]): XZ => [x, z]), 0.03, BLUE_GLASS_A, { y: roof + 0.48 }));
  const levels = Array.from({ length: 15 }, (_, i) => 1.3 + i * 0.6);
  g.add(skinLines(rings, levels, 0.035, windowMaterial));
  g.add(cylinder(0.012, 0.07, 2.6, M.steel, { x: 0.12, y: roof + 0.5, segments: 6 }));
  return g;
}

function onion(r: number, material: THREE.Material, p: Place): THREE.Group {
  const s = r / 0.4;
  const g = group(p);
  g.add(lathe([[0.3 * s, 0], [0.41 * s, 0.12 * s], [0.41 * s, 0.27 * s], [0.3 * s, 0.42 * s], [0.16 * s, 0.56 * s], [0.05 * s, 0.68 * s], [0, 0.8 * s]], material, { segments: 14 }));
  g.add(cylinder(0.008, 0.02, 0.28 * s, M.gold, { y: 0.78 * s, segments: 5 }));
  return g;
}

/** Moorish arched opening on a +x face: lit recess (glass by day, glowing at night) with a round head. */
function archWin(g: THREE.Group, x: number, y: number, z: number, w: number, h: number): void {
  g.add(box(0.05, h, w, windowMaterial, { x, y, z }));
  const head = cylinder(w / 2, w / 2, 0.05, windowMaterial, { x: x + 0.025, y: y + h, z, segments: 8 });
  head.rotation.z = Math.PI / 2;
  g.add(head);
}

/**
 * Arcaded façade `len` long and `h` tall: `bays` round-headed openings in a slab standing just proud of a lit recess,
 * trimmed on top. Local z = 0 is the wall face it covers; it faces local +z, so place it on a +z wall as is, on a +x wall
 * with ry = π/2, on a −z wall with ry = π.
 */
function arcade(len: number, h: number, bays: number, wall: THREE.Material, p: Place): THREE.Group {
  const g = group(p);
  const bw = len / bays;
  const w = bw * 0.62;
  // Springing height that leaves a 0.06 lintel above each arch; holes stay 0.04 clear of the slab's outline.
  const spring = h - 0.1 - w / 2;
  const holes = Array.from({ length: bays }, (_, i) =>
    archHole(-len / 2 + bw * (i + 0.5), w, spring, 8).map(([x, y]): XZ => [x, y + 0.04]));
  g.add(profile([[-len / 2, 0], [len / 2, 0], [len / 2, h], [-len / 2, h]], 0.05, wall, { holes, z: 0.055 }));
  g.add(box(len - 0.02, h - 0.04, 0.02, windowMaterial, { y: 0.02, z: 0.015 }));
  g.add(box(len, 0.035, 0.08, CREAM, { y: h - 0.01, z: 0.055 }));
  return g;
}

/** Clock face on a wall facing +`axis`: dark rim, white dial, hands at ten past ten, all standing out from the wall. */
function clockFace(g: THREE.Group, axis: 'x' | 'z', x: number, y: number, z: number): void {
  const out = (d: number) => ({ x: axis === 'x' ? x + d : x, y, z: axis === 'z' ? z + d : z });
  // Cylinders grow along +y from their base; turned so they grow out of the wall along +axis.
  for (const c of [cylinder(0.25, 0.25, 0.03, M.dark, { ...out(0), segments: 18 }), cylinder(0.22, 0.22, 0.03, M.white, { ...out(0.02), segments: 18 })]) {
    if (axis === 'x') c.rotation.z = -Math.PI / 2;
    else c.rotation.x = Math.PI / 2;
    g.add(c);
  }
  // [length, angle]: the minute hand to 2 and the hour hand to 10, as seen from outside the wall, in front of the dial.
  for (const [len, a] of [[0.18, -Math.PI / 3], [0.12, Math.PI / 3]] as const) {
    const hand = box(axis === 'x' ? 0.02 : 0.025, len, axis === 'x' ? 0.025 : 0.02, M.dark, out(0.065));
    if (axis === 'x') hand.rotation.x = a;
    else hand.rotation.z = a;
    g.add(hand);
  }
}

/**
 * Sultan Abdul Samad Building as the poster draws it: a long cream-sandstone block with two continuous arcaded storeys,
 * a central clock tower with spirelets and a copper onion dome, end pavilions with round domed turrets on their camera
 * corners, and a low terracotta hip roof. Long axis along z; the front is the +x face.
 */
function sultanAbdulSamad(p: Place): THREE.Group {
  const g = group(p);
  g.add(building({ w: 1.8, d: 6.0, h: 1.35, wall: SAMAD_WALL, roof: 'hip', roofMat: TERRA, roofH: 0.35, windows: 'none', plain: true }));
  g.add(box(1.9, 0.12, 6.1, CREAM));
  g.add(box(1.88, 0.1, 6.08, CREAM, { y: 0.62 }));
  g.add(box(1.9, 0.08, 6.1, CREAM, { y: 1.27 }));
  // Front: two storeys of arcades either side of the clock tower.
  for (const zc of [-1.375, 1.375]) {
    g.add(arcade(1.65, 0.5, 5, SAMAD_WALL, { x: 0.9, y: 0.12, z: zc, ry: Math.PI / 2 }));
    g.add(arcade(1.65, 0.55, 5, SAMAD_WALL, { x: 0.9, y: 0.72, z: zc, ry: Math.PI / 2 }));
  }
  // Back face: plain arched windows, so orbit views are not blank.
  for (let i = 0; i < 8; i++) {
    const z = -2.0 + i * (4.0 / 7);
    archWin(g, -0.93, 0.16, z, 0.2, 0.28);
    archWin(g, -0.93, 0.78, z, 0.18, 0.26);
  }
  // Clock tower: square shaft with banded stages, arched openings, clocks on the two camera faces, four spirelets and a
  // copper onion dome on an octagonal drum.
  g.add(box(1.0, 3.3, 1.0, SAMAD_WALL, { x: 0.45 }));
  // The top band stands 0.01 proud of the shaft's top, so their top faces do not z-fight.
  for (const yy of [0.9, 2.0, 3.21]) g.add(box(1.1, 0.1, 1.1, CREAM, { x: 0.45, y: yy }));
  archWin(g, 0.96, 0.15, 0, 0.3, 0.5);
  archWin(g, 0.96, 1.15, 0, 0.26, 0.5);
  clockFace(g, 'x', 0.95, 2.45, 0);
  clockFace(g, 'z', 0.45, 2.45, 0.5);
  for (const dx of [-0.38, 0.38]) for (const dz of [-0.38, 0.38]) {
    g.add(cylinder(0.05, 0.07, 0.3, CREAM, { x: 0.45 + dx, z: dz, y: 3.3, segments: 6 }));
    g.add(cylinder(0, 0.06, 0.2, COPPER, { x: 0.45 + dx, z: dz, y: 3.6, segments: 6 }));
  }
  g.add(cylinder(0.3, 0.38, 0.45, CREAM, { x: 0.45, y: 3.3, segments: 8 }));
  g.add(onion(0.42, COPPER, { x: 0.45, y: 3.75 }));
  // End pavilions: arcaded outer faces and a round turret with the big copper dome on each camera-side corner.
  for (const s of [-1, 1]) {
    const z = 2.75 * s;
    g.add(box(1.5, 1.95, 1.05, SAMAD_WALL, { z }));
    g.add(box(1.58, 0.08, 1.13, CREAM, { z, y: 0.7 }));
    g.add(box(1.6, 0.08, 1.15, CREAM, { z, y: 1.9 }));
    archWin(g, 0.75, 0.14, z, 0.3, 0.4);
    archWin(g, 0.75, 1.0, z, 0.3, 0.45);
    // The outer face's arcade stops short of the corner turret.
    const face = z + 0.525 * s;
    g.add(arcade(0.9, 0.55, 2, SAMAD_WALL, { x: -0.2, y: 0.12, z: face, ry: s > 0 ? 0 : Math.PI }));
    g.add(arcade(0.9, 0.6, 2, SAMAD_WALL, { x: -0.2, y: 0.8, z: face, ry: s > 0 ? 0 : Math.PI }));
    const tx = 0.62;
    const tz = z + 0.4 * s;
    g.add(cylinder(0.34, 0.34, 2.3, SAMAD_WALL, { x: tx, z: tz, segments: 12 }));
    for (const yy of [0.66, 1.86]) g.add(cylinder(0.37, 0.37, 0.07, CREAM, { x: tx, z: tz, y: yy, segments: 12 }));
    // Turret windows on its outward quarter (towards +x and the pavilion's open end).
    for (const yy of [0.2, 0.95, 1.45]) {
      for (const a of [0.3, 0.95]) {
        g.add(box(0.1, 0.26, 0.1, windowMaterial, { x: tx + Math.cos(a) * 0.31, y: yy, z: tz + Math.sin(a) * 0.31 * s }));
      }
    }
    g.add(cylinder(0.28, 0.32, 0.2, CREAM, { x: tx, z: tz, y: 2.3, segments: 8 }));
    g.add(onion(0.38, COPPER, { x: tx, z: tz, y: 2.5 }));
  }
  return g;
}

/**
 * Arcaded colonial block: a ground-floor arcade on its +z and +x faces, plain upper windows, lighter walls and a low dark
 * terracotta roof, so it supports Samad rather than competing with it.
 */
function oldBlock(p: Place, w: number, d: number): THREE.Group {
  const g = group(p);
  g.add(building({ w, d, h: 1.3, wall: OLD_WALL, roof: 'hip', roofMat: OLD_ROOF, roofH: 0.3, windows: 'none', plain: true }));
  g.add(box(w + 0.06, 0.08, d + 0.06, CREAM, { y: 0.62 }));
  g.add(arcade(w - 0.1, 0.52, Math.max(2, Math.round(w / 0.42)), OLD_WALL, { y: 0.06, z: d / 2 }));
  g.add(arcade(d - 0.1, 0.52, Math.max(2, Math.round(d / 0.42)), OLD_WALL, { x: w / 2, y: 0.06, ry: Math.PI / 2 }));
  const n = Math.floor(w / 0.5);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.35 + i * ((w - 0.7) / Math.max(1, n - 1));
    g.add(box(0.2, 0.4, 0.04, windowMaterial, { x, y: 0.8, z: d / 2 }));
  }
  return g;
}

/**
 * Terrace of `n` shophouses facing local +z, sharing party walls: a five-foot-way arcade at street level, a shuttered
 * upper floor, a front parapet with a small pediment on every other unit, and pitched roofs with the ridge parallel to
 * the street, one roof per two units with a slight height step between them.
 */
function shophouseRow(p: Place, n: number, i0: number): THREE.Group {
  const g = group(p);
  const gh = 0.5;
  g.add(box(n, gh, 1.3, mat(0xe9dcc0), { z: -0.25 }));
  g.add(arcade(n, gh, 3 * n, CREAM, { z: 0.82 }));
  for (let s = 0; s < Math.ceil(n / 2); s++) {
    const units = Math.min(2, n - 2 * s);
    const top = 1.25 + (s % 2) * 0.08;
    const sx = -n / 2 + 2 * s + units / 2;
    for (let k = 0; k < units; k++) {
      const i = 2 * s + k;
      const ux = -n / 2 + i + 0.5;
      const wall = mat(SHOP_WALLS[(i0 + i) % SHOP_WALLS.length]);
      const shutter = (i0 + i) % 2 ? mat(0x4f7a52) : mat(0x6b4a33);
      g.add(box(1.0, top - gh, 1.8, wall, { x: ux, y: gh }));
      for (const wx of [-0.22, 0.22]) {
        g.add(box(0.22, 0.4, 0.03, windowMaterial, { x: ux + wx, y: gh + 0.22, z: 0.9 }));
        g.add(box(0.07, 0.4, 0.03, shutter, { x: ux + wx - 0.1, y: gh + 0.22, z: 0.92 }));
        g.add(box(0.07, 0.4, 0.03, shutter, { x: ux + wx + 0.1, y: gh + 0.22, z: 0.92 }));
      }
      g.add(box(1.0, 0.16, 0.06, wall, { x: ux, y: top, z: 0.87 }));
      if (i % 2 === 0) g.add(profile([[-0.22, 0], [0.22, 0], [0, 0.12]], 0.06, wall, { x: ux, y: top + 0.16, z: 0.87 }));
    }
    g.add(box(units, 0.06, 0.1, CREAM, { x: sx, y: top - 0.06, z: 0.88 }));
    g.add(gableRoof(units, 1.8, 0.38, SHOP_ROOF, { x: sx, y: top }));
  }
  return g;
}

interface TowerSkin {
  windows: 'grid' | 'bands' | 'none';
  awning: number;
  floorH?: number;
  /** White vertical fins over a lit glass slot on all four faces. */
  fins?: boolean;
  /** Thin lit floor bands over a glass body, so a glass tower still lights at night. */
  bands?: boolean;
}

/** Office tower with a shopfront; `skin` picks its façade system, so neighbours need not all be ribbon windows. */
function officeTower(x: number, z: number, w: number, d: number, h: number, wall: THREE.Material, skin: TowerSkin): THREE.Group {
  const g = building({ x, z, w, d, h, wall, windows: skin.windows, floorH: skin.floorH ?? 0.5, roof: 'flat', shop: skin.awning });
  const y0 = 0.6;
  const fh = h - y0 - 0.2;
  if (!skin.fins && !skin.bands) return g;
  // [face length, offset along the face normal, ry] for the four faces.
  const faces: [number, number, number][] = [[d, w / 2, Math.PI / 2], [w, d / 2, 0], [d, w / 2, -Math.PI / 2], [w, d / 2, Math.PI]];
  for (const [fl, off, ry] of faces) {
    const face = group({ ry });
    if (skin.fins) {
      face.add(box(fl - 0.2, fh, 0.02, windowMaterial, { y: y0, z: off + 0.01 }));
      for (let fx = -fl / 2 + 0.15; fx <= fl / 2 - 0.14; fx += 0.18) face.add(box(0.04, fh, 0.08, wall, { x: fx, y: y0, z: off + 0.04 }));
    }
    if (skin.bands) {
      for (let y = y0 + 0.2; y < h - 0.25; y += 0.4) face.add(box(fl - 0.04, 0.05, 0.02, windowMaterial, { y, z: off + 0.01 }));
      for (let fx = -fl / 2 + 0.25; fx <= fl / 2 - 0.24; fx += 0.3) face.add(box(0.025, fh, 0.03, M.steel, { x: fx, y: y0, z: off + 0.02 }));
    }
    g.add(face);
  }
  return g;
}

// Lord Murugan: baked Rodin statue (scripts/rodin/assets.ts), one gold part, facing local +z with the vel on its left
// hand (+x). Its thin base plate is sunk into the top plinth block.
function murugan(p: Place): THREE.Group {
  const g = group(p);
  g.add(box(1.5, 0.45, 1.1, mat(0xe3d6b8)));
  g.add(box(1.2, 0.22, 0.8, mat(0xd2c4a3), { y: 0.45 }));
  g.add(shape(MURUGAN, [GOLD], { y: 0.67 - 0.05 * MURUGAN_H, height: MURUGAN_H, smooth: true }));
  return g;
}

// Batu Caves: baked Rodin limestone hill (scripts/rodin/assets.ts) with its jungle, the cave mouth on local +z. Part 0 is
// the cave interior (dark, lit at night), part 1 the jungle, part 2 the limestone. Measured off the bake: the mouth is
// centred at x ≈ -0.05·H and its sill sits 0.26·H up, where the cliff face is at z ≈ 0.26·H. The rainbow staircase climbs
// from the forecourt to the sill.
function batuCaves(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  g.add(shape(BATU, [CAVE, M.leaf, ROCK], { height: BATU_H }));
  const cx = -0.05 * BATU_H;
  const sill = 0.26 * BATU_H;
  const steps = 10;
  const z0 = 3.4; // foot of the stairs, on the forecourt
  const z1 = 0.26 * BATU_H + 0.25; // top step, just in front of the sill
  const run = (z0 - z1) / (steps - 1);
  for (let i = 0; i < steps; i++) {
    g.add(box(1.0, ((i + 1) * sill) / steps, run, RAINBOW[Math.floor(i / 2) % RAINBOW.length], { x: cx, z: z0 - i * run }));
  }
  for (const sx of [cx - 0.53, cx + 0.53]) g.add(beam([sx, 0.25, z0 + 0.1], [sx, sill + 0.25, z1], 0.05, M.white));
  return g;
}

/** Masjid Jamek at the river confluence: twin onion domes on a cream hall, a red-banded arcade and two banded minarets. Faces +z. */
function masjidJamek(p: Place): THREE.Group {
  const g = group(p);
  const domeWhite = mat(0xf6f1e6);
  g.add(box(1.5, 0.7, 0.7, CREAM, { z: -0.2 }));
  g.add(box(1.56, 0.06, 0.76, M.white, { y: 0.7, z: -0.2 }));
  for (const cx of [-0.55, -0.18, 0.18, 0.55]) {
    g.add(box(0.14, 0.3, 0.03, windowMaterial, { x: cx, y: 0.14, z: 0.16 }));
    const head = cylinder(0.07, 0.07, 0.03, windowMaterial, { x: cx, y: 0.44, z: 0.16, segments: 8 });
    head.rotation.x = Math.PI / 2;
    g.add(head);
  }
  // Arcade: slender columns carrying a red-banded lintel and a flat roof.
  g.add(box(1.7, 0.06, 0.5, M.white, { y: 0.45, z: 0.38 }));
  g.add(box(1.72, 0.05, 0.07, M.red, { y: 0.4, z: 0.62 }));
  for (let k = 0; k <= 6; k++) g.add(box(0.05, 0.4, 0.05, CREAM, { x: -0.75 + k * 0.25, z: 0.6 }));
  for (const sx of [-0.4, 0.4]) {
    g.add(cylinder(0.26, 0.3, 0.14, CREAM, { x: sx, z: -0.2, y: 0.76, segments: 10 }));
    g.add(onion(0.3, domeWhite, { x: sx, z: -0.2, y: 0.9 }));
  }
  for (const sx of [-0.93, 0.93]) {
    g.add(box(0.22, 0.3, 0.22, CREAM, { x: sx, z: -0.1 }));
    // Minaret: brick-red shaft with thin white bands, a white gallery and a white cap like the main domes.
    g.add(cylinder(0.07, 0.075, 1.2, MINARET_BRICK, { x: sx, z: -0.1, y: 0.3, segments: 8 }));
    for (const yy of [0.62, 0.98, 1.34]) g.add(cylinder(0.078, 0.078, 0.04, M.white, { x: sx, z: -0.1, y: yy, segments: 8 }));
    g.add(cylinder(0.12, 0.1, 0.04, CREAM, { x: sx, z: -0.1, y: 1.5, segments: 8 }));
    g.add(cylinder(0.05, 0.06, 0.34, M.white, { x: sx, z: -0.1, y: 1.54, segments: 8 }));
    g.add(onion(0.1, domeWhite, { x: sx, z: -0.1, y: 1.88 }));
  }
  return g;
}

/**
 * Elevated monorail: a slim straddle beam on T-piers and one 4-car train with rounded noses. Each car is merged per
 * material before it is animated, so it costs three draws.
 */
function monorail(anim: Animator, path: XZ[]): THREE.Group {
  const g = group();
  const Y = 1.3;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    g.add(beam([ax, Y, az], [bx, Y, bz], 0.12, TRACK));
    const len = Math.hypot(bx - ax, bz - az);
    total += len;
    const ry = Math.atan2(az - bz, bx - ax);
    const n = Math.floor(len / 2);
    // A bend's pier comes from the segment that ends there, not again from the one that starts there.
    for (let k = i > 1 ? 1 : 0; k <= n; k++) {
      const t = n === 0 ? 0 : k / n;
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      if (len > 1.2 && !(Math.abs(px - 1.2) < 1.1 && pz > -3.5)) {
        g.add(box(0.1, Y - 0.1, 0.1, TRACK, { x: px, z: pz }));
        g.add(box(0.12, 0.06, 0.32, TRACK, { x: px, y: Y - 0.12, z: pz, ry }));
      }
    }
  }
  // A car runs along local +z; `nose` is +1 or −1 for an end car's rounded front, 0 for a middle car.
  const trainCar = (nose: number) => {
    const c = group({ y: Y });
    c.add(box(0.3, 0.3, 0.42, M.white));
    c.add(box(0.31, 0.09, 0.38, windowMaterial, { y: 0.15 }));
    c.add(box(0.31, 0.035, 0.41, MONORAIL_RED, { y: 0.05 }));
    if (nose) {
      const d = dome(0.15, M.white, { x: 0, y: 0.15, z: 0.21 * nose, squash: 1.3, segments: 12 });
      d.rotation.x = (nose * Math.PI) / 2;
      c.add(d);
    }
    mergeStatic(c);
    return c;
  };
  for (let i = 0; i < 4; i++) g.add(anim.follow(trainCar(i === 0 ? 1 : i === 3 ? -1 : 0), path, 1.3, -(i * 0.46) / total));
  return g;
}

/**
 * Bowstring arch bridge: a white segmental body with an asphalt deck and rails following its low crown (ends flush with
 * the road at y 0.05), under two white arch ribs on the deck edges with hangers and ties. Lanes stop short of the deck, so
 * no car passes under the ribs.
 */
function archBridge(p: Place, len: number, w: number): THREE.Group {
  const g = group(p);
  const half = len / 2;
  const hw = len * 0.37;
  const N = 14;
  const xs = Array.from({ length: N + 1 }, (_, i) => -half + (len * i) / N);
  const crown = xs.map((x) => 0.05 + 0.1 * (1 - (x / half) ** 2));
  const body: [number, number][] = [[-half, 0], ...xs.map((x, i): [number, number] => [x, crown[i]]), [half, 0]];
  const hole: [number, number][] = Array.from({ length: 13 }, (_, i) => {
    const x = -hw + (2 * hw * i) / 12;
    return [x, 0.02 + 0.09 * (1 - (x / hw) ** 2)];
  });
  g.add(profile(body, w, M.white, { holes: [hole] }));
  // Bowstring: two white arch ribs along the deck edges, rising 0.9 over it, hung on thin hangers and tied at the crown.
  const hr = half - 0.1;
  const deckY = (x: number) => 0.05 + 0.1 * (1 - (x / half) ** 2);
  const ribY = (x: number) => deckY(x) + 0.9 * (1 - (x / hr) ** 2);
  const zr = w / 2 - 0.05;
  for (const s of [-1, 1]) {
    const pts = Array.from({ length: 17 }, (_, i) => {
      const x = -hr + (2 * hr * i) / 16;
      return new THREE.Vector3(x, ribY(x), s * zr);
    });
    g.add(tube(pts, 0.035, M.white, { segments: 32 }));
    for (let k = 1; k <= 6; k++) {
      const x = -hr + (2 * hr * k) / 7;
      g.add(beam([x, deckY(x) + 0.02, s * zr], [x, ribY(x), s * zr], 0.015, M.white));
    }
  }
  for (const x of [-0.4, 0, 0.4]) g.add(beam([x, ribY(x), -zr], [x, ribY(x), zr], 0.025, M.white));
  const strip = (lo: number, hi: number): [number, number][] => [
    ...xs.map((x, i): [number, number] => [x, crown[i] + lo]),
    ...xs.map((x, i): [number, number] => [x, crown[i] + hi]).reverse(),
  ];
  g.add(profile(strip(-0.005, 0.02), w - 0.2, M.asphalt));
  for (const s of [-1, 1]) g.add(profile(strip(0.02, 0.11), 0.05, M.steel, { z: s * (w / 2 - 0.05) }));
  return g;
}

export default function build(): CityScene {
  treeSpots.length = 0;
  const rand = rng(101);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: M.asphalt, side: mat(0x8a5a3c) }));

  // --- Ground blocks (everything else stays asphalt road). Overlapping blocks differ in height so their tops never z-fight. ---
  const block = (x: number, z: number, w: number, d: number, m: THREE.Material = M.pavement, h = 0.04) => root.add(patch(w, d, m, { x, z, h }));
  block(-7.4, -1.4, 4.6, 6.4);
  block(-7.6, -7.3, 4.3, 4.4, KL_LAWN, 0.05);
  block(-7.4, -2.4, 3.8, 3.2, KL_LAWN, 0.05);
  block(-3.1, -6.0, 5.4, 7.2, KL_LAWN_DARK, 0.055);
  // KL Tower park paths: one across the park, one down its east side to the mosque forecourt.
  // Path ends stop 0.01 inside the lawn, so their end faces are not coplanar with its sides.
  block(-3.1, -7.2, 5.38, 0.25, M.pavement, 0.06);
  block(-1.3, -6.29, 0.25, 6.58, M.pavement, 0.065);
  block(-3.3, 3.3, 2.6, 8.2);
  block(-3.3, 8.6, 2.6, 2.2, KL_LAWN);
  block(-7.4, 6.2, 4.6, 7.0);
  block(3.9, -7.0, 4.0, 5.2);
  block(6.4, 5.8, 6.6, 7.6);
  block(-0.35, 4.0, 0.9, 11.4, M.pavement);
  block(8.4, -9.0, 2.4, 1.6, M.pavement);
  block(5.6, -4.6, 2.6, 2.2, M.pavement, 0.045);
  // Riverside park on the old asphalt void north of the east leg, under the monorail, with a path along it.
  block(6.0, 0.6, 7.4, 2.4, KL_LAWN, 0.05);
  block(6.0, 0.6, 7.38, 0.3, M.pavement, 0.055);
  // Inside the rect of half-size hw × hd centred at (cx, cz) and turned by ry: footprints for placement checks.
  const inRect = (x: number, z: number, cx: number, cz: number, hw: number, hd: number, ry = 0) => {
    const dx = x - cx;
    const dz = z - cz;
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    return Math.abs(dx * c - dz * s) < hw && Math.abs(dx * s + dz * c) < hd;
  };

  // --- River confluence: main leg (x 0.3–2.1), east leg (z −3.5 to −1.7), back tributary (x 0.6–1.8) ---
  const water = (x1: number, z1: number, x2: number, z2: number, w: number) =>
    root.add(road(x1, z1, x2, z2, w, { lines: false, material: KL_WATER }));
  water(1.2, -3.5, 1.2, 9.95, 1.8);
  water(0.3, -2.6, 9.95, -2.6, 1.8);
  water(1.2, -9.95, 1.2, -3.0, 1.2);
  // The two inner corners of the confluence are cut on the diagonal, so the river turns rather than meets at right angles.
  root.add(area([[2.1, -1.7], [2.7, -1.7], [2.1, -1.1]], KL_WATER, { h: 0.05 }));
  root.add(area([[1.8, -3.5], [1.8, -4.1], [2.4, -3.5]], KL_WATER, { h: 0.05 }));
  // Stone parapet walls on every bank, flush with the water's edge and 0.15 above it, so the river reads as a walled
  // channel. They stop at each bridge, where a stone block closes the run.
  const wall = (x1: number, z1: number, x2: number, z2: number) =>
    root.add(box(Math.hypot(x2 - x1, z2 - z1), 0.2, 0.1, EMBANK, { x: (x1 + x2) / 2, z: (z1 + z2) / 2, ry: Math.atan2(z1 - z2, x2 - x1) }));
  const endBlock = (x: number, z: number) => root.add(box(0.16, 0.26, 0.16, EMBANK, { x, z }));
  wall(0.25, -3.6, 0.25, 5.4);
  wall(0.25, 6.6, 0.25, 9.9);
  wall(2.15, -1.1, 2.15, 5.4);
  wall(2.15, 6.6, 2.15, 9.9);
  wall(2.135, -1.065, 2.735, -1.665);
  wall(2.7, -1.65, 6.25, -1.65);
  wall(7.35, -1.65, 9.9, -1.65);
  wall(2.4, -3.55, 6.25, -3.55);
  wall(7.35, -3.55, 9.9, -3.55);
  wall(1.835, -4.135, 2.435, -3.535);
  wall(0.55, -9.9, 0.55, -3.6);
  wall(0.25, -3.55, 0.55, -3.55);
  wall(1.85, -9.9, 1.85, -4.1);
  for (const z of [5.4, 6.6]) for (const x of [0.25, 2.15]) endBlock(x, z);
  for (const x of [6.25, 7.35]) for (const z of [-1.65, -3.55]) endBlock(x, z);

  // Bridges.
  root.add(archBridge({ x: 1.2, z: 6.0 }, 3.0, 1.1));
  root.add(archBridge({ x: 6.8, z: -2.6, ry: Math.PI / 2 }, 3.0, 1.0));
  root.add(road(-2.2, 6.0, -0.3, 6.0, 1.1));
  root.add(road(2.7, 6.0, 9.7, 6.0, 1.1));
  root.add(crosswalk(3.6, 6.0, 1.1, { ry: Math.PI / 2 }));
  root.add(crosswalk(-1.0, 3.0, 1.0));

  // Boats: each path stops half a hull plus 0.1 short of the bridge decks (front deck from z 5.45, east deck from x 6.3).
  root.add(anim.bob(anim.follow(boat({ color: 0xe8e2d4, len: 0.9 }), [[1.2, 4.9], [1.2, 0.8]], 0.45, 0.2) as THREE.Group, 0.01, 1.2));
  root.add(anim.follow(boat({ color: 0xd9726a, len: 0.8 }), [[3.0, -2.6], [5.8, -2.6]], 0.4, 0.5));

  // --- Landmarks ---
  root.add(petronas({ x: -8.6, z: 0.2, ry: Math.PI / 4 }));
  root.add(petronas({ x: -6.4, z: -2.0, ry: Math.PI / 4 }));
  // Suria KLCC podium at the tower bases: banded mall block, a curved two-storey glazed front between the annexes, and the
  // fountain pool in front of it.
  root.add(building({ x: -7.5, z: -0.9, w: 4.0, d: 2.2, h: 0.55, ry: Math.PI / 4, wall: mat(0xcfd6dc), windows: 'bands', floorH: 0.28, plain: true }));
  const suriaFront = Array.from({ length: 13 }, (_, i): XZ => [Math.cos((Math.PI * i) / 12), 1.0 + Math.sin((Math.PI * i) / 12) * 0.5]);
  root.add(group({ x: -7.5, z: -0.9, ry: Math.PI / 4 },
    prism(suriaFront, 0.3, windowMaterial),
    prism(suriaFront, 0.22, CREAM, { y: 0.3 }),
    prism(suriaFront.map(([x, z]): XZ => [x * 1.03, 1.0 + (z - 1.0) * 1.06]), 0.04, SILVER, { y: 0.52 }),
    cylinder(0.42, 0.42, 0.04, CREAM, { y: 0.04, z: 2.1, segments: 20 }),
    cylinder(0.34, 0.34, 0.035, KL_WATER, { y: 0.04, z: 2.1, segments: 20 }),
  ));
  root.add(skybridge({ x: -7.5, z: -0.9, ry: Math.PI / 4 }, 1.9));
  root.add(klTower({ x: -3.2, z: -4.4 }));
  root.add(merdeka({ x: 3.9, z: -7.5, ry: 0.4 }));
  root.add(sultanAbdulSamad({ x: -3.3, z: 3.2 }));
  root.add(batuCaves(7.6, -7.6));
  root.add(murugan({ x: 6.3, z: -5.0 }));
  // Pavement forecourt so the mosque stands on a platform clear of the tower-park lawn.
  root.add(patch(2.1, 1.6, M.pavement, { x: -0.95, z: -2.2, h: 0.065 }));
  root.add(masjidJamek({ x: -0.95, y: 0.065, z: -2.2 }));

  // --- City fabric ---
  root.add(officeTower(-8.1, 6.6, 1.7, 1.7, 3.6, mat(0xd08a68), { windows: 'grid', awning: AWNINGS[0] }));
  root.add(officeTower(-8.5, 3.9, 1.3, 1.5, 4.7, mat(0xeef0f0), { windows: 'none', awning: AWNINGS[1], fins: true }));
  root.add(oldBlock({ x: -6.0, z: 8.5 }, 3.4, 1.7));
  root.add(oldBlock({ x: -5.7, z: 4.9 }, 1.8, 2.4));
  root.add(officeTower(4.7, 2.0, 1.5, 1.5, 4.8, mat(0xd4d8dc), { windows: 'grid', awning: AWNINGS[2] }));
  root.add(officeTower(6.7, 3.0, 1.5, 1.6, 3.9, mat(0xc9d1d8), { windows: 'bands', floorH: 0.7, awning: AWNINGS[0] }));
  root.add(officeTower(3.6, 9.15, 1.5, 1.2, 2.6, mat(0x8fa3b3, { roughness: 0.2, metalness: 0.4 }), { windows: 'none', awning: AWNINGS[1], bands: true }));
  // Shophouse terraces, clear of the z = 6 road (z 5.45–6.55): five units facing the front edge, three facing the right edge.
  root.add(shophouseRow({ x: 6.3, z: 7.5 }, 5, 0));
  root.add(shophouseRow({ x: 8.85, z: 3.9, ry: Math.PI / 2 }, 3, 2));
  // Merdeka 118's low glazed podium pavilion, fully on the forecourt pavement.
  root.add(building({ x: 3.7, z: -5.0, w: 1.4, d: 0.9, h: 0.55, wall: mat(0x9fb3c3, { roughness: 0.25, metalness: 0.3 }), roof: 'flat', windows: 'bands', floorH: 0.27, plain: true }));

  // Monorail running beside the river and over the east leg.
  root.add(monorail(anim, [[-1.4, 9.0], [-1.4, 0.2], [-0.6, -0.8], [9.2, -0.8]]));

  // --- Vegetation ---
  root.add(row(-9.2, -4.8, -5.6, -4.8, 5, (x, z, i) => T(x, z, 1.0 + (i % 2) * 0.2, i % 2 ? 'round' : 'palm')));
  root.add(scatter({ x: -7.6, z: -7.4, w: 3.8, d: 3.8 }, 10, rand, (x, z, i) => T(x, z, 1.1, i % 3 ? 'round' : 'palm')));
  // KL Tower park: trees off the Bukit Nanas mound and both paths. Its own seed means later edits to it cannot move the
  // scatters after it; mostly round canopies, one palm.
  const offPark = (x: number, z: number) => Math.hypot(x + 3.2, z + 4.4) < 2.0 || Math.abs(z + 7.2) < 0.25 || Math.abs(x + 1.3) < 0.25;
  root.add(scatter({ x: -3.0, z: -6.4, w: 4.4, d: 5.4 }, 9, rng(102), (x, z, i) => T(x, z, 1.1, i === 4 ? 'palm' : 'round'), offPark));
  // KL Tower park clumps, each on its own seed.
  [[-5.0, -8.6], [-2.2, -8.7], [-0.75, -5.0]].forEach(([cx, cz], k) =>
    root.add(scatter({ x: cx, z: cz, w: k === 2 ? 0.6 : 1.2, d: 1.0 }, 4, rng(110 + k), (x, z) => T(x, z, 1.0), offPark)));
  // Merdeka forecourt: three trees along the river promenade, clear of the pavilion, the walker loop and the statue plinth.
  for (const [x, z] of [[2.4, -4.7], [4.75, -3.85], [6.15, -3.85]]) root.add(T(x, z, 0.9));
  // Front-left grove on the lawn by the road (round canopies, as in the poster's front park), east of the old block.
  root.add(scatter({ x: -3.1, z: 8.6, w: 1.8, d: 1.8 }, 8, rng(104), (x, z, i) => T(x, z, 0.9 + (i % 3) * 0.1)));
  root.add(row(-2.1, 0.3, -2.1, 6.9, 5, (x, z) => T(x, z, 0.8, 'palm')));
  // Front strip: a denser row, starting east of the glass tower at (3.6, 9.15).
  root.add(row(4.6, 9.4, 9.3, 9.4, 7, (x, z, i) => T(x, z, 0.85, i % 3 ? 'round' : 'palm')));
  // Between the banded tower and the right terrace (x < 7.9), off both footprints.
  root.add(scatter({ x: 7.3, z: 4.4, w: 2.2, d: 1.4 }, 6, rng(108), (x, z, i) => T(x, z, 1.0, i % 2 ? 'round' : 'palm'),
    (x, z) => x > 7.85 || inRect(x, z, 6.7, 3.0, 0.9, 0.95)));
  // Front-left corner clump, between the brick tower and the old block's west end (x < −7.9).
  root.add(scatter({ x: -8.7, z: 8.6, w: 1.5, d: 1.7 }, 5, rng(109), (x, z, i) => T(x, z, 0.85 + (i % 2) * 0.1)));
  // South of the right terrace (it spans z 2.4–5.4), so the palms stand clear of it.
  root.add(row(9.3, 0.0, 9.3, 2.2, 3, (x, z) => T(x, z, 0.9, 'palm')));
  root.add(scatter({ x: 5.2, z: -9.0, w: 2.2, d: 1.2 }, 4, rng(106), (x, z, i) => T(x, z, 1.0, i % 2 ? 'round' : 'palm'), (x, z) => inRect(x, z, 3.9, -7.5, 1.55, 1.25, 0.4)));
  // Riverside park trees: off the path, at least 0.4 from the monorail line (z −0.8), clear of the two towers and the palm row.
  root.add(scatter({ x: 6.0, z: 0.6, w: 7.2, d: 2.2 }, 11, rng(105), (x, z, i) => T(x, z, 0.9, i % 4 === 3 ? 'palm' : 'round'),
    (x, z) => Math.abs(z - 0.6) < 0.3 || z < -0.4 || x > 9.0 || inRect(x, z, 4.7, 2.0, 0.95, 0.95) || inRect(x, z, 6.7, 3.0, 0.95, 1.0)));
  // Bukit Nanas forest: a ring of trees on the KL Tower mound, standing on its surface.
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6 + (k % 2) * 0.2;
    const r = 0.95 + (k % 3) * 0.3;
    // Seated at the height of the trunk's downhill edge, so no side of the foot floats on the slope.
    root.add(T(-3.2 + Math.cos(a) * r, -4.4 + Math.sin(a) * r, 0.85 + (k % 2) * 0.15, k % 5 === 4 ? 'palm' : 'round', hillY(r + 0.05) - 0.01));
  }

  // Street life.
  // Lamps on the kerbs, clear of the lanes (z 2.35, x -1.7 / -1.0) and the crosswalk.
  root.add(row(-9.6, 2.8, -5.2, 2.8, 5, (x, z) => lamp({ x, z })));
  root.add(row(-0.55, 1.0, -0.55, 4.6, 2, (x, z) => lamp({ x, z })));
  root.add(row(-0.55, 7.4, -0.55, 9.4, 2, (x, z) => lamp({ x, z })));

  // Kuala Lumpurians: baju kurung and batik tones (teal, magenta, saffron, emerald, batik blue), white shirts, a few black and cream tudung tops.
  const COATS = [0x1f8f8a, 0xf2efe6, 0xb8327e, 0xe8a92f, 0x1e7d52, 0xe8dcc0, 0x2f55a4, 0x2b2b33, 0xf2efe6, 0xc9482f];
  const UMBRELLAS = [0xe8a92f, 0xb8327e, 0x1f8f8a, 0x2b2b33];
  // Merdeka forecourt patch (top 0.045); the rest of the pavement is 0.04, the bare tile 0 under the Batu steps.
  const onForecourt = (x: number, z: number) => Math.abs(x - 5.6) < 1.3 && Math.abs(z + 4.6) < 1.1;
  const kl = (x: number, z: number, i: number, y: number, brolly = false) =>
    person({ x, y, z, color: COATS[i % COATS.length], umbrella: brolly ? UMBRELLAS[i % UMBRELLAS.length] : undefined });
  const pave = (x: number, z: number, i: number) => kl(x, z, i, onForecourt(x, z) ? 0.045 : 0.04, i % 5 === 3);
  const offTree = (x: number, z: number) => treeSpots.some(([tx, ty]) => Math.hypot(x - tx, z - ty) < 0.45);
  // Standing groups: Suria KLCC front (off the podium, the fountain pool, the camera-side annex and the trees), the Merdeka
  // forecourt (off the plinth, the pavilion, the trees and the tributary), the Samad arcade lawn edge (off the walker loop),
  // the Batu steps' foot and the shophouse five-foot way (in front of the walker loop).
  const suria = (x: number, z: number) =>
    inRect(x, z, -7.5, -0.9, 2.15, 1.6, Math.PI / 4) || Math.hypot(x + 6.02, z - 0.59) < 0.6 ||
    Math.hypot(x + 8.6, z - 0.2) < 1.1 || Math.hypot(x + 6.4, z + 2.0) < 1.1 ||
    Math.hypot(x + 7.72, z - 1.08) < 0.55 || Math.hypot(x + 5.52, z + 1.12) < 0.55 || offTree(x, z);
  root.add(scatter({ x: -8.4, z: 0.9, w: 3.0, d: 0.7 }, 7, rand, pave, suria));
  const forecourt = (x: number, z: number) =>
    x < 2.05 || inRect(x, z, 3.9, -7.5, 1.55, 1.25, 0.4) || inRect(x, z, 3.7, -5.0, 0.8, 0.55) || Math.hypot(x - 7, z + 5.7) < 1.2 || offTree(x, z);
  root.add(scatter({ x: 2.1, z: -5.7, w: 4.2, d: 1.5 }, 8, rand, pave, forecourt));
  root.add(scatter({ x: -4.3, z: 6.65, w: 1.8, d: 0.7 }, 4, rand, pave, (x, z) => (z > 6.75 && x > -4.3) || offTree(x, z)));
  const batuFoot = (x: number, z: number) => inRect(x, z, 7, -5.7, 0.95, 0.75, Math.PI / 4) || (x > 8.3 && x < 9.6 && z < -3.7);
  root.add(scatter({ x: 7.0, z: -4.6, w: 1.4, d: 0.8 }, 4, rand, (x, z, i) => kl(x, z, i + 2, 0, i === 1), batuFoot));
  // In front of the terrace's five-foot way (slab at z 8.4), east of the glass tower at (3.6, 9.15), short of the walker loop.
  root.add(scatter({ x: 6.3, z: 8.57, w: 4.6, d: 0.14 }, 6, rand, pave, offTree));

  // Walkers on closed loops over paved ground, clear of the lanes.
  const walk = (loop: [number, number][], y: number, n: number, speed: number, seed: number, brolly = -1) => {
    for (let i = 0; i < n; i++) root.add(anim.follow(kl(0, 0, seed + i, y, i === brolly), loop, speed, i / n, true));
  };
  walk([[-9.2, 1.66], [-5.6, 1.66], [-5.6, 1.76], [-9.2, 1.76]], 0.04, 2, 0.26, 0);
  walk([[4.6, -5.35], [5.4, -5.35], [5.4, -4.1], [4.6, -4.1]], 0.045, 2, 0.22, 3, 1);
  walk([[-4.2, 6.85], [-2.6, 6.85], [-2.6, 7.2], [-4.2, 7.2]], 0.04, 1, 0.24, 6);
  walk([[8.1, -4.35], [9.2, -4.35], [9.2, -3.95], [8.1, -3.95]], 0, 1, 0.22, 7);
  walk([[4.5, 8.75], [8.3, 8.75], [8.3, 8.9], [4.5, 8.9]], 0.04, 2, 0.26, 8);

  // Traffic.
  const lanes: [number, number][][] = [
    [[-1.7, 9.0], [-1.7, 0.3]],
    [[-1.0, 0.3], [-1.0, 9.0]],
    // The west road ends at the Samad plot (x −4.6), so its lane does too instead of driving through the building.
    [[-9.0, 2.35], [-4.85, 2.35]],
  ];
  lanes.forEach((path, li) => {
    for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: 0.05, color: CAR_PALETTE[(li * 3 + i) % CAR_PALETTE.length] }), path, 1.1, i / 3 + li * 0.17));
  });
  // The east-road lanes end at x 3.0, so no car runs onto the front bridge deck (it ends at x 2.7) or under its ribs.
  root.add(anim.follow(car({ y: 0.05, color: CAR_PALETTE[3] }), [[9.0, 5.55], [3.0, 5.55]], 1.0, 0.1));
  root.add(anim.follow(car({ y: 0.05, color: CAR_PALETTE[4] }), [[3.0, 6.45], [9.0, 6.45]], 1.0, 0.6));

  return { root, update: anim.update };
}
