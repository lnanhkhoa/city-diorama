import * as THREE from 'three';
import {
  Animator, M, area, boat, box, building, car, cone, createBase, crosswalk, cylinder, dome, floodMat, gableRoof, group, hipRoof, lamp, lampMaterial, mat,
  mergeStatic, patch, person, profile, prism, rng, road, row, scatter, shape, tree, tube, waterMat, windowMaterial, type Place,
} from '../../kit';
import treviSculptures from '../shapes/trevi-sculptures.shape';
import type { CityScene } from '../types';

const TRAV = mat(0xd3c09c);
const TRAV_D = mat(0xbfa982);
const TRAV_L = mat(0xe3d6bb);
const COLUMN = mat(0xe8dfcc);
const DARK = mat(0x3d332b);
const ROOF = mat(0xb85a39);
const ROOF2 = mat(0xc76b44);
const GREY_DOME = mat(0xa5a8aa, { roughness: 0.6 });
const PAVE = mat(0xa6a8ac);
const PLAZA = mat(0xc4c0b6);
const WATER = waterMat(0x58aecf);
const TURQ = waterMat(0x5ec8c6);
const LEAD = mat(0x7d858e, { roughness: 0.55 });
// Floodlit at night: warm uplight on the landmark stone, glowing arcade arches, lit statues.
const ARCH_LIT = floodMat(0x3d332b, 0xff9340, 1.0);
const STONE_LIT = floodMat(0xdccfb4, 0xffc888, 0.3);
const DOME_LIT = floodMat(0xc9ccd0, 0xffcf94, 0.4, { roughness: 0.55 });
const ARM_LIT = floodMat(0xd3c09c, 0xffb870, 0.3);
const TREVI_LIT = floodMat(0xe3d6bb, 0xffd9a0, 0.45);
const TREVI_ROCK_LIT = floodMat(0xa8957a, 0xffb070, 0.4);
const STATUE_LIT = floodMat(0xf1ede4, 0xffe2b0, 0.6);
const OVAL = mat(0xb3ad9e);
const AWNINGS = [0xc8433a, 0x2f6b4a, 0xf0e6d2, 0x3d6fb6, 0xe0b43a];
const WALLS = [mat(0xd9885a), mat(0xe2a06a), mat(0xe0b074), mat(0xd1784f), mat(0xe8bd8a), mat(0xcf8f64)];
const UMBRELLAS = [0xc8433a, 0x2f343b, 0x3d6fb6, 0xe0b43a, 0xf4f4f0];

const TAU = Math.PI * 2;

function ellipse(a: number, b: number, n = 40): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    pts.push([Math.cos(t) * a, Math.sin(t) * b]);
  }
  return pts;
}

/** Arch-topped opening starting at y0 with vertical sides and a semicircular head. */
function archAt(cx: number, y0: number, w: number, hgt: number, seg = 8): [number, number][] {
  const r = w / 2;
  const spring = y0 + hgt - r;
  const pts: [number, number][] = [[cx - r, y0]];
  for (let i = 0; i <= seg; i++) {
    const a = Math.PI - (i / seg) * Math.PI;
    pts.push([cx + Math.cos(a) * r, spring + Math.sin(a) * r]);
  }
  pts.push([cx + r, y0]);
  return pts;
}

/** Flat-bottomed elliptical (segmental) opening for bridge spans. */
function spanAt(cx: number, y0: number, w: number, rise: number, seg = 12): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const u = -1 + (2 * i) / seg;
    pts.push([cx + (u * w) / 2, y0 + rise * Math.sqrt(Math.max(0, 1 - u * u))]);
  }
  return pts;
}

function pine(x: number, z: number, s = 1): THREE.Group {
  const g = group({ x, z });
  g.add(cylinder(0.03 * s, 0.05 * s, 0.85 * s, M.trunk, { segments: 5 }));
  // Flat, layered, wide umbrella canopy.
  g.add(cylinder(0.34 * s, 0.24 * s, 0.1 * s, M.leafDark, { y: 0.7 * s, segments: 9 }));
  g.add(cylinder(0.3 * s, 0.34 * s, 0.1 * s, M.leaf, { y: 0.8 * s, segments: 9 }));
  g.add(dome(0.22 * s, M.leaf, { y: 0.9 * s, squash: 0.5, segments: 8 }));
  return g;
}

// ---------------------------------------------------------------------------
// Colosseum
// ---------------------------------------------------------------------------

function colosseum(p: Place): THREE.Group {
  const g = group(p);
  const a = 2.75;
  const b = 2.1;
  const N = 32;
  const T = 0.4;
  const tierH = 0.78;
  const near = Math.PI / 4;
  const P = (i: number): [number, number] => {
    const t = (i / N) * TAU;
    return [Math.cos(t) * a, Math.sin(t) * b];
  };

  for (let i = 0; i < N; i++) {
    const [x1, z1] = P(i);
    const [x2, z2] = P(i + 1);
    const tx = x2 - x1;
    const tz = z2 - z1;
    const c = Math.hypot(tx, tz);
    const mid = ((i + 0.5) / N) * TAU;
    let d = Math.abs(mid - near);
    if (d > Math.PI) d = TAU - d;
    const tiers = d < 0.45 ? 1 : d < 0.95 ? 2 : 3;
    const topH = tiers === 3 ? 3 * tierH + 0.4 : tiers * tierH - (tiers === 1 ? 0.12 * ((i * 7) % 3) : 0);
    const w = c + 0.02;
    const holes: [number, number][][] = [];
    for (let t = 0; t < tiers; t++) holes.push(archAt(0, 0.1 + t * tierH, c * 0.52, 0.58, 7));
    const slab = group({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, ry: Math.atan2(-tz, tx) });
    slab.add(profile([[-w / 2, 0], [w / 2, 0], [w / 2, topH], [-w / 2, topH]], T, i % 2 ? TRAV : mat(0xd8c5a2), { holes }));
    slab.add(box(w - 0.04, tiers * tierH, 0.07, ARCH_LIT, { z: 0.12 }));
    for (let t = 0; t < Math.min(tiers, 3); t++) {
      if (t === tiers - 1 && tiers < 3) continue;
      slab.add(box(w + 0.02, 0.06, T + 0.07, TRAV_L, { y: (t + 1) * tierH - 0.04 }));
    }
    if (tiers === 3) {
      slab.add(box(w + 0.02, 0.06, T + 0.1, TRAV_L, { y: topH - 0.04 }));
      slab.add(box(0.1, 0.16, 0.05, DARK, { y: 3 * tierH + 0.1, z: -T / 2 - 0.005 }));
    }
    g.add(slab);
  }

  // Cavea: eight seating rings rising outward (alternating shades read as tiers of seats).
  const k = 0.745;
  for (let i = 0; i < 8; i++) {
    const ao = 2.55 - i * 0.18;
    const ai = ao - 0.2;
    const h = 1.5 - i * 0.12;
    g.add(prism(ellipse(ao, ao * k, 44), h, i % 2 ? TRAV : TRAV_D, { holes: [ellipse(ai, ai * k, 44)] }));
  }
  // Podium wall and sand arena with the hypogeum trenches.
  g.add(prism(ellipse(1.12, 1.12 * k, 40), 0.26, TRAV_L, { holes: [ellipse(1.04, 1.04 * k, 40)] }));
  g.add(area(ellipse(1.06, 1.06 * k, 36), M.sand, { h: 0.1 }));
  for (let i = -2; i <= 2; i++) {
    g.add(box(1.4 - Math.abs(i) * 0.22, 0.03, 0.07, DARK, { z: i * 0.2, y: 0.1 }));
    g.add(box(1.4 - Math.abs(i) * 0.22, 0.12, 0.03, TRAV_D, { z: i * 0.2 + 0.05, y: 0.1 }));
  }
  g.add(box(0.05, 0.14, 1.2, TRAV_D, { y: 0.1 }));
  // Fallen blocks where the outer wall breaks away.
  for (const [x, z, s] of [[1.9, 2.0, 0.22], [2.3, 1.7, 0.16], [1.6, 2.35, 0.14], [2.45, 1.15, 0.14]] as const) {
    g.add(box(s, s * 0.8, s * 1.2, TRAV_D, { x, z, ry: x * 2 }));
  }
  return g;
}

// ---------------------------------------------------------------------------
// Pantheon
// ---------------------------------------------------------------------------

function pantheon(p: Place): THREE.Group {
  const g = group(p);
  const wall = mat(0xcbb08a);
  const wallHi = mat(0xd4ba94);
  const R = 1.7;
  // Rotunda: plinth, drum, two cornices, lighter attic.
  g.add(cylinder(R + 0.08, R + 0.1, 0.12, TRAV_D, { segments: 40 }));
  g.add(cylinder(R, R + 0.02, 1.5, wall, { y: 0.12, segments: 40 }));
  g.add(cylinder(R + 0.05, R + 0.05, 0.07, TRAV_L, { y: 0.95, segments: 40 }));
  g.add(cylinder(R + 0.08, R + 0.08, 0.09, TRAV_L, { y: 1.62, segments: 40 }));
  g.add(cylinder(R - 0.04, R - 0.04, 0.4, wallHi, { y: 1.71, segments: 40 }));
  g.add(cylinder(R + 0.03, R + 0.03, 0.07, TRAV_L, { y: 2.11, segments: 40 }));
  // Blind arches around the drum, skipping the portico side.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU + 0.26;
    if (Math.cos(a) > 0.72) continue;
    g.add(box(0.26, 0.62, 0.06, DARK, { x: Math.cos(a) * (R + 0.03), z: Math.sin(a) * (R + 0.03), y: 0.3, ry: -a + Math.PI / 2 }));
    g.add(box(0.2, 0.28, 0.05, DARK, { x: Math.cos(a) * (R + 0.02), z: Math.sin(a) * (R + 0.02), y: 1.15, ry: -a + Math.PI / 2 }));
  }
  // Stepped rings stacked at the dome base, then the shallow dome.
  const steps = [1.62, 1.5, 1.38, 1.26, 1.14, 1.04];
  const ringLight = mat(0xd6d2c8, { roughness: 0.7 });
  const ringDark = mat(0x8a8f96, { roughness: 0.6 });
  steps.forEach((r, i) => g.add(cylinder(r, r + 0.05, 0.12, i % 2 ? ringDark : ringLight, { y: 2.18 + i * 0.12, segments: 40 })));
  const top = 2.18 + steps.length * 0.12;
  g.add(dome(1.05, GREY_DOME, { y: top, squash: 0.42, segments: 32 }));
  // Oculus: raised rim with a dark opening.
  g.add(cylinder(0.3, 0.34, 0.07, TRAV_L, { y: top + 0.38, segments: 18 }));
  g.add(cylinder(0.22, 0.22, 0.09, DARK, { y: top + 0.4, segments: 18 }));

  // Portico facing +x: a taller block links rotunda to an 8-column porch.
  const por = group({ ry: Math.PI / 2 });
  por.add(box(2.7, 0.14, 2.6, TRAV_D, { z: 2.45 }));
  por.add(box(2.5, 1.95, 1.3, wall, { y: 0.14, z: 1.95 }));
  por.add(box(2.58, 0.08, 1.38, TRAV_L, { y: 2.0, z: 1.95 }));
  por.add(profile([[-1.3, 0], [1.3, 0], [0, 0.58]], 1.4, LEAD, { y: 2.08, z: 1.95 }));
  // Entablature carried by the columns, with a pediment gable above.
  const colH = 1.4;
  por.add(box(2.6, 0.2, 1.25, TRAV_L, { y: 0.14 + colH, z: 3.05 }));
  por.add(box(2.6, 0.1, 1.28, TRAV_D, { y: 0.14 + colH + 0.2, z: 3.05 }));
  const py = 0.14 + colH + 0.3;
  por.add(profile([[-1.32, 0], [1.32, 0], [0, 0.5]], 0.2, TRAV_L, { y: py, z: 3.63 }));
  por.add(profile([[-1.0, 0.07], [1.0, 0.07], [0, 0.39]], 0.06, mat(0xa8977a), { y: py, z: 3.55 }));
  por.add(profile([[-1.25, 0], [1.25, 0], [0, 0.46]], 1.2, LEAD, { y: py, z: 3.0 }));
  // Eight columns across the front, two groups of four behind them.
  for (let i = 0; i < 8; i++) {
    const x = -1.1 + i * (2.2 / 7);
    por.add(cylinder(0.07, 0.08, colH, COLUMN, { x, y: 0.14, z: 3.55, segments: 8 }));
    por.add(box(0.19, 0.05, 0.19, TRAV_L, { x, y: 0.14, z: 3.55 }));
    por.add(box(0.19, 0.05, 0.19, TRAV_L, { x, y: 0.14 + colH - 0.05, z: 3.55 }));
  }
  for (const z of [3.05, 2.55]) {
    for (const x of [-1.1, -0.79, 0.79, 1.1]) por.add(cylinder(0.065, 0.075, colH, COLUMN, { x, y: 0.14, z, segments: 8 }));
  }
  // Steps and central doorway.
  por.add(box(2.3, 0.06, 0.3, TRAV_D, { y: 0.0, z: 3.95 }));
  por.add(box(0.4, 0.8, 0.04, DARK, { y: 0.14, z: 2.62 }));
  g.add(por);
  return g;
}

// ---------------------------------------------------------------------------
// St Peter's Basilica + piazza
// ---------------------------------------------------------------------------

function smallDome(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  g.add(cylinder(0.34, 0.36, 0.5, TRAV_L, { y: 1.7, segments: 12 }));
  g.add(dome(0.36, GREY_DOME, { y: 2.2, squash: 1.1, segments: 12 }));
  g.add(cylinder(0.05, 0.06, 0.18, TRAV_L, { y: 2.58, segments: 6 }));
  return g;
}

function stPeters(p: Place): THREE.Group {
  const g = group(p);
  const stone = STONE_LIT;
  const dm = DOME_LIT;
  g.add(box(4.2, 1.7, 3.0, stone, { x: 0.35 }));
  g.add(box(3.8, 0.12, 3.2, TRAV_D, { x: 0.35, y: 1.7 }));
  // Drum: attic ring, 16 paired-column buttresses with a window in each bay.
  g.add(cylinder(1.3, 1.34, 0.12, TRAV_L, { y: 1.75, segments: 24 }));
  g.add(cylinder(1.18, 1.22, 1.45, stone, { y: 1.87, segments: 24 }));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const x = Math.cos(a) * 1.24;
    const z = Math.sin(a) * 1.24;
    g.add(cylinder(0.055, 0.06, 1.25, COLUMN, { x, z, y: 1.95, segments: 6 }));
    g.add(box(0.2, 0.06, 0.2, TRAV_L, { x, z, y: 1.95, ry: -a }));
    const b = a + Math.PI / 16;
    g.add(box(0.12, 0.5, 0.05, windowMaterial, { x: Math.cos(b) * 1.2, z: Math.sin(b) * 1.2, y: 2.35, ry: -b + Math.PI / 2 }));
  }
  g.add(cylinder(1.32, 1.32, 0.1, TRAV_L, { y: 3.32, segments: 24 }));
  const H = 1.7;
  g.add(dome(1.2, dm, { y: 3.42, squash: H / 1.2, segments: 24 }));
  const ribMat = mat(0xa9aeb4);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 6; s++) {
      const f = (s / 6) * (Math.PI / 2 - 0.1);
      const r = Math.cos(f) * 1.22;
      pts.push(new THREE.Vector3(Math.cos(a) * r, 3.42 + Math.sin(f) * (H + 0.02), Math.sin(a) * r));
    }
    g.add(tube(pts, 0.028, ribMat, { segments: 6 }));
  }
  // Lantern: ring, eight slim columns, cap dome and cross.
  const ly = 3.42 + H - 0.04;
  g.add(cylinder(0.3, 0.34, 0.08, TRAV_L, { y: ly, segments: 12 }));
  g.add(cylinder(0.2, 0.2, 0.4, lampMaterial, { y: ly + 0.08, segments: 12 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.add(cylinder(0.035, 0.04, 0.42, COLUMN, { x: Math.cos(a) * 0.22, z: Math.sin(a) * 0.22, y: ly + 0.08, segments: 5 }));
  }
  g.add(cylinder(0.27, 0.27, 0.07, TRAV_L, { y: ly + 0.5, segments: 12 }));
  g.add(dome(0.25, dm, { y: ly + 0.57, squash: 1.4, segments: 12 }));
  g.add(box(0.03, 0.34, 0.03, M.gold, { y: ly + 0.9 }));
  g.add(box(0.16, 0.03, 0.03, M.gold, { y: ly + 1.1 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(smallDome(sx * 1.05, sz * 1.2));

  // Facade facing +x.
  g.add(box(0.9, 2.1, 4.0, stone, { x: 2.85 }));
  g.add(box(1.0, 0.5, 4.1, TRAV_L, { x: 2.85, y: 2.1 }));
  g.add(box(0.28, 0.14, 4.0, TRAV_L, { x: 3.4, y: 1.82 }));
  for (let i = 0; i < 8; i++) {
    g.add(cylinder(0.07, 0.08, 1.7, COLUMN, { x: 3.38, z: -1.75 + i * 0.5, segments: 8 }));
  }
  g.add(profile([[-0.7, 0], [0.7, 0], [0, 0.35]], 0.16, TRAV_L, { x: 3.4, y: 1.96, ry: Math.PI / 2 }));
  // Balustrade with a row of statues along the attic.
  g.add(box(0.06, 0.08, 4.1, TRAV_L, { x: 3.34, y: 2.6 }));
  for (let i = 0; i < 13; i++) {
    const z = -1.9 + i * 0.3167;
    g.add(box(0.06, 0.2, 0.06, STATUE_LIT, { x: 3.34, z, y: 2.68 }));
    g.add(box(0.05, 0.06, 0.05, STATUE_LIT, { x: 3.34, z, y: 2.88 }));
  }
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 7; i++) g.add(box(0.03, 0.26, 0.12, windowMaterial, { x: 3.32, z: -1.5 + i * 0.5, y: 0.35 + r * 0.55 + (r ? 0.25 : 0) }));
  }
  g.add(box(0.03, 0.9, 0.7, DARK, { x: 3.31, y: 0, z: 0 }));
  return g;
}

/** One curved arm of Bernini's colonnade: slabs and two column rows along a polyline, with statue posts on the roof. */
function colonnadeArm(pts: [number, number][]): THREE.Group {
  const g = group();
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1);
    const seg = group({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, ry: Math.atan2(x2 - x1, z2 - z1) });
    // Alternate slab heights by 6 mm so the mitre overlaps never z-fight.
    const e = (i % 2) * 0.006;
    seg.add(box(0.6, 0.08 + e, len + 0.08, TRAV_D));
    seg.add(box(0.62, 0.1, len + 0.08, TRAV_L, { y: 0.78 + e }));
    seg.add(box(0.2, 0.5, len + 0.04, ARM_LIT, { y: 0.08 }));
    for (const s of [-1, 1]) for (const f of [-0.25, 0.25]) {
      seg.add(cylinder(0.05, 0.055, 0.7, COLUMN, { x: s * 0.2, z: len * f, y: 0.08, segments: 6 }));
    }
    seg.add(box(0.07, 0.17, 0.07, STATUE_LIT, { x: 0.27, y: 0.88 + e }));
    g.add(seg);
  }
  return g;
}

function obelisk(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  g.add(box(0.55, 0.12, 0.55, TRAV_D));
  g.add(box(0.3, 0.22, 0.3, TRAV_L, { y: 0.12 }));
  g.add(cylinder(0.05, 0.1, 1.6, mat(0xc9a99a), { y: 0.34, segments: 4, ry: Math.PI / 4 }));
  g.add(cone(0.05, 0.12, mat(0xc9a99a), { y: 1.94, segments: 4 }));
  return g;
}

function fountain(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  g.add(cylinder(0.3, 0.32, 0.1, TRAV_L, { segments: 14 }));
  g.add(cylinder(0.26, 0.26, 0.12, TURQ, { segments: 14 }));
  g.add(cylinder(0.04, 0.05, 0.28, TRAV_L, { y: 0.1, segments: 6 }));
  return g;
}

// ---------------------------------------------------------------------------
// Trevi Fountain
// ---------------------------------------------------------------------------

function trevi(p: Place): THREE.Group {
  const g = group(p);
  const wall = mat(0xdbcdb0);
  g.add(building({ w: 3.3, d: 1.1, h: 2.0, wall, roof: 'flat', windows: 'grid', floorH: 0.6 }));
  g.add(box(3.4, 0.1, 1.2, TRAV_L, { y: 2.0 }));
  // Central triumphal arch facade.
  g.add(profile([[-0.85, 0], [0.85, 0], [0.85, 2.55], [-0.85, 2.55]], 0.3, TREVI_LIT, { z: 0.65, holes: [archAt(0, 0.35, 0.7, 1.55, 10)] }));
  g.add(box(0.66, 1.4, 0.04, mat(0xb9ac92), { y: 0.35, z: 0.55 }));
  for (const s of [-1, 1]) {
    g.add(cylinder(0.06, 0.07, 1.75, COLUMN, { x: s * 0.52, y: 0.35, z: 0.9, segments: 8 }));
    g.add(cylinder(0.06, 0.07, 1.75, COLUMN, { x: s * 0.76, y: 0.35, z: 0.9, segments: 8 }));
    // Statue niches in the wings flanking the central arch.
    for (const nx of [1.18, 1.5]) {
      g.add(profile(archAt(0, 0, 0.26, 0.8, 6), 0.04, DARK, { x: s * nx, y: 0.5, z: 0.56 }));
      g.add(box(0.1, 0.4, 0.07, STATUE_LIT, { x: s * nx, y: 0.5, z: 0.6 }));
      g.add(box(0.34, 0.05, 0.1, TRAV_L, { x: s * nx, y: 0.45, z: 0.6 }));
    }
  }
  g.add(box(1.9, 0.2, 0.5, TRAV_L, { y: 2.1, z: 0.8 }));
  g.add(box(1.9, 0.3, 0.38, TRAV_L, { y: 2.3, z: 0.7 }));
  // Attic block with three dark panels and a coat of arms, under the pediment.
  g.add(box(1.8, 0.45, 0.3, TREVI_LIT, { y: 2.6, z: 0.7 }));
  g.add(box(1.9, 0.06, 0.38, TRAV_L, { y: 3.05, z: 0.7 }));
  for (const ax of [-0.6, 0, 0.6]) g.add(box(ax === 0 ? 0.24 : 0.36, 0.24, 0.02, ax === 0 ? M.gold : DARK, { x: ax, y: 2.72, z: 0.86 }));
  g.add(profile([[-0.85, 0], [0.85, 0], [0, 0.38]], 0.3, TRAV_L, { y: 3.11, z: 0.7 }));
  for (const s of [-1, 1]) g.add(box(0.12, 0.25, 0.12, STATUE_LIT, { x: s * 0.6, y: 3.11, z: 0.7 }));
  // Rocky mass in front of the arch: dark warm rock, white marble statues (Oceanus facing the basin, +z).
  g.add(shape(treviSculptures, [TREVI_ROCK_LIT, STATUE_LIT], { z: 1.6, y: 0.1, height: 1.4 }));
  // Basin.
  g.add(patch(3.4, 2.3, TURQ, { z: 2.0, h: 0.1 }));
  g.add(box(3.6, 0.2, 0.12, TRAV_L, { z: 3.2 }));
  g.add(box(0.14, 0.2, 2.4, TRAV_L, { x: -1.78, z: 2.0 }));
  g.add(box(0.14, 0.2, 2.4, TRAV_L, { x: 1.78, z: 2.0 }));
  g.add(box(3.4, 0.14, 0.12, TRAV_L, { z: 0.82 }));
  g.add(box(3.6, 0.07, 0.34, TRAV_D, { z: 3.45, y: 0 }));
  return g;
}

// ---------------------------------------------------------------------------
// Roman Forum
// ---------------------------------------------------------------------------

function columnRow(x: number, z: number, n: number, gap: number, h: number, ry = 0, broken = 0): THREE.Group {
  const g = group({ x, z, ry });
  for (let i = 0; i < n; i++) {
    const hh = broken && (i * 5) % 3 === 0 ? h * 0.45 : h;
    g.add(cylinder(0.06, 0.07, hh, COLUMN, { x: (i - (n - 1) / 2) * gap, segments: 8 }));
    g.add(box(0.2, 0.05, 0.2, TRAV_D, { x: (i - (n - 1) / 2) * gap }));
  }
  return g;
}

function forum(rand: () => number): THREE.Group {
  const g = group();
  g.add(patch(6.4, 3.8, PLAZA, { x: -3.0, z: 7.8 }));
  g.add(patch(1.4, 1.2, M.grassDark, { x: -5.3, z: 9.0, h: 0.05 }));
  g.add(patch(1.0, 1.0, M.grass, { x: -0.6, z: 9.2, h: 0.05 }));

  // Temple of Saturn: podium, six columns, broken pediment.
  const saturn = group({ x: -4.3, z: 8.3 });
  saturn.add(box(2.0, 0.3, 1.3, TRAV_D));
  saturn.add(box(1.9, 0.12, 0.6, TRAV, { y: 0.3, z: -0.3 }));
  saturn.add(columnRow(0, 0.45, 6, 0.34, 1.0).translateY(0.3));
  for (const s of [-1, 1]) saturn.add(cylinder(0.06, 0.07, 1.0, COLUMN, { x: s * 0.85, y: 0.3, z: -0.1, segments: 8 }));
  saturn.add(box(1.9, 0.2, 0.5, TRAV_L, { y: 1.3, z: 0.4 }));
  saturn.add(profile([[-0.95, 0], [0.95, 0], [0.3, 0.38]], 0.12, TRAV_L, { y: 1.5, z: 0.45 }));
  g.add(saturn);

  // Temple of Castor: three tall columns with a fragment of entablature.
  g.add(box(1.0, 0.3, 0.8, TRAV_D, { x: -2.3, z: 7.4 }));
  g.add(columnRow(-2.3, 7.4, 3, 0.32, 1.3).translateY(0.3));
  g.add(box(0.95, 0.15, 0.2, TRAV_L, { x: -2.3, y: 1.6, z: 7.4 }));

  // Arch of Septimius Severus.
  const arch = group({ x: -0.9, z: 6.6 });
  arch.add(profile([[-0.95, 0], [0.95, 0], [0.95, 1.4], [-0.95, 1.4]], 0.6, TRAV_L, {
    holes: [archAt(0, 0, 0.55, 1.0, 8), archAt(-0.67, 0, 0.26, 0.55, 6), archAt(0.67, 0, 0.26, 0.55, 6)],
  }));
  arch.add(box(1.05, 0.14, 0.66, TRAV, { y: 1.4 }));
  arch.add(box(0.5, 0.2, 0.3, TRAV_D, { y: 1.54 }));
  g.add(arch);

  // Curia and basilica ruins in brick.
  const brick = mat(0xb7714b);
  g.add(box(1.1, 1.0, 1.0, brick, { x: -5.9, z: 6.7 }));
  g.add(box(1.14, 0.1, 1.04, TRAV_D, { x: -5.9, z: 6.7, y: 1.0 }));
  g.add(box(0.3, 0.2, 0.05, DARK, { x: -5.9, z: 7.22, y: 0.1 }));
  g.add(box(1.4, 0.5, 0.18, brick, { x: -5.0, z: 9.3 }));
  g.add(box(0.18, 0.7, 0.9, brick, { x: -5.75, z: 9.0 }));
  g.add(box(0.18, 0.35, 0.9, brick, { x: -4.3, z: 9.1 }));

  // Round Temple of Vesta.
  const vesta = group({ x: -0.9, z: 9.0 });
  vesta.add(cylinder(0.42, 0.45, 0.12, TRAV_D, { segments: 14 }));
  vesta.add(cylinder(0.26, 0.26, 0.5, TRAV_L, { y: 0.12, segments: 12 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    vesta.add(cylinder(0.035, 0.04, 0.55, COLUMN, { x: Math.cos(a) * 0.36, z: Math.sin(a) * 0.36, y: 0.12, segments: 6 }));
  }
  vesta.add(cone(0.44, 0.22, ROOF, { y: 0.67, segments: 14 }));
  g.add(vesta);

  // Scattered column stubs and fallen drums.
  g.add(columnRow(-3.6, 6.3, 5, 0.42, 0.55, 0, 1));
  g.add(columnRow(-2.9, 9.4, 4, 0.5, 0.4, 0, 1));
  g.add(scatter({ x: -3.0, z: 7.8, w: 5.6, d: 3.0 }, 9, rand, (x, z) => {
    const d = cylinder(0.06, 0.06, 0.28, COLUMN, { x, z, segments: 7 });
    d.rotation.set(0, rand() * Math.PI, Math.PI / 2);
    d.position.y = 0.06;
    return d;
  }));
  return g;
}

// ---------------------------------------------------------------------------
// Bridge, houses
// ---------------------------------------------------------------------------

/** Arched bridge deck of length `len` along local x; `ry` turns it to span a N-S road. */
function bridge(x: number, z: number, ry = 0, len = 3.6, spanW = 1.8): THREE.Group {
  const g = group({ x, z, ry });
  const outline = (dy: number): [number, number][] => [
    [-len / 2, -0.01], [len / 2, -0.01], [len / 2, 0.28 + dy], [0.9, 0.52 + dy], [-0.9, 0.52 + dy], [-len / 2, 0.28 + dy],
  ];
  const hole = spanAt(0, 0.03, spanW, 0.4);
  g.add(profile(outline(0), 0.9, TRAV, { holes: [hole] }));
  for (const s of [-1, 1]) {
    g.add(profile(outline(0.1), 0.1, TRAV_L, { holes: [hole], z: s * 0.44 }));
  }
  return g;
}

function cafe(x: number, y: number, z: number, color: THREE.ColorRepresentation): THREE.Group {
  const g = group({ x, y, z });
  g.add(cylinder(0.012, 0.012, 0.3, M.dark, { segments: 4 }));
  g.add(cone(0.15, 0.08, mat(color), { y: 0.3, segments: 8 }));
  g.add(cylinder(0.07, 0.07, 0.015, M.white, { y: 0.14, x: 0.12, segments: 6 }));
  return g;
}

function house(x: number, z: number, w: number, d: number, h: number, rand: () => number): THREE.Group {
  const wall = WALLS[Math.floor(rand() * WALLS.length)];
  const roofMat = rand() < 0.5 ? ROOF : ROOF2;
  const awning = AWNINGS[Math.floor(rand() * AWNINGS.length)];
  const shop = rand() < 0.55 && h >= 1.2;
  const g = building({ x, z, w, d, h, wall, trim: TRAV_L, roof: 'flat', windows: 'grid', floorH: 0.5, plain: true, shop: shop ? awning : undefined });
  // Cornice and base course by hand (plain skips them), plus a street door when there is no shop.
  g.add(box(w + 0.05, 0.2, d + 0.05, TRAV_D));
  g.add(box(w + 0.1, 0.08, d + 0.1, TRAV_L, { y: h - 0.08 }));
  if (!shop) g.add(box(Math.min(0.3, w * 0.3), 0.4, 0.05, DARK, { z: d / 2 + 0.01 }));
  // Balcony on the piano nobile of wider blocks.
  if (w > 1.2 && h > 1.4) {
    g.add(box(w * 0.5, 0.04, 0.16, TRAV_L, { y: 0.78, z: d / 2 + 0.06 }));
    g.add(box(w * 0.5, 0.1, 0.02, DARK, { y: 0.82, z: d / 2 + 0.14 }));
  }
  const rh = 0.32 + rand() * 0.18;
  const kind = rand();
  if (kind < 0.18 && w > 1.1 && d > 1.1) {
    // Roof terrace (altana): low parapet and a small loggia on posts.
    g.add(box(w + 0.04, 0.1, d + 0.04, TRAV_L, { y: h }));
    g.add(box(w * 0.4, 0.06, d * 0.4, TRAV_D, { y: h + 0.1, x: -w * 0.15, z: -d * 0.15 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.05, 0.3, 0.05, COLUMN, { y: h + 0.16, x: -w * 0.15 + sx * w * 0.17, z: -d * 0.15 + sz * d * 0.17 }));
    g.add(box(w * 0.46, 0.05, d * 0.46, roofMat, { y: h + 0.46, x: -w * 0.15, z: -d * 0.15 }));
    g.add(hipRoof(w * 0.5, d * 0.34, 0.2, roofMat, { y: h + 0.1, x: w * 0.22, z: d * 0.26 }));
  } else {
    g.add(box(w + 0.3, 0.05, d + 0.3, roofMat, { y: h + 0.02 }));
    if (w >= d * 1.3 && kind < 0.6) g.add(gableRoof(w + 0.26, d + 0.26, rh, roofMat, { y: h + 0.05 }));
    else g.add(hipRoof(w + 0.26, d + 0.26, rh, roofMat, { y: h + 0.05 }));
    g.add(box(0.1, 0.28, 0.1, TRAV_D, { y: h + rh * 0.4, x: w * 0.22, z: -d * 0.2 }));
    // Occasional bell-tower cap for height rhythm.
    if (kind > 0.9) g.add(box(0.2, 0.5, 0.2, wall, { y: h + rh * 0.3, x: -w * 0.25, z: d * 0.15 }), hipRoof(0.26, 0.26, 0.2, roofMat, { y: h + rh * 0.3 + 0.5, x: -w * 0.25, z: d * 0.15 }));
  }
  return g;
}

// ---------------------------------------------------------------------------

export default function build(): CityScene {
  const rand = rng(61);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: M.cobble, side: mat(0x5b616b) }));

  // River with embankments.
  const R: [number, number][] = [[-9.8, -1.6], [-5.5, -1.6], [-2.2, -0.6], [0.2, 1.4], [1.2, 4.0], [1.5, 7.0], [1.5, 9.8]];
  const RW = 1.5;
  const dirs = R.slice(1).map(([x, z], i) => {
    const l = Math.hypot(x - R[i][0], z - R[i][1]);
    return [(x - R[i][0]) / l, (z - R[i][1]) / l];
  });
  for (let i = 0; i < R.length - 1; i++) {
    const [x1, z1] = R[i];
    const [x2, z2] = R[i + 1];
    root.add(road(x1, z1, x2, z2, RW, { lines: false, material: WATER }));
    if (i > 0) root.add(cylinder(RW / 2, RW / 2, 0.05, WATER, { x: x1, z: z1, segments: 20 }));
  }
  // Kerbs follow the mitred bank lines; inner joints overshoot a little so bends leave no gap.
  const off = RW / 2 + 0.07;
  for (const s of [-1, 1]) {
    const bank = R.map(([x, z], j) => {
      const a = dirs[Math.max(j - 1, 0)];
      const b = dirs[Math.min(j, dirs.length - 1)];
      const nl = Math.hypot(a[1] + b[1], a[0] + b[0]);
      const nx = -(a[1] + b[1]) / nl;
      const nz = (a[0] + b[0]) / nl;
      const k = off / (nx * -a[1] + nz * a[0]);
      return [x + s * nx * k, z + s * nz * k];
    });
    for (let i = 0; i < dirs.length; i++) {
      const [dx, dz] = dirs[i];
      const lo = i > 0 ? 0.05 : 0;
      const hi = i < dirs.length - 1 ? 0.05 : 0;
      const ax = bank[i][0] - dx * lo;
      const az = bank[i][1] - dz * lo;
      const bx = bank[i + 1][0] + dx * hi;
      const bz = bank[i + 1][1] + dz * hi;
      root.add(box(0.14, 0.13, Math.hypot(bx - ax, bz - az), TRAV_D, { x: (ax + bx) / 2, z: (az + bz) / 2, ry: Math.atan2(dx, dz) }));
    }
  }
  root.add(bridge(1.36, 5.4));
  root.add(bridge(1.5, 8.6));
  root.add(bridge(-3.2, -1.1, Math.PI / 2, 2.4, 1.8));

  // Streets and squares.
  const st = { lines: false, material: PAVE };
  // Runs to the far edge of the bridge deck (x -3.65..-2.75) so the deck foot lands on the street, not on its corner.
  root.add(road(-9.8, 0.1, -2.75, 0.1, 1.0, st));
  root.add(road(-3.2, -2.1, -3.2, -9.6, 0.8, st));
  root.add(road(3.2, -3.0, 3.2, 9.8, 0.8, st));
  root.add(road(3.2, 4.05, 9.8, 4.05, 0.9, st));
  root.add(road(-9.8, 6.45, -6.4, 6.45, 0.7, st));
  root.add(patch(6.6, 6.0, PLAZA, { x: 6.5, z: -6.4 }));
  root.add(patch(2.8, 3.6, PLAZA, { x: -2.3, z: -4.5 }));

  // Landmarks.
  root.add(colosseum({ x: -6.5, z: 3.7, ry: 0 }));
  root.add(pantheon({ x: -6.3, z: -4.9 }));
  root.add(stPeters({ x: 0.5, z: -6.4 }));
  // St Peter's piazza: two elliptical colonnade arms leave the facade ends and close round an oval, open to the east.
  const oval = { x: 6.9, z: -6.4, a: 2.7, b: 2.8 };
  for (const s of [-1, 1]) {
    const pts: [number, number][] = [[3.95, oval.z + s * 2.25]];
    for (let i = 0; i <= 9; i++) {
      const t = ((125 - i * 12.2) * Math.PI) / 180;
      pts.push([oval.x + oval.a * Math.cos(t), oval.z + s * oval.b * Math.sin(t)]);
    }
    root.add(colonnadeArm(pts));
  }
  root.add(area(ellipse(oval.a - 0.5, oval.b - 0.5), OVAL, { x: oval.x, z: oval.z, h: 0.03 }));
  root.add(prism(ellipse(0.85, 0.85, 24), 0.05, TRAV_L, { x: oval.x, z: oval.z, holes: [ellipse(0.75, 0.75, 24)] }));
  root.add(obelisk(oval.x, oval.z));
  root.add(fountain(5.6, -7.9));
  root.add(fountain(5.6, -4.9));
  root.add(trevi({ x: 6.6, z: 0.2 }));
  root.add(forum(rand));

  // Terracotta houses.
  const blocks: [number, number, number, number, number][] = [
    // back-left strip
    [-9.0, -8.6, 1.4, 1.3, 1.5], [-7.4, -8.8, 1.5, 1.2, 1.3], [-5.6, -8.7, 1.6, 1.3, 1.7], [-3.9, -8.9, 1.5, 1.2, 1.4],
    [-2.3, -9.0, 1.5, 1.2, 1.6], [-0.2, -9.2, 1.7, 1.2, 1.4], [1.8, -9.1, 1.6, 1.3, 1.6],
    [-9.0, -6.4, 1.2, 1.5, 1.6], [-9.0, -4.4, 1.2, 1.6, 1.4], [-9.0, -3.0, 1.2, 0.8, 1.5],
    // between Pantheon / river / basilica
    [0.8, -2.5, 1.7, 1.3, 1.5], [-1.5, -2.0, 1.0, 0.8, 1.2],
    // east of street 3.2, north of Trevi
    [4.8, -1.8, 1.4, 1.2, 1.7], [6.3, -1.9, 1.5, 1.3, 2.0], [7.9, -1.8, 1.5, 1.2, 1.6], [9.0, -0.4, 1.2, 1.8, 1.7],
    [9.0, 1.7, 1.2, 1.8, 1.5], [4.3, 0.8, 1.0, 1.4, 1.8], [4.3, 2.6, 1.0, 1.2, 1.5], [9.0, 3.0, 1.1, 1.0, 1.4],
    // front-right grid
    [4.3, 5.6, 1.6, 1.4, 1.6], [6.0, 5.6, 1.6, 1.4, 1.3], [7.8, 5.6, 1.7, 1.4, 1.7], [9.1, 5.6, 1.0, 1.4, 1.4],
    [4.3, 7.4, 1.6, 1.5, 1.2], [7.8, 7.4, 1.7, 1.5, 1.3], [9.1, 7.4, 1.0, 1.5, 1.4],
    [4.3, 9.1, 1.6, 1.3, 1.1], [6.0, 9.1, 1.6, 1.3, 1.0], [7.8, 9.1, 1.7, 1.3, 1.1], [9.1, 9.1, 1.0, 1.3, 1.1],
    // front-left corner
    [-9.0, 8.3, 1.3, 1.8, 1.6], [-7.4, 9.0, 1.4, 1.2, 1.4], [-8.9, 6.9, 1.4, 0.7, 1.2],
  ];
  for (const [x, z, w, d, h] of blocks) root.add(house(x, z, w, d, h, rand));

  // Pines and trees.
  for (const [x, z, s] of [[-2.0, 5.2, 1.1], [-1.0, 5.0, 1.0], [-7.2, 7.4, 1.1], [-6.5, 8.6, 0.9], [-9.2, 0.9, 1.0], [-3.9, 1.6, 1.0], [2.5, 3.2, 0.9], [-1.4, 8.8, 0.9], [6.1, 7.4, 1.2]] as const) {
    root.add(pine(x, z, s));
  }
  root.add(row(-3.4, 0.8, -3.4, 5.8, 4, (x, z) => tree({ x, z, s: 0.8 })));

  // Street life.
  root.add(row(-9.0, 0.7, -4.0, 0.7, 5, (x, z) => lamp({ x, z })));
  root.add(row(3.8, 3.5, 9.4, 3.5, 5, (x, z) => lamp({ x, z })));

  // Romans in linen, terracotta, olive and navy coats; every figure stands on the surface under it.
  const COATS = [0xe8dcc0, 0xb8583a, 0x6b7040, 0x23365a, 0xf4f1ea, 0xc9a050, 0x8a3f2c];
  const inRect = (x: number, z: number, x0: number, x1: number, z0: number, z1: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
  const surf = (x: number, z: number): number => {
    if (inRect(x, z, 4.8, 8.4, 3.48, 3.82)) return 0.07; // Trevi front step
    if (
      (inRect(x, z, -9.8, -2.75, -0.4, 0.6)) || (inRect(x, z, -3.6, -2.8, -9.6, -2.1)) || (inRect(x, z, 2.8, 3.6, -3.0, 9.8)) ||
      (inRect(x, z, 3.2, 9.8, 3.6, 4.5)) || (inRect(x, z, -9.8, -6.4, 6.1, 6.8))
    ) return 0.05;
    if (inRect(x, z, 3.2, 9.8, -9.4, -3.4) || inRect(x, z, -3.7, -0.9, -6.3, -2.7)) return 0.04;
    return 0;
  };
  const roman = (x: number, z: number, i: number, dry = false) =>
    person({ x, y: surf(x, z), z, color: COATS[i % COATS.length], umbrella: dry ? undefined : UMBRELLAS[(i * 3 + 1) % UMBRELLAS.length] });
  const nearPath = (path: [number, number][], r: number, closed = true) => (x: number, z: number) => {
    const n = closed ? path.length : path.length - 1;
    for (let k = 0; k < n; k++) {
      const [ax, az] = path[k];
      const [bx, bz] = path[(k + 1) % path.length];
      const l2 = (bx - ax) ** 2 + (bz - az) ** 2;
      const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (z - az) * (bz - az)) / l2));
      if (Math.hypot(x - (ax + t * (bx - ax)), z - (az + t * (bz - az))) < r) return true;
    }
    return false;
  };
  // Walker loops (closed, on paving, clear of the car lanes at x=3.0 and z=4.25).
  const OX = 6.9, OZ = -6.4;
  const ovalLoop: [number, number][] = Array.from({ length: 12 }, (_, k) => [OX + 1.3 * Math.cos((k * TAU) / 12), OZ + 1.25 * Math.sin((k * TAU) / 12)]);
  const frontLoop: [number, number][] = [[-5.3, 6.95], [-2.5, 6.95], [-2.5, 8.9], [-5.3, 8.9]];
  const treviLoop: [number, number][] = [[5.0, 3.63], [8.2, 3.63], [8.2, 3.78], [5.0, 3.78]];
  const smallLoop: [number, number][] = [[-2.5, -5.7], [-1.2, -5.7], [-1.2, -3.2], [-2.5, -3.2]];
  const streetLoop: [number, number][] = [[-8.6, -0.1], [-3.9, -0.1], [-3.9, 0.3], [-8.6, 0.3]];
  const walking = nearPath(ovalLoop, 0.4);
  const walkingFront = nearPath(frontLoop, 0.4);
  const walkingSmall = nearPath(smallLoop, 0.4);

  // Café umbrellas first, so the standing crowds can keep clear of them.
  const tables: [number, number][] = [];
  const nearTable = (x: number, z: number) => tables.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.3);
  const cafes: [number, number, number, number, number, (x: number, z: number) => boolean][] = [
    [6.7, -6.4, 3.4, 3.4, 7, (x, z) => Math.hypot(x - OX, z - OZ) < 1.95 || Math.hypot(x - 5.6, z + 7.9) < 0.6 || Math.hypot(x - 5.6, z + 4.9) < 0.6],
    [-2.3, -4.5, 2.2, 3.0, 3, (x, z) => walkingSmall(x, z) || Math.abs(x + 3.2) < 0.5],
    [-3.0, 7.8, 5.0, 2.8, 3, (x, z) => walkingFront(x, z) || Math.hypot(x + 1.4, z - 8.8) < 0.6],
  ];
  for (const [cx, cz, w, d, n, avoid] of cafes) {
    root.add(scatter({ x: cx, z: cz, w, d }, n, rand, (x, z, i) => {
      tables.push([x, z]);
      return cafe(x, surf(x, z), z, UMBRELLAS[(i + 1) % UMBRELLAS.length]);
    }, avoid));
  }

  // Standing crowds: St Peter's oval, Trevi step, front piazza, Colosseum street, small piazza.
  const offOval = (x: number, z: number) =>
    Math.hypot(x - OX, z - OZ) < 1.0 || Math.hypot(x - 5.6, z + 7.9) < 0.5 || Math.hypot(x - 5.6, z + 4.9) < 0.5 || walking(x, z) || nearTable(x, z);
  root.add(scatter({ x: 6.7, z: -6.4, w: 3.6, d: 4.0 }, 12, rand, roman, offOval));
  root.add(scatter({ x: 6.6, z: 3.9, w: 3.2, d: 0.1 }, 6, rand, (x, z, i) => roman(x, z, i + 2)));
  root.add(scatter({ x: -3.0, z: 7.8, w: 5.4, d: 3.0 }, 12, rand, (x, z, i) => roman(x, z, i + 1), (x, z) => walkingFront(x, z) || nearTable(x, z) || Math.hypot(x + 1.4, z - 8.8) < 0.5));
  root.add(scatter({ x: -7.3, z: 6.45, w: 1.6, d: 0.3 }, 3, rand, (x, z, i) => roman(x, z, i + 3)));
  root.add(scatter({ x: -2.3, z: -4.5, w: 2.4, d: 3.0 }, 5, rand, (x, z, i) => roman(x, z, i + 3), (x, z) => walkingSmall(x, z) || nearTable(x, z) || Math.abs(x + 3.2) < 0.5));

  // Walkers: round the obelisk, along the Trevi step, round the front piazza, down the Colosseum street, in the small piazza.
  for (let i = 0; i < 3; i++) root.add(anim.follow(roman(0, 0, i), ovalLoop, 0.22, i / 3, true));
  for (let i = 0; i < 3; i++) root.add(anim.follow(person({ x: 0, y: 0.07, z: 0, color: COATS[(i + 2) % COATS.length], umbrella: UMBRELLAS[(i + 1) % UMBRELLAS.length] }), treviLoop, 0.2, i / 3, true));
  for (let i = 0; i < 3; i++) root.add(anim.follow(roman(0, 0, i + 1, i === 1), frontLoop, 0.24, i / 3, true));
  for (let i = 0; i < 3; i++) root.add(anim.follow(person({ x: 0, y: 0.05, z: 0, color: COATS[(i + 4) % COATS.length], umbrella: i === 2 ? undefined : UMBRELLAS[(i + 2) % UMBRELLAS.length] }), streetLoop, 0.26, i / 3, true));
  for (let i = 0; i < 2; i++) root.add(anim.follow(roman(0, 0, i + 5), smallLoop, 0.2, i / 2, true));

  // Zebra crossings at the junctions.
  root.add(crosswalk(3.2, 2.2, 0.8));
  root.add(crosswalk(3.2, 6.9, 0.8));
  root.add(crosswalk(6.6, 4.05, 0.9, { ry: Math.PI / 2 }));
  root.add(crosswalk(-6.0, 0.1, 1.0, { ry: Math.PI / 2 }));

  // Traffic and boats (pre-merged so each mover is one draw call per material).
  const mover = <T extends THREE.Object3D>(o: T): T => { mergeStatic(o); return o; };
  for (let i = 0; i < 3; i++) root.add(anim.follow(mover(car({ y: 0.05 })), [[3.0, -2.8], [3.0, 9.6]], 0.9, i / 3));
  for (let i = 0; i < 2; i++) root.add(anim.follow(mover(car({ y: 0.05 })), [[9.6, 4.25], [3.4, 4.25]], 0.9, i / 2 + 0.1));
  const lane = (dz: number) => R.map(([x, z]) => [Math.max(-9.5, Math.min(9.5, x)), Math.max(-9.5, Math.min(9.5, z + dz * (z < 5 ? 1 : 0)))] as [number, number]);
  root.add(anim.follow(mover(boat({ y: 0.05, color: 0xf0e6d2 })), lane(0), 0.45, 0.05));
  root.add(anim.follow(mover(boat({ y: 0.05, color: 0xc8433a, len: 0.55 })), lane(0.25), 0.4, 0.4));
  root.add(anim.follow(mover(boat({ y: 0.05, color: 0x3d6fb6 })), lane(-0.25), 0.35, 0.7));

  return { root, update: anim.update };
}
