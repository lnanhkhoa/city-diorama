import * as THREE from 'three';
import {
  Animator, M, beam, bench, boat, box, building, car, cone, createBase, crosswalk, cylinder, floodMat, group, hipRoof, lamp, lampMaterial, lathe, mat, mergeStatic,
  patch, person, profile, rng, road, row, scatter, screen, sphere, tower, tree, waterMat, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';

const VERMILION = mat(0xd9442b, { roughness: 0.6 });
const TEMPLE_ROOF = mat(0x4b5057, { roughness: 0.7 });
// Towers are floodlit at night: Tokyo Tower in orange/warm white, Skytree in blue-white.
const TOWER_ORANGE = floodMat(0xea5a2c, 0xff7a2a, 1.1, { roughness: 0.5 });
const TOWER_WHITE = floodMat(0xf7f4ee, 0xffc890, 0.7, { roughness: 0.5 });
const SKY_WHITE = floodMat(0xffffff, 0x78c8ff, 0.85, { roughness: 0.45 });
/** Red chochin paper lanterns (Kaminarimon, Nakamise, hall): plain by day, lit at night. */
const LANTERN = floodMat(0xe0382a, 0xff4a22, 2.6, { roughness: 0.4 });
const AWNINGS = [0xc8433a, 0x2f6fb6, 0xe0b43a, 0x3f9a6a, 0x8a4fb0, 0xf08a3a];

/** Pre-merge a multi-mesh mover so it costs one draw call per material. */
function pm<T extends THREE.Object3D>(o: T): T {
  mergeStatic(o);
  return o;
}
const NEON = [0xff4f8b, 0x2fd0ff, 0xffd23f, 0x7cff6b, 0xff7a2f, 0xb56cff];
/** Office-crowd coats: charcoal, navy, black, white shirt, beige trench, plus muted pastels. */
const COATS = [0x2b2f38, 0x1f2f55, 0xf0eee8, 0x1a1a1e, 0xc8b08a, 0x6b7078, 0xb8a9c9, 0x9fb7cf, 0x232a3d, 0x9fb8a8, 0xe0b4b4];
/** Clear vinyl, black, navy and a pastel umbrella. */
const BROLLIES = [0xdfe9ef, 0x23262c, 0x1f2f55, 0xb8a9c9];
function tokyoite(x: number, z: number, i: number, ry?: number, wet = false) {
  const col = COATS[(i * 5 + 2) % COATS.length];
  return person({ x, y: 0.04, z, ry, color: col, umbrella: wet ? BROLLIES[i % BROLLIES.length] : undefined });
}
const WALLS = [0xe8e2dc, 0xcfd6dd, 0xd9c9c0, 0xb8c4cf, 0xe6d9d0, 0xdcdad2, 0xc3ccd6];
const ROAD = mat(0x464b53, { roughness: 0.95 });

type Mat = THREE.Material;

/** Lattice mast: `n` legs, rings at each level (radius `r`), X-bracing between rings. */
function lattice(g: THREE.Group, n: number, off: number, levels: { y: number; r: number }[], t: number, mats: Mat[]) {
  const pt = (r: number, y: number, i: number): [number, number, number] => {
    const a = off + (i * Math.PI * 2) / n;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  };
  for (let k = 0; k < levels.length - 1; k++) {
    const a = levels[k];
    const b = levels[k + 1];
    const m = mats[k % mats.length];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      g.add(beam(pt(a.r, a.y, i), pt(b.r, b.y, i), t * 1.5, m));
      g.add(beam(pt(a.r, a.y, i), pt(a.r, a.y, j), t, m));
      g.add(beam(pt(a.r, a.y, i), pt(b.r, b.y, j), t * 0.7, m));
      g.add(beam(pt(a.r, a.y, j), pt(b.r, b.y, i), t * 0.7, m));
    }
  }
  const top = levels[levels.length - 1];
  for (let i = 0; i < n; i++) g.add(beam(pt(top.r, top.y, i), pt(top.r, top.y, (i + 1) % n), t, mats[0]));
}

/** Skytree: triangular 3-leg lattice base morphing to a circular shaft, two observation decks, mast. */
function skytree(p: Place): THREE.Group {
  const g = group(p);
  // Base: three braced legs converging (triangle plan), ring frames at each level.
  lattice(g, 3, Math.PI / 2, [{ y: 0, r: 1.35 }, { y: 1.2, r: 1.02 }, { y: 2.4, r: 0.74 }, { y: 3.5, r: 0.5 }], 0.05, [SKY_WHITE]);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
    g.add(box(0.26, 0.1, 0.26, SKY_WHITE, { x: 1.35 * Math.cos(a), y: 0, z: 1.35 * Math.sin(a) }));
  }
  // Transition: hexagonal frame then round, braced shaft.
  lattice(g, 6, 0, [{ y: 3.5, r: 0.46 }, { y: 4.15, r: 0.42 }, { y: 4.8, r: 0.38 }, { y: 5.45, r: 0.35 }, { y: 6.1, r: 0.32 }, { y: 6.75, r: 0.3 }], 0.04, [SKY_WHITE]);
  g.add(cylinder(0.17, 0.3, 3.4, SKY_WHITE, { y: 3.5, segments: 14 }));
  g.add(cylinder(0.14, 0.17, 1.4, SKY_WHITE, { y: 6.9, segments: 14 }));
  // Tembo Deck (~55% height): struts, underside bowl, glazed ring, roof lip.
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    g.add(beam([0.2 * Math.cos(a), 6.0, 0.2 * Math.sin(a)], [0.58 * Math.cos(a), 6.95, 0.58 * Math.sin(a)], 0.04, SKY_WHITE));
  }
  g.add(cylinder(0.64, 0.3, 0.25, SKY_WHITE, { y: 6.9, segments: 24 }));
  g.add(cylinder(0.66, 0.66, 0.18, windowMaterial, { y: 7.15, segments: 24 }));
  g.add(cylinder(0.7, 0.66, 0.08, SKY_WHITE, { y: 7.33, segments: 24 }));
  g.add(cylinder(0.5, 0.7, 0.14, SKY_WHITE, { y: 7.41, segments: 24 }));
  g.add(cylinder(0.64, 0.64, 0.07, M.steel, { y: 7.55, segments: 24 }));
  g.add(cylinder(0.14, 0.2, 0.3, SKY_WHITE, { y: 7.6, segments: 14 }));
  g.add(cylinder(0.11, 0.14, 1.2, SKY_WHITE, { y: 7.9, segments: 12 }));
  // Tembo Galleria (~75%): smaller ring.
  g.add(cylinder(0.44, 0.2, 0.16, SKY_WHITE, { y: 9.0, segments: 20 }));
  g.add(cylinder(0.45, 0.45, 0.13, windowMaterial, { y: 9.16, segments: 20 }));
  g.add(cylinder(0.5, 0.45, 0.06, SKY_WHITE, { y: 9.29, segments: 20 }));
  g.add(cylinder(0.1, 0.12, 0.7, SKY_WHITE, { y: 9.35, segments: 10 }));
  // Gain tower and antenna mast.
  g.add(cylinder(0.065, 0.1, 1.2, SKY_WHITE, { y: 10.05, segments: 10 }));
  g.add(cylinder(0.012, 0.06, 1.7, mat(0xdfe6ea), { y: 11.2, segments: 8 }));
  g.add(sphere(0.03, lampMaterial, { y: 12.9, segments: 6 }));
  return g;
}

/** Tokyo Tower: tapering 4-leg lattice in orange/white bands, main deck at ~43%, top deck at ~75%, antenna. */
function tokyoTower(p: Place): THREE.Group {
  const g = group(p);
  const lv = [
    { y: 0, r: 1.55 }, { y: 1.0, r: 1.2 }, { y: 2.0, r: 0.93 }, { y: 3.0, r: 0.72 }, { y: 3.95, r: 0.56 },
  ];
  lattice(g, 4, Math.PI / 4, lv, 0.05, [TOWER_ORANGE, TOWER_WHITE]);
  lattice(g, 4, Math.PI / 4, [{ y: 4.35, r: 0.5 }, { y: 5.2, r: 0.38 }, { y: 6.1, r: 0.27 }, { y: 6.9, r: 0.18 }], 0.04, [TOWER_WHITE, TOWER_ORANGE]);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.26, 0.18, 0.26, TOWER_WHITE, { x: sx * 1.1 - 0.0, z: sz * 1.1 }));
  // Main deck: two tiers with a glazed band.
  g.add(box(1.45, 0.12, 1.45, TOWER_ORANGE, { y: 3.9 }));
  g.add(box(1.36, 0.18, 1.36, windowMaterial, { y: 4.02 }));
  g.add(box(1.5, 0.07, 1.5, TOWER_WHITE, { y: 4.2 }));
  g.add(box(0.8, 0.14, 0.8, TOWER_ORANGE, { y: 4.27 }));
  // Top deck.
  g.add(box(0.62, 0.1, 0.62, TOWER_ORANGE, { y: 6.82 }));
  g.add(box(0.54, 0.12, 0.54, windowMaterial, { y: 6.92 }));
  g.add(box(0.66, 0.06, 0.66, TOWER_WHITE, { y: 7.04 }));
  // Antenna mast, banded.
  g.add(cylinder(0.07, 0.11, 1.1, TOWER_ORANGE, { y: 7.1, segments: 8 }));
  g.add(cylinder(0.04, 0.07, 0.7, TOWER_WHITE, { y: 8.2, segments: 8 }));
  g.add(cylinder(0.012, 0.04, 0.6, TOWER_ORANGE, { y: 8.9, segments: 6 }));
  g.add(sphere(0.03, lampMaterial, { y: 9.5, segments: 6 }));
  return g;
}

/**
 * Mt Fuji: concave lathe profile (flared foot, steep summit) with a truncated crater, a forest skirt and a
 * snow cap whose lower rim is torn into teeth by moving the first profile ring vertex by vertex.
 */
function fuji(p: Place): THREE.Group {
  const g = group(p);
  const R = 2.3;
  const H = 4.5;
  const top = 0.3;
  const radiusAt = (y: number) => top + (R - top) * Math.pow(1 - y / H, 1.7);
  const rock: [number, number][] = [];
  for (let k = 0; k <= 12; k++) rock.push([radiusAt((H * k) / 12), (H * k) / 12]);
  rock.push([0.2, H - 0.14], [0.01, H - 0.14]);
  g.add(lathe(rock, mat(0x7189ad, { flat: true }), { segments: 24 }));
  g.add(lathe([0, 0.3, 0.6, 0.9].map((y): [number, number] => [radiusAt(y) + 0.02, y]), mat(0x54735a, { flat: true }), { segments: 24 }));
  const snow: [number, number][] = [[radiusAt(H * 0.5) + 0.03, H * 0.5]];
  for (const t of [0.72, 0.8, 0.88, 0.94, 1]) snow.push([radiusAt(H * t) + 0.03, H * t]);
  const cap = lathe(snow, mat(0xf6f9fc, { flat: true, roughness: 0.8 }), { segments: 24 });
  const pos = cap.geometry.attributes.position;
  const teeth = [0.4, 0.62, 0.48, 0.68, 0.44, 0.6, 0.52, 0.66];
  for (let i = 0; i <= 24; i++) {
    const idx = i * snow.length;
    const y = H * teeth[(i % 24) % teeth.length];
    const k = (radiusAt(y) + 0.03) / snow[0][0];
    pos.setXYZ(idx, pos.getX(idx) * k, y, pos.getZ(idx) * k);
  }
  cap.geometry.computeVertexNormals();
  g.add(cap);
  return g;
}

/** Five-tier pagoda: shrinking vermilion storeys, each with a flared upturned eave, sorin spire. */
function pagoda(p: Place): THREE.Group {
  const g = group(p);
  const stone = mat(0xd8cdb5);
  g.add(box(2.0, 0.1, 2.0, stone));
  g.add(box(1.5, 0.12, 1.5, stone, { y: 0.1 }));
  let y = 0.22;
  for (let i = 0; i < 5; i++) {
    const w = 0.95 - i * 0.1;
    const eave = (w + 0.62) / 2;
    g.add(box(w, 0.5, w, VERMILION, { y }));
    g.add(box(w * 0.36, 0.26, w + 0.02, M.dark, { y: y + 0.1 }));
    g.add(box(w + 0.02, 0.26, w * 0.36, M.dark, { y: y + 0.1 }));
    for (const s of [-1, 1]) for (const t of [-1, 1]) g.add(box(0.07, 0.5, 0.07, M.gold, { x: s * w / 2, y, z: t * w / 2 }));
    // Bracket block under the eave, then the thin flared rim that turns up at the corners.
    g.add(box(w + 0.2, 0.06, w + 0.2, M.dark, { y: y + 0.5 }));
    g.add(cylinder(eave * 1.25 * Math.SQRT2, eave * 1.0 * Math.SQRT2, 0.1, TEMPLE_ROOF, { y: y + 0.56, segments: 4, ry: Math.PI / 4 }));
    g.add(hipRoof(eave * 2 * 1.04, eave * 2 * 1.04, 0.3, TEMPLE_ROOF, { y: y + 0.66 }));
    y += 0.9;
  }
  // Sorin: mast with stacked rings, a water flame and a finial.
  g.add(cylinder(0.03, 0.05, 1.3, M.gold, { y: y - 0.2, segments: 6 }));
  for (let i = 0; i < 6; i++) g.add(cylinder(0.12 - i * 0.015, 0.12 - i * 0.015, 0.035, M.gold, { y: y + i * 0.14, segments: 8 }));
  g.add(cone(0.08, 0.2, M.gold, { y: y + 0.9, segments: 6 }));
  return g;
}

function mainHall(p: Place): THREE.Group {
  const g = group(p);
  g.add(box(3.1, 0.12, 1.7, mat(0xd8cdb5)));
  g.add(box(2.2, 0.8, 1.0, VERMILION, { y: 0.12 }));
  g.add(box(1.0, 0.5, 1.02, M.gold, { y: 0.2 }));
  // Front colonnade, lit side windows and hanging lanterns on the +z face.
  for (let i = 0; i < 6; i++) g.add(cylinder(0.045, 0.05, 0.8, VERMILION, { x: -1.0 + i * 0.4, y: 0.12, z: 0.58, segments: 6 }));
  for (const sx of [-1, 1]) {
    g.add(box(0.26, 0.4, 0.02, windowMaterial, { x: sx * 0.82, y: 0.3, z: 0.51 }));
    g.add(cylinder(0.07, 0.07, 0.16, LANTERN, { x: sx * 0.4, y: 0.5, z: 0.66, segments: 8 }));
  }
  g.add(hipRoof(3.2, 1.9, 0.4, TEMPLE_ROOF, { y: 0.92 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(beam([sx * 1.5, 0.93, sz * 0.9], [sx * 1.68, 1.04, sz * 1.02], 0.06, TEMPLE_ROOF));
  g.add(box(1.7, 0.35, 0.8, VERMILION, { y: 1.3 }));
  g.add(hipRoof(2.5, 1.3, 0.75, TEMPLE_ROOF, { y: 1.65 }));
  // Ridge (1.2 long on this hip roof) with gold end ornaments.
  g.add(box(1.2, 0.07, 0.1, M.dark, { y: 2.37 }));
  for (const sx of [-1, 1]) g.add(cone(0.07, 0.18, M.gold, { x: sx * 0.6, y: 2.4, segments: 5 }));
  return g;
}

function kaminarimon(p: Place): THREE.Group {
  const g = group(p);
  // Four round-ish pillars with stone footings, tie beams (nuki) between them.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.4, 0.1, 0.4, M.concrete, { x: sx * 1.0, z: sz * 0.4 }));
    g.add(cylinder(0.13, 0.15, 1.05, VERMILION, { x: sx * 1.0, y: 0.1, z: sz * 0.4, segments: 8 }));
  }
  for (const sz of [-1, 1]) g.add(box(2.4, 0.1, 0.1, VERMILION, { y: 0.75, z: sz * 0.4 }));
  g.add(box(0.1, 0.1, 0.9, VERMILION, { x: -1.0, y: 0.75 }));
  g.add(box(0.1, 0.1, 0.9, VERMILION, { x: 1.0, y: 0.75 }));
  // Upper tier set back, with bracket course and lower eaves.
  g.add(box(2.9, 0.16, 1.3, M.dark, { y: 1.15 }));
  g.add(box(2.5, 0.5, 1.0, VERMILION, { y: 1.31 }));
  for (let i = 0; i < 5; i++) g.add(box(0.1, 0.34, 1.04, M.dark, { x: -1.0 + i * 0.5, y: 1.39 }));
  g.add(hipRoof(3.5, 1.9, 0.12, TEMPLE_ROOF, { y: 1.81 }));
  // Hip-and-gable roof, ridge along X; the corner kicks turn the eaves up.
  g.add(hipRoof(3.3, 1.7, 0.7, TEMPLE_ROOF, { y: 1.93 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(beam([sx * 1.68, 1.82, sz * 0.9], [sx * 1.85, 1.97, sz * 1.03], 0.07, TEMPLE_ROOF));
    g.add(beam([sx * 1.58, 1.94, sz * 0.8], [sx * 1.74, 2.1, sz * 0.93], 0.07, TEMPLE_ROOF));
  }
  // The ridge of the hip roof is 1.6 long; gold ornaments cap its ends.
  g.add(box(1.5, 0.07, 0.12, M.dark, { y: 2.6 }));
  for (const sx of [-1, 1]) g.add(cone(0.08, 0.22, M.gold, { x: sx * 0.78, y: 2.6, segments: 5 }));
  // The giant red lantern (chochin) hanging in the passage: bulging body, black rings, caps and a kanji plate on both faces.
  g.add(cylinder(0.07, 0.07, 0.05, M.dark, { y: 1.1, segments: 6 }));
  g.add(cylinder(0.2, 0.28, 0.08, M.dark, { y: 1.02, segments: 14 }));
  g.add(lathe([[0.26, 0], [0.37, 0.12], [0.4, 0.32], [0.37, 0.52], [0.26, 0.7]], LANTERN, { y: 0.32, segments: 16 }));
  g.add(cylinder(0.26, 0.2, 0.06, M.dark, { y: 0.28, segments: 14 }));
  for (const y of [0.5, 0.64, 0.78]) g.add(cylinder(0.405, 0.405, 0.02, M.dark, { y, segments: 16 }));
  for (const sz of [-1, 1]) g.add(box(0.2, 0.42, 0.03, M.dark, { y: 0.46, z: sz * 0.41 }));
  // Fujin and Raijin in their niches: dark backing panels with green and red figures.
  const skin = mat(0xd9a05b);
  for (const [sx, col] of [[-1, 0x3d8f5a], [1, 0xc8452a]] as const) {
    g.add(box(0.42, 0.85, 0.06, M.dark, { x: sx * 0.62, y: 0.1, z: -0.05 }));
    g.add(box(0.26, 0.4, 0.2, mat(col), { x: sx * 0.62, y: 0.12, z: 0.1 }));
    g.add(sphere(0.07, skin, { x: sx * 0.62, y: 0.5, z: 0.1, segments: 6 }));
  }
  return g;
}

function stall(x: number, z: number, i: number): THREE.Group {
  const g = group({ x, z });
  g.add(box(0.5, 0.36, 0.4, M.stone));
  g.add(box(0.56, 0.05, 0.46, i % 2 ? VERMILION : M.white, { y: 0.36 }));
  g.add(hipRoof(0.6, 0.5, 0.12, i % 2 ? M.white : VERMILION, { y: 0.41 }));
  return g;
}

/** Shinkansen: duckbill nose at local origin (+z), trailing cars toward -z. Pre-merged. */
function shinkansen(): THREE.Group {
  const g = group({ y: 1.24 });
  const white = mat(0xf3f5f7, { roughness: 0.35 });
  const blue = mat(0x2a63b8, { roughness: 0.4 });
  // Wide rear of the nose, then a narrower pointed bill with a drooping duckbill profile.
  g.add(profile([[0.12, 0.06], [0.12, 0.3], [0.45, 0.32], [0.45, 0.06]], 0.3, white, { ry: Math.PI / 2 }));
  g.add(profile([[0.0, 0.1], [0.04, 0.17], [0.22, 0.28], [0.34, 0.31], [0.34, 0.06], [0.12, 0.06]], 0.17, white, { ry: Math.PI / 2 }));
  g.add(box(0.31, 0.035, 0.28, blue, { y: 0.1, z: -0.3 }));
  g.add(box(0.08, 0.05, 0.1, windowMaterial, { y: 0.24, z: -0.2 }));
  for (let k = 0; k < 4; k++) {
    const c = group({ z: -0.45 - 0.26 - k * 0.52 });
    c.add(box(0.3, 0.26, 0.5, white, { y: 0.06 }));
    c.add(box(0.31, 0.04, 0.5, blue, { y: 0.1 }));
    c.add(box(0.31, 0.05, 0.4, windowMaterial, { y: 0.2 }));
    g.add(c);
  }
  mergeStatic(g);
  return g;
}

function midrise(x: number, z: number, w: number, d: number, h: number, i: number, rand: () => number): THREE.Group {
  const g = group({ x, z });
  const wall = mat(WALLS[i % WALLS.length]);
  const trim = mat(WALLS[(i + 3) % WALLS.length]);
  g.add(building({ w, d, h, wall, trim, roof: 'flat', windows: 'grid', floorH: 0.5, shop: AWNINGS[i % AWNINGS.length] }));
  // Roof variety: setback volume, water tank, or billboard frame.
  if (i % 3 === 1 && w > 1.5) g.add(building({ w: w * 0.6, d: d * 0.6, h: 0.7, y: h, wall, roof: 'flat', windows: 'grid', floorH: 0.35, plain: true }));
  if (i % 4 === 2) {
    for (const s of [-1, 1]) g.add(box(0.04, 0.22, 0.04, M.dark, { x: w * 0.2 + s * 0.12, y: h + 0.1, z: -d * 0.2 }));
    g.add(cylinder(0.18, 0.18, 0.3, M.wood, { x: w * 0.2, y: h + 0.32, z: -d * 0.2, segments: 8 }));
    g.add(cone(0.2, 0.14, M.dark, { x: w * 0.2, y: h + 0.62, z: -d * 0.2, segments: 8 }));
  }
  // Larger flat signs on the street and side faces.
  const c = NEON[Math.floor(rand() * NEON.length)];
  const sw = 0.45 + rand() * 0.35;
  const sh = 0.5 + rand() * Math.min(0.9, h * 0.3);
  const sy = 0.9 + rand() * Math.max(0.05, h - sh - 1.1);
  g.add(screen(sw, sh, c, { x: (rand() - 0.5) * Math.max(0, w - sw - 0.5), y: sy, z: d / 2 + 0.03 }));
  g.add(screen(sw, sh, NEON[Math.floor(rand() * NEON.length)], { x: w / 2 + 0.03, y: 0.9 + rand() * Math.max(0.05, h - sh - 1.1), z: (rand() - 0.5) * Math.max(0, d - sw - 0.2), ry: Math.PI / 2 }));
  // Tategaki: tall vertical blade sign projecting from the corner, banded like stacked kanji.
  const th = Math.min(h * 0.7, 1.1 + rand() * 0.9);
  const tx = (rand() > 0.5 ? 1 : -1) * (w / 2 - 0.14);
  const tc = NEON[Math.floor(rand() * NEON.length)];
  const ty = Math.max(0.6, h * 0.3);
  g.add(box(0.24, th, 0.16, mat(0xf4f0e8), { x: tx, y: ty, z: d / 2 + 0.11 }));
  const bands = Math.max(2, Math.floor(th / 0.28));
  for (let b = 0; b < bands; b++) g.add(box(0.18, 0.15, 0.02, b % 2 ? M.dark : mat(tc, { emissive: tc, emissiveIntensity: 0.4 }), { x: tx, y: ty + 0.06 + b * (th - 0.2) / bands, z: d / 2 + 0.2 }));
  // Rooftop billboard on a frame.
  if (i % 2 === 0 && w > 1.2) {
    const bc = NEON[(i * 5) % NEON.length];
    for (const s of [-1, 1]) g.add(box(0.05, 0.34, 0.05, M.dark, { x: s * w * 0.3, y: h + 0.03, z: d / 2 - 0.2 }));
    g.add(screen(w * 0.85, 0.6, bc, { y: h + 0.34, z: d / 2 - 0.2 }));
  }
  return g;
}

export default function build(): CityScene {
  const rand = rng(2024);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: mat(0x5d636b, { roughness: 0.95 }), side: mat(0x45484f) }));

  // Ground zones.
  const pav = M.pavement;
  root.add(patch(19.6, 3.55, pav, { z: -1.475 }));
  root.add(patch(11.6, 4.1, pav, { x: -3.9, z: 2.35 }));
  root.add(patch(5.6, 4.1, pav, { x: 6.9, z: 2.35 }));
  root.add(patch(11.6, 3.1, pav, { x: -3.9, z: 8.15 }));
  root.add(patch(5.6, 3.1, M.grass, { x: 6.9, z: 8.15 }));
  root.add(patch(11.6, 4.45, pav, { x: -3.9, z: -7.2 }));
  root.add(patch(5.6, 4.45, mat(0xd8cdb5), { x: 6.9, z: -7.2 }));
  root.add(patch(4.0, 1.3, mat(0xc9a98a), { x: 6.7, z: -6.9, h: 0.05 }));
  root.add(patch(5.0, 0.9, M.grass, { x: -6.5, z: -2.75, h: 0.05 }));
  root.add(patch(5.0, 0.9, M.grass, { x: 6.9, z: -2.75, h: 0.05 }));
  // Kerb strips close the 0.2 gap between the corner pavements and the cross street, so people waiting there stand on paving.
  for (const z of [4.5, 6.5]) {
    root.add(patch(11.6, 0.2, pav, { x: -3.9, z }));
    root.add(patch(5.6, 0.2, pav, { x: 6.9, z }));
  }

  // Sumida river: its surface sits low (0.02) so the road crosses it on a thin deck with open water underneath.
  root.add(patch(19.6, 1.5, waterMat(0x4fa3d1), { z: -4.0, h: 0.02 }));
  // Kerbs stop short of the road so they do not cross the bridge carriageway.
  for (const z of [-4.81, -3.19]) {
    root.add(patch(11.9, 0.12, M.concrete, { x: -3.85, z, h: 0.08 }));
    root.add(patch(5.9, 0.12, M.concrete, { x: 6.85, z, h: 0.08 }));
  }

  // Streets: Shibuya crossing at (3, 5.5).
  root.add(road(3, 9.8, 3, -2.95, 1.8, { material: ROAD }));
  root.add(road(3, -5.05, 3, -9.8, 1.8, { material: ROAD }));
  // The bridge deck: flush with the road (top 0.05), its soffit clear of the water.
  root.add(box(1.8, 0.018, 2.1, ROAD, { x: 3, y: 0.032, z: -4.0 }));
  root.add(road(-9.8, 5.5, 9.8, 5.5, 1.8, { material: ROAD, lines: false }));
  root.add(patch(1.8, 1.8, ROAD, { x: 3, z: 5.5, h: 0.055 }));
  for (const sx of [2.15, 3.85]) root.add(box(0.05, 0.14, 1.5, M.white, { x: sx, y: 0.05, z: -4.0 }));
  const zebra = (x: number, z: number, alongZ: boolean) => {
    for (let i = 0; i < 8; i++) {
      const o = -0.77 + i * 0.22;
      root.add(alongZ ? box(0.1, 0.012, 0.4, M.roadLine, { x: x + o, y: 0.05, z }) : box(0.4, 0.012, 0.1, M.roadLine, { x, y: 0.05, z: z + o }));
    }
  };
  zebra(3, 4.2, true);
  zebra(3, 6.8, true);
  zebra(4.3, 5.5, false);
  zebra(1.7, 5.5, false);
  for (const s of [-1, 1]) {
    for (let i = -4; i <= 4; i++) root.add(box(0.1, 0.012, 0.18, M.roadLine, { x: 3 + i * 0.2, y: 0.058, z: 5.5 + s * i * 0.2, ry: s * Math.PI / 4 }));
  }
  // Pedestrians keep to the corner pavements; the carriageway is left to the traffic.
  const crossFacing = (x: number, z: number) => Math.atan2(3 - x, 5.5 - z);
  for (const [x, z] of [
    [4.4, 4.5], [4.6, 4.5], [4.85, 4.5], [5.4, 4.5], [1.78, 4.5], [0.95, 4.5], [0.72, 4.5],
    [4.35, 6.5], [4.95, 6.5], [5.45, 6.5], [1.78, 6.5], [0.3, 6.5],
  ]) root.add(tokyoite(x, z, crossFacing(x, z)));
  // Further crossings on the avenue and the cross street.
  root.add(crosswalk(3, 0.9, 1.8));
  root.add(crosswalk(3, 8.6, 1.8));
  root.add(crosswalk(-4.2, 5.5, 1.8, { ry: Math.PI / 2 }));
  root.add(crosswalk(8.2, 5.5, 1.8, { ry: Math.PI / 2 }));

  // Shibuya screens: corner building facing the crossing.
  root.add(midrise(1.0, 3.4, 1.8, 2.0, 3.4, 0, rand));
  root.add(screen(1.3, 0.8, 0xff4f8b, { x: 0.9, y: 2.2, z: 4.43 }));
  root.add(screen(0.9, 1.2, 0x2fd0ff, { x: 1.95, y: 1.4, z: 3.4, ry: Math.PI / 2 }));
  root.add(screen(0.9, 0.7, 0xffd23f, { x: 1.95, y: 2.5, z: 3.0, ry: Math.PI / 2 }));
  root.add(screen(1.2, 0.5, 0x7cff6b, { x: 0.8, y: 1.0, z: 4.43 }));
  // 109-style round tower opposite.
  root.add(tower({ x: 5.2, z: 3.2, w: 1.8, d: 1.8, sections: [3.6], round: true, wall: mat(0xe9d9d2) }));
  root.add(screen(1.2, 0.7, 0xff7a2f, { x: 5.2, y: 2.4, z: 4.15 }));
  root.add(screen(1.2, 0.4, 0xb56cff, { x: 5.2, y: 1.0, z: 4.15 }));

  // Dense blocks (left of crossing, right of crossing, front).
  const blocks: [number, number, number, number, number][] = [
    [-5.2, 2.0, 2.0, 2.4, 2.6], [-3.0, 2.4, 1.8, 3.0, 3.5], [-0.9, 2.2, 1.6, 2.6, 2.2], [-8.4, 3.8, 2.4, 1.1, 1.8],
    [7.3, 3.2, 2.0, 2.2, 2.9], [9.0, 2.6, 1.2, 3.2, 2.2], [5.4, 0.9, 1.6, 1.2, 2.0], [7.4, 1.0, 2.0, 1.2, 1.8],
    [-8.6, 8.1, 2.0, 2.4, 1.8], [-6.4, 8.3, 2.0, 2.0, 1.5], [-4.2, 8.1, 2.0, 2.4, 2.1], [-2.0, 8.3, 2.0, 2.0, 1.4], [0.4, 8.1, 2.0, 2.4, 1.9],
    [-1.4, -6.2, 1.8, 1.6, 2.8], [0.8, -5.9, 1.4, 1.2, 2.1], [-1.0, -9.0, 2.0, 1.2, 2.4],
  ];
  blocks.forEach(([x, z, w, d, h], i) => root.add(midrise(x, z, w, d, h, i + 1, rand)));
  // Asahi-style golden hall.
  root.add(building({ x: 0.7, z: -8.0, w: 2.0, d: 2.2, h: 2.6, wall: mat(0xd6a53a, { roughness: 0.4, metalness: 0.3 }), roof: 'flat', windows: 'bands' }));
  root.add(box(0.5, 0.35, 0.5, M.white, { x: 0.7, y: 2.6, z: -8.0 }));

  // Landmarks.
  root.add(skytree({ x: -3.2, z: -7.6 }));
  root.add(tokyoTower({ x: -8.0, z: 1.8 }));
  root.add(fuji({ x: -7.4, z: -7.4 }));

  // Senso-ji: the Nakamise lane runs along X from the gate (left) past two rows of stalls to the hall (right).
  const gateK = kaminarimon({ x: 4.95, z: -6.9, ry: Math.PI / 2 });
  gateK.scale.setScalar(0.85);
  root.add(gateK);
  root.add(mainHall({ x: 8.95, z: -6.9, ry: Math.PI / 2 }));
  const pag = pagoda({ x: 7.0, z: -8.95 });
  pag.scale.setScalar(0.8);
  root.add(pag);
  root.add(box(0.8, 0.5, 0.7, VERMILION, { x: 4.9, z: -9.0 }));
  root.add(hipRoof(1.1, 1.0, 0.4, TEMPLE_ROOF, { x: 4.9, y: 0.5, z: -9.0 }));
  for (let i = 0; i < 3; i++) {
    const sx = 6.35 + i * 0.7;
    root.add(stall(sx, -6.0, i));
    root.add(stall(sx, -7.8, i + 1));
    // Lantern string across the lane between the stall roofs.
    root.add(beam([sx, 0.55, -6.0], [sx, 0.55, -7.8], 0.01, M.dark));
    for (const lz of [-6.5, -6.9, -7.3]) root.add(cylinder(0.04, 0.04, 0.09, LANTERN, { x: sx, y: 0.43, z: lz, segments: 6 }));
  }
  // Incense burner (jokoro) in the middle of the lane.
  root.add(cylinder(0.16, 0.2, 0.22, M.stone, { x: 7.4, z: -6.9, segments: 8 }));
  root.add(cylinder(0.07, 0.07, 0.12, M.dark, { x: 7.4, y: 0.22, z: -6.9, segments: 6 }));
  root.add(hipRoof(0.4, 0.4, 0.16, TEMPLE_ROOF, { x: 7.4, y: 0.34, z: -6.9 }));
  root.add(scatter({ x: 6.9, z: -6.9, w: 2.8, d: 0.7 }, 8, rand, (x, z, i) => tokyoite(x, z, i), (x, z) => Math.hypot(x - 7.4, z + 6.9) < 0.34));
  // Pilgrims walking the lane, salarymen on the river-side pavement and a few strollers along the park edge.
  for (let i = 0; i < 4; i++) root.add(anim.follow(tokyoite(0, 0, i, undefined, i === 2), [[6.0, -6.6], [8.0, -6.6], [8.0, -7.2], [6.0, -7.2]], 0.3, i / 4, true));
  for (let i = 0; i < 3; i++) root.add(anim.follow(tokyoite(0, 0, i + 4, undefined, i === 1), [[4.8, 6.68], [9.3, 6.68], [9.3, 6.9], [4.8, 6.9]], 0.35, i / 3, true));
  for (let i = 0; i < 3; i++) root.add(anim.follow(tokyoite(0, 0, i + 1), [[-6.0, -0.45], [1.3, -0.45], [1.3, 0.35], [-6.0, 0.35]], 0.38, i / 3, true));
  for (let i = 0; i < 2; i++) root.add(anim.follow(tokyoite(0, 0, i + 6, undefined, i === 0), [[4.6, -0.5], [9.3, -0.5], [9.3, 0.1], [4.6, 0.1]], 0.36, i / 2, true));

  // Cherry blossoms.
  root.add(row(-9.2, -2.8, -4.0, -2.8, 6, (x, z) => tree({ x, z, s: 0.8, kind: 'blossom' })));
  root.add(row(5.2, -2.8, 9.2, -2.8, 4, (x, z) => tree({ x, z, s: 0.8, kind: 'blossom' })));
  const parkTrees: [number, number][] = [];
  root.add(scatter({ x: 6.9, z: 8.15, w: 4.6, d: 2.2 }, 8, rand, (x, z) => {
    parkTrees.push([x, z]);
    return tree({ x, z, s: 0.9, kind: 'blossom' });
  }));
  root.add(row(4.8, 9.4, 9.4, 9.4, 4, (x, z) => bench({ x, z, ry: Math.PI })));
  // Park visitors stay clear of trunks and the bench row.
  root.add(scatter({ x: 6.9, z: 8.15, w: 4.6, d: 2.2 }, 8, rand, (x, z, i) => tokyoite(x, z, i), (x, z) => z > 9.1 || parkTrees.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.32)));
  root.add(row(-9.4, 6.65, 1.4, 6.65, 6, (x, z) => tree({ x, z, s: 0.55, kind: 'blossom' })));

  // Elevated Shinkansen line.
  const deckZ = -1.5;
  root.add(box(19.6, 0.14, 1.3, M.concrete, { y: 1.1, z: deckZ }));
  for (const s of [-1, 1]) root.add(box(13.8, 0.1, 0.06, M.dark, { y: 1.24, z: deckZ + s * 0.62 }));
  for (const z of [-1.7, -1.3]) root.add(box(19.6, 0.02, 0.05, M.steel, { y: 1.24, z }));
  for (let x = -9.5; x <= 9.5; x += 2) {
    if (Math.abs(x - 3) < 1.3) continue;
    root.add(box(0.28, 1.1, 0.5, M.concrete, { x, z: deckZ }));
  }
  for (let x = -8.5; x <= 9; x += 3) {
    root.add(cylinder(0.02, 0.02, 0.5, M.steel, { x, y: 1.24, z: deckZ - 0.58, segments: 5 }));
  }
  for (const sx of [-1, 1]) {
    root.add(box(2.9, 0.7, 1.3, mat(0xb9bcbf), { x: sx * 8.35, y: 1.24, z: deckZ }));
    root.add(box(2.92, 0.08, 1.32, M.dark, { x: sx * 8.35, y: 1.94, z: deckZ }));
    root.add(box(0.03, 0.5, 1.0, M.dark, { x: sx * 6.88, y: 1.24, z: deckZ }));
  }
  const train1 = shinkansen();
  const train2 = shinkansen();
  root.add(anim.follow(train1, [[-7.2, -1.7], [9.7, -1.7]], 2.2, 0));
  root.add(anim.follow(train2, [[7.2, -1.3], [-9.7, -1.3]], 2.2, 0.5));

  // Streets: lamps, traffic.
  root.add(row(-9.5, 4.55, 1.5, 4.55, 6, (x, z) => lamp({ x, z })));
  root.add(row(4.6, 6.45, 9.5, 6.45, 3, (x, z) => lamp({ x, z })));
  const lanes: [number, number][][] = [
    [[-9.6, 5.15], [9.6, 5.15]], [[9.6, 5.85], [-9.6, 5.85]],
  ];
  lanes.forEach((path, li) => {
    for (let i = 0; i < 3; i++) root.add(anim.follow(pm(car({ y: 0.05, taxi: (i + li) % 2 === 0 })), path, 1.3, i / 3 + li * 0.17));
  });
  for (let i = 0; i < 4; i++) root.add(anim.follow(pm(car({ y: 0.05, taxi: i % 2 === 1 })), [[2.65, 9.6], [2.65, -9.6]], 1.2, i / 4));
  for (let i = 0; i < 4; i++) root.add(anim.follow(pm(car({ y: 0.05 })), [[3.35, -9.6], [3.35, 9.6]], 1.2, i / 4 + 0.12));

  // River boats.
  // Boats turn back short of the low road bridge.
  root.add(anim.bob(anim.follow(pm(boat({ y: 0.01, color: 0xe8d27a, len: 0.9 })), [[-9.0, -4.2], [1.5, -4.2]], 0.5, 0.1), 0.012, 1.4));
  root.add(anim.bob(anim.follow(pm(boat({ y: 0.01, color: 0xf4f4f0, len: 0.7 })), [[9.0, -3.8], [4.4, -3.8]], 0.6, 0.6), 0.012, 1.4));

  return { root, update: anim.update };
}
