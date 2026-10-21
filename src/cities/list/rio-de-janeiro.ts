import * as THREE from 'three';
import {
  Animator, M, area, beam, box, building, car, cone, createBase, crosswalk, cylinder, floodMat, group, lamp, lampMaterial, lathe, mat,
  patch, person, prism, profile, rng, road, row, scatter, shape, sphere, tree, boat, waterMat, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';
import CHRIST from '../shapes/christ-redeemer.shape';
import SUGARLOAF from '../shapes/sugarloaf.shape';

const GRANITE = mat(0xa6a39a, { roughness: 0.9, flat: true });
const GRANITE_DARK = mat(0x8c8a82, { roughness: 0.9, flat: true });
const FOREST = mat(0x4f9444, { flat: true });
const FOREST_DARK = mat(0x37753a, { flat: true });
const SAND = mat(0xf0dcaa);
// Floodlit at night, as the real statue is.
const STATUE = floodMat(0xf6f5ef, 0xe4ecff, 0.6, { roughness: 0.6 });
// Stadium pitch under floodlights at night.
const PITCH = floodMat(0x5e9b46, 0x9fe07a, 0.35);
const PROM_W = mat(0xf4f1ea);
const PROM_B = mat(0x2e3238);
const FAVELA = [0xe8503a, 0xf2b630, 0x3aa0d8, 0x62b94e, 0xe66fa8, 0xf08a3c, 0x8a62c9, 0x2fb5a3, 0xf4e04d, 0xd9482f];
const UMBRELLAS = [0xe8503a, 0xf2b630, 0x3aa0d8, 0xe66fa8, 0x62b94e, 0xf08a3c];
// Beachwear: coral, turquoise, yellow, white, green, hot pink, sky blue.
const BEACHWEAR = [0xff6b5a, 0x1fc1c9, 0xffd23f, 0xffffff, 0x3fbf5f, 0xe66fa8, 0x3aa0d8, 0xf08a3c];
// Seleção kits for the pitch: yellow, blue, white, green.
const KITS = [0xffd23f, 0x2a62c8, 0xffd23f, 0xffffff, 0x2a62c8, 0x3fbf5f];
const PASTEL = [0xf1e3c4, 0xe9c9a8, 0xd9e6e2, 0xf0d1d1, 0xdbe4f0, 0xf4efe0];

/** Radius at height y for a hill of radius R and height H; k < 1 bulges, k > 1 is a spike. */
function hillProfile(R: number, H: number, k: number, top: number, y0 = 0, y1 = H, steps = 14): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    const r = top + (R - top) * Math.pow(Math.max(0, 1 - y / H), k);
    pts.push([r, y]);
  }
  return pts;
}

function hillR(R: number, H: number, k: number, top: number, y: number): number {
  return top + (R - top) * Math.pow(Math.max(0, 1 - y / H), k);
}

function ellipse(a: number, b: number, n = 28): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push([Math.cos(t) * a, Math.sin(t) * b]);
  }
  return pts;
}

/** Christ the Redeemer: baked Rodin statue on its pedestal (one stone part), arms across x. ~2.3 tall. */
function christ(p: Place): THREE.Group {
  return shape(CHRIST, [STATUE], { ...p, height: 2.3, smooth: true });
}

/** Corcovado: forest skirt under a steep, faceted granite spire with sheer front buttresses. */
function corcovado(p: Place, rand: () => number): THREE.Group {
  const g = group(p);
  const skirtR = (y: number) => 3.2 - 0.38 * y;
  g.add(lathe([[3.2, 0], [2.85, 1.2], [2.4, 2.4], [1.95, 3.7]], FOREST, { segments: 12 }));
  g.add(lathe([[1.95, 3.6], [1.6, 5.0], [1.35, 6.5], [1.1, 7.8], [0.95, 8.6]], GRANITE, { segments: 9 }));
  g.add(cylinder(0.95, 0.95, 0.04, GRANITE_DARK, { y: 8.6, segments: 9 }));
  // Sheer granite cliff on the camera-facing flank (forest skirt wraps the other sides).
  g.add(profile([[-1.2, 3.5], [1.2, 3.5], [0.75, 8.5], [-0.75, 8.5]], 0.5, mat(0xb9b5ab, { roughness: 0.9, flat: true }), { x: 0.82, z: 0.82, ry: Math.PI / 4 }));
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * 0.25 + (i - 1.5) * 0.3;
    const y = 4.2 + (i % 2) * 1.5;
    g.add(box(0.2, 2.8 - (i % 2) * 0.8, 0.5, GRANITE_DARK, { x: Math.cos(a) * 1.55, z: Math.sin(a) * 1.55, y, ry: -a + Math.PI / 2 }));
  }
  // Rainforest canopy on the skirt.
  for (let i = 0; i < 28; i++) {
    const a = rand() * Math.PI * 2;
    const y = 0.1 + rand() * 3.6;
    g.add(sphere(0.4 + rand() * 0.2, rand() > 0.5 ? FOREST_DARK : M.leaf, {
      x: Math.cos(a) * skirtR(y) * 0.85, z: Math.sin(a) * skirtR(y) * 0.85, y, segments: 7,
    }));
  }
  g.add(christ({ y: 8.64 }));
  return g;
}

/** Sugarloaf with its Urca shoulder: baked Rodin massif (forest skirt, bare granite); shoulder faces the cable-car station. */
function sugarloaf(p: Place): THREE.Group {
  return shape(SUGARLOAF, [FOREST, GRANITE], { ...p, height: 4.4, ry: Math.PI });
}

function gondola(): THREE.Group {
  const g = group();
  g.add(box(0.26, 0.2, 0.2, mat(0xd8392f, { roughness: 0.5 }), { y: -0.32 }));
  g.add(box(0.27, 0.07, 0.21, windowMaterial, { y: -0.29 }));
  g.add(box(0.3, 0.04, 0.24, M.white, { y: -0.12 }));
  g.add(box(0.03, 0.2, 0.03, M.steel, { y: -0.12 }));
  g.userData.dynamic = true;
  return g;
}

function cableCar(anim: Animator, a: [number, number, number], b: [number, number, number], count: number): THREE.Group {
  const g = group();
  g.add(beam(a, b, 0.035, M.steel));
  for (let i = 0; i < count; i++) {
    const gd = gondola();
    const ph = i / count;
    g.add(gd);
    anim.add((t) => {
      const u = 0.5 - 0.5 * Math.cos(t * 0.35 + ph * Math.PI * 2);
      gd.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
    });
  }
  return g;
}

function favelaHill(p: Place, rand: () => number): THREE.Group {
  const g = group(p);
  const R = 2.6;
  const H = 3.4;
  const k = 0.9;
  g.add(lathe(hillProfile(R, H, k, 0.2), FOREST, { segments: 22 }));
  for (let lvl = 0; lvl < 8; lvl++) {
    const y = 0.15 + lvl * 0.38;
    const r = hillR(R, H, k, 0.2, y);
    const count = Math.max(4, Math.round(15 - lvl * 1.4));
    for (let i = 0; i < count; i++) {
      const a = -0.1 + ((i + rand() * 0.6) / count) * 2.1;
      const rr = r * (0.9 + rand() * 0.1);
      const s = 0.26 + rand() * 0.2;
      const h = 0.25 + rand() * 0.25;
      const c = mat(FAVELA[Math.floor(rand() * FAVELA.length)]);
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      const ry = -a + Math.PI / 2;
      g.add(box(s, h, s, c, { x, z, y: y - 0.05, ry: ry + (rand() - 0.5) * 0.3 }));
      g.add(box(s * 1.08, 0.04, s * 1.08, mat(0x8a5a40), { x, z, y: y - 0.05 + h, ry }));
      // Lit window on the outward face of two houses in three.
      if (i % 3 !== 0) g.add(box(s * 0.35, h * 0.35, 0.02, windowMaterial, { x: x + Math.cos(a) * s * 0.52, z: z + Math.sin(a) * s * 0.52, y: y - 0.05 + h * 0.4, ry }));
    }
  }
  g.add(sphere(0.3, M.leaf, { x: -0.1, z: 0.1, y: H - 0.05, segments: 7 }));
  return g;
}

function maracana(p: Place): THREE.Group {
  const g = group(p);
  // Tiered stands rising outward, then the roof ring on columns.
  g.add(prism(ellipse(2.35, 1.8), 0.85, mat(0xe9e6df), { holes: [ellipse(2.0, 1.45)] }));
  g.add(prism(ellipse(2.0, 1.45), 0.55, mat(0x4a79b8), { holes: [ellipse(1.7, 1.15)] }));
  g.add(prism(ellipse(1.7, 1.15), 0.28, mat(0xd8dde3), { holes: [ellipse(1.4, 0.85)] }));
  g.add(prism(ellipse(2.55, 2.0), 0.1, M.white, { y: 0.86, holes: [ellipse(1.5, 1.0)] }));
  g.add(prism(ellipse(2.4, 1.85), 0.04, M.dark, { y: 0.82, holes: [ellipse(2.3, 1.75)] }));
  // Floodlights under the roof rim, aimed at the pitch.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.add(box(0.14, 0.05, 0.05, lampMaterial, { x: Math.cos(a) * 1.55, z: Math.sin(a) * 1.05, y: 0.8, ry: -a }));
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    g.add(cylinder(0.04, 0.04, 0.86, M.white, { x: Math.cos(a) * 2.45, z: Math.sin(a) * 1.93, segments: 5 }));
  }
  g.add(patch(2.8, 1.7, PITCH, { y: 0 }));
  g.add(patch(0.05, 1.7, M.white, { y: 0.05, h: 0.01 }));
  g.add(patch(1.0, 0.7, PITCH, { y: 0.04, h: 0.01 }));
  return g;
}

function selaron(p: Place): THREE.Group {
  const g = group(p);
  const cols = [0xe8503a, 0xf2b630, 0x3aa0d8, 0x62b94e, 0xf4f1ea];
  for (let i = 0; i < 9; i++) {
    g.add(box(1.3, 0.13, 0.28, mat(cols[i % cols.length]), { y: i * 0.13, z: -i * 0.27 }));
  }
  g.add(box(0.12, 1.2, 2.5, mat(0xf2b630), { x: -0.7, z: -1.1 }));
  g.add(box(0.12, 1.2, 2.5, mat(0x3aa0d8), { x: 0.7, z: -1.1 }));
  return g;
}

function umbrella(x: number, z: number, color: number): THREE.Group {
  const g = group({ x, z });
  g.add(cylinder(0.018, 0.018, 0.4, M.white, { segments: 5 }));
  g.add(cone(0.26, 0.14, mat(color), { y: 0.38, segments: 8 }));
  g.add(patch(0.3, 0.45, mat(color), { x: 0.08, z: 0.3, ry: 0.4, h: 0.02, y: 0.04 }));
  return g;
}

function stripes(a: [number, number], b: [number, number], w: number, seg: number): THREE.Group {
  const g = group();
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  const ux = dx / len;
  const uz = dz / len;
  const ry = Math.atan2(dx, dz);
  const n = Math.floor(len / seg);
  for (let i = 0; i < n; i++) {
    for (let band = 0; band < 4; band++) {
      const off = (band - 1.5) * (w / 4);
      const c = Math.sin(i * 0.55 + band * 1.1) > 0 ? PROM_W : PROM_B;
      const s = (i + 0.5) * seg;
      const nx = uz;
      const nz = -ux;
      g.add(patch(w / 4, seg, c, { x: a[0] + ux * s + nx * off, z: a[1] + uz * s + nz * off, ry, h: 0.05 }));
    }
  }
  return g;
}

export default function build(): CityScene {
  const rand = rng(2016);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: M.grass, side: mat(0x9a6b45) }));

  // Direction of the Copacabana shoreline and its inland normal.
  const dirx = 0.753;
  const dirz = 0.658;
  const nx = 0.658;
  const nz = -0.753;
  const P0: [number, number] = [-9.6, -0.1];
  const L = 14.6;
  const along = (t: number, off: number): [number, number] => [P0[0] + dirx * L * t + nx * off, P0[1] + dirz * L * t + nz * off];

  // Atlantic sea, sand crescent and the black-and-white promenade.
  root.add(area([[-9.8, 0.1], [-9.8, 9.8], [1.2, 9.8]], SAND));
  root.add(area([[-9.8, 3.0], [-7.4, 4.6], [-5.2, 6.2], [-3.6, 8.0], [-2.8, 9.8], [-9.8, 9.8]], waterMat(0x3f9fcf), { h: 0.07 }));
  // White surf line along the shore.
  root.add(area([[-9.8, 3.0], [-7.4, 4.6], [-5.2, 6.2], [-3.6, 8.0], [-2.8, 9.8], [-2.45, 9.8], [-3.3, 8.15], [-4.95, 6.4], [-7.2, 4.85], [-9.8, 3.3]], mat(0xffffff), { h: 0.085 }));
  root.add(stripes(along(0, 0), along(1, 0), 0.75, 0.32));
  const avA = along(0, 1.15);
  const avB = along(1, 1.15);
  root.add(road(avA[0], avA[1], avB[0], avB[1], 1.0));

  // Bay with Sugarloaf.
  root.add(area([[2.4, -9.8], [9.8, -9.8], [9.8, -1.0], [8, -1.6], [6.2, -2.2], [4.6, -3.4], [3.4, -4.4], [2.8, -6.4], [2.4, -8]], waterMat(0x3f9fcf), { h: 0.07 }));

  // Mountains.
  root.add(corcovado({ x: -6.3, z: -6.3 }, rand));
  root.add(sugarloaf({ x: 7.3, z: -6.3, y: 0.04 }));

  // Cable car: base station, Urca shoulder, Sugarloaf summit. Heights were sampled from the baked
  // terrain so the cabins clear it; a pylon holds the rope where the first span climbs steeply.
  root.add(box(0.5, 1.1, 0.5, M.white, { x: 6.9, z: -3.5 }));
  root.add(box(0.7, 0.12, 0.6, M.red, { x: 6.9, z: -3.5, y: 1.1 }));
  root.add(box(0.5, 1.1, 0.5, M.white, { x: 7.1, z: -4.6, y: 2.85 }));
  root.add(box(0.5, 0.8, 0.5, M.red, { x: 7.3, z: -6.3, y: 4.25 }));
  // Glazed station fronts, lit at night.
  root.add(box(0.36, 0.3, 0.02, windowMaterial, { x: 6.9, z: -3.24, y: 0.6 }));
  root.add(box(0.36, 0.3, 0.02, windowMaterial, { x: 7.1, z: -4.34, y: 3.45 }));
  root.add(box(0.07, 1.5, 0.07, M.steel, { x: 7.16, z: -3.96, y: 1.1 }));
  root.add(box(0.22, 0.05, 0.05, M.steel, { x: 7.07, z: -3.96, y: 2.5 }));
  root.add(cableCar(anim, [6.9, 1.4, -3.5], [7.1, 4.0, -4.6], 2));
  root.add(cableCar(anim, [7.1, 4.0, -4.6], [7.3, 5.2, -6.3], 2));

  // Favela hillside beside Corcovado.
  root.add(favelaHill({ x: -0.9, z: -7.2 }, rand));

  // Maracanã.
  root.add(maracana({ x: 1.6, z: -1.6, ry: 0.35 }));

  // Streets across the middle.
  root.add(road(-6.4, 1.6, 9.5, 1.6, 1.0));
  root.add(road(-1.0, 1.6, -1.0, -3.0, 0.8, { lines: false }));
  root.add(road(2.4, 1.6, 2.4, -0.2, 0.8, { lines: false }));

  // Copacabana apartment blocks facing the avenue: balconies, shopfronts, varied roofs.
  const faceRy = Math.atan2(-nx, -nz);
  const AWN = [0xe8503a, 0xf2b630, 0x3aa0d8, 0x62b94e, 0xe66fa8];
  for (let i = 0; i < 7; i++) {
    const t = 0.1 + i * 0.12;
    const [x, z] = along(t, 2.55 + (i % 2) * 0.25);
    const h = 1.5 + ((i * 5) % 7) * 0.2 + rand() * 0.4;
    const w = 0.95 + (i % 3) * 0.12;
    const b = building({
      w, d: 1.1, h, x, z, ry: faceRy, wall: mat(PASTEL[i % PASTEL.length]), windows: 'grid',
      roof: i % 3 === 2 ? 'gable' : 'flat', roofMat: M.terracotta, shop: AWN[i % AWN.length],
    });
    for (let f = 1; f < Math.floor(h / 0.55); f++) {
      b.add(box(w * 0.7, 0.05, 0.14, M.white, { y: 0.35 + f * 0.55, z: 0.62 }));
      b.add(box(w * 0.7, 0.14, 0.02, M.dark, { y: 0.47 + f * 0.55, z: 0.69 }));
    }
    root.add(b);
  }
  root.add(building({ w: 1.2, d: 1.2, h: 2.6, x: -2.8, z: -0.2, wall: mat(0xe9c9a8), windows: 'grid', shop: 0xf2b630 }));
  root.add(building({ w: 1.3, d: 1.0, h: 1.9, x: -4.8, z: -1.6, wall: mat(0xdbe4f0), windows: 'grid', roof: 'gable', roofMat: M.terracotta }));
  root.add(building({ w: 1.2, d: 1.2, h: 1.7, x: 4.6, z: 0.1, wall: mat(0xf0d1d1), windows: 'grid', shop: 0x3aa0d8 }));
  root.add(building({ w: 1.0, d: 1.4, h: 1.4, x: 8.2, z: 0.0, wall: mat(0xf1e3c4), windows: 'grid', roof: 'gable', roofMat: M.terracotta }));
  root.add(building({ w: 1.4, d: 1.0, h: 1.3, x: 8.4, z: 3.4, wall: mat(0xf4efe0), windows: 'grid', roof: 'gable', roofMat: M.terracotta }));

  // Selarón steps.
  root.add(selaron({ x: 5.6, z: 5.6, y: 0 }));

  // Park with a football pitch in the front corner.
  root.add(patch(3.4, 2.2, mat(0xa6d36f), { x: 7.0, z: 8.0, h: 0.05 }));
  root.add(patch(3.0, 0.05, M.white, { x: 7.0, z: 8.0, h: 0.07 }));
  root.add(patch(3.0, 1.8, mat(0x7cc25a), { x: 7.0, z: 8.0, h: 0.06 }));
  root.add(patch(0.05, 1.8, M.white, { x: 7.0, z: 8.0, h: 0.08 }));
  root.add(scatter({ x: 6.8, z: 5.0, w: 5.0, d: 1.6 }, 7, rand, (x, z) => tree({ x, z, kind: 'palm', s: 0.9 })));
  root.add(scatter({ x: 3.0, z: 6.5, w: 3.0, d: 4.0 }, 7, rand, (x, z) => tree({ x, z, kind: rand() > 0.5 ? 'round' : 'palm', s: 0.85 })));
  // Pitch players stand on the grass inside the white lines (top 0.06), off the centre lines.
  const prand = rng(7016);
  const onLine = (x: number, z: number) => Math.abs(x - 7.0) < 0.08 || Math.abs(z - 8.0) < 0.07;
  for (let i = 0; i < 4; i++) {
    let x = 5.5 + rand() * 3.0;
    let z = 7.2 + rand() * 1.6;
    while (onLine(x, z)) {
      x = 5.5 + prand() * 3.0;
      z = 7.2 + prand() * 1.6;
    }
    root.add(person({ x, y: 0.06, z, color: KITS[i % KITS.length] }));
  }

  // Beach: palm row, umbrellas, towels and people.
  root.add(row(...along(0.08, -0.5), ...along(0.9, -0.5), 9, (x, z) => tree({ x, z, kind: 'palm', s: 0.8 })));
  const umbs: [number, number][] = [];
  for (let i = 0; i < 16; i++) {
    const [x, z] = along(0.1 + rand() * 0.75, -(0.9 + rand() * 0.8));
    root.add(umbrella(x, z, UMBRELLAS[i % UMBRELLAS.length]));
    umbs.push([x, z]);
  }
  // Dry sand only: seaward of the promenade edge and 0.45 clear of the surf line.
  const onSand = (x: number, z: number) => {
    const off = (x - P0[0]) * nx + (z - P0[1]) * nz;
    if (off > -0.5 || x < -9.5 || z > 9.5) return false;
    const S: [number, number][] = [[-9.8, 3.0], [-7.4, 4.6], [-5.2, 6.2], [-3.6, 8.0], [-2.8, 9.8]];
    for (let k = 0; k < S.length - 1; k++) {
      const [x0, z0] = S[k];
      const [x1, z1] = S[k + 1];
      if (x >= x0 && x <= x1) return z < z0 + ((x - x0) / (x1 - x0)) * (z1 - z0) - 0.45;
    }
    return false;
  };
  // Obstacles on the sand: umbrella poles, floodlight masts and the palm row.
  const poles: [number, number][] = [...umbs, ...[0.13, 0.33, 0.53, 0.73].map((t) => along(t, -0.55))];
  for (let i = 0; i < 9; i++) poles.push(along(0.08 + (0.82 * i) / 8, -0.5));
  const beachGoers: [number, number][] = [];
  const clearBeach = (x: number, z: number, own?: [number, number]) =>
    onSand(x, z) &&
    poles.every((p) => p === own || Math.hypot(x - p[0], z - p[1]) > 0.3) &&
    beachGoers.every(([ox, oz]) => Math.hypot(x - ox, z - oz) > 0.18);
  const addBeachGoer = (x: number, z: number, i: number, face = false) => {
    beachGoers.push([x, z]);
    root.add(person({ x, y: 0.04, z, color: BEACHWEAR[i % BEACHWEAR.length], ry: face ? faceRy : undefined }));
  };
  // One person beside every other umbrella: first free spot on a ring around the pole, facing the sea.
  const ring: [number, number][] = [[0.34, 0.1], [-0.34, 0.1], [0.3, -0.25], [-0.3, -0.25], [0.0, 0.45], [0.0, -0.4]];
  for (let i = 0; i < 16; i += 2) {
    const spot = ring.map(([dx, dz]): [number, number] => [umbs[i][0] + dx, umbs[i][1] + dz]).find(([x, z]) => clearBeach(x, z, umbs[i]));
    if (spot) addBeachGoer(spot[0], spot[1], i / 2, true);
  }
  // Loose beachgoers (drawn as before, then nudged inland until they stand on dry sand).
  for (let i = 0; i < 6; i++) {
    let [x, z] = along(0.15 + rand() * 0.7, -(1.9 + rand() * 0.5));
    for (let k = 0; k < 20 && !clearBeach(x, z); k++) {
      x += nx * 0.12;
      z += nz * 0.12;
    }
    if (clearBeach(x, z)) addBeachGoer(x, z, i + 3);
  }
  // A few more strollers and sunbathers on the sand.
  for (let i = 0; i < 8; i++) {
    for (let k = 0; k < 12; k++) {
      const [x, z] = along(0.12 + prand() * 0.75, -(0.7 + prand() * 1.5));
      if (clearBeach(x, z)) {
        addBeachGoer(x, z, i + 1);
        break;
      }
    }
  }
  // Walkers on the wave promenade (top 0.05): closed loops out and back along the two lanes, clear of
  // the lamp row (offset 0.6) and the avenue (offset >= 0.65).
  const WALK: [number, number, number, number][] = [
    [0.06, 0.34, 0.16, 0.0], [0.2, 0.5, 0.15, 0.4], [0.4, 0.7, 0.16, 0.7],
    [0.55, 0.9, 0.15, 0.15], [0.12, 0.62, 0.14, 0.55], [0.46, 0.94, 0.15, 0.85],
  ];
  WALK.forEach(([a, b, o, ph], i) => {
    const loop = [along(a, o), along(b, o), along(b, -o), along(a, -o)];
    root.add(anim.follow(person({ y: 0.05, color: BEACHWEAR[(i * 3 + 1) % BEACHWEAR.length] }), loop, 0.3 + (i % 3) * 0.05, ph, true));
  });
  // Street lamps along the promenade.
  root.add(row(...along(0.05, 0.6), ...along(0.95, 0.6), 8, (x, z) => lamp({ x, z })));
  // Floodlight masts on the sand, between the palms.
  for (const t of [0.13, 0.33, 0.53, 0.73]) {
    const [x, z] = along(t, -0.55);
    root.add(cylinder(0.02, 0.03, 1.2, M.dark, { x, z, segments: 5 }));
    root.add(box(0.18, 0.06, 0.08, lampMaterial, { x, z, y: 1.2, ry: faceRy }));
  }

  // Trees around the favela hill and stadium.
  root.add(scatter({ x: -3.4, z: -3.0, w: 1.4, d: 3.0 }, 4, rand, (x, z) => tree({ x, z, kind: 'round', s: 0.9 })));
  root.add(scatter({ x: 2.0, z: -4.5, w: 1.6, d: 0.6 }, 3, rand, (x, z) => tree({ x, z, kind: 'palm', s: 0.9 })));

  root.add(crosswalk(0.7, 1.6, 1.0, { ry: Math.PI / 2 }));
  root.add(crosswalk(-1.0, 0.5, 0.8, { ry: 0 }));
  // Traffic on the avenue and the cross street.
  const lane = (off: number, rev: boolean): [number, number][] => {
    const a = along(0, 1.15 + off);
    const b = along(1, 1.15 + off);
    return rev ? [b, a] : [a, b];
  };
  for (let i = 0; i < 4; i++) root.add(anim.follow(car({ y: 0.05 }), lane(-0.22, false), 1.2, i / 4));
  for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: 0.05 }), lane(0.22, true), 1.2, i / 3 + 0.1));
  for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: 0.05 }), [[-6.0, 1.35], [9.6, 1.35]], 1.3, i / 3));
  for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: 0.05 }), [[9.6, 1.85], [-6.0, 1.85]], 1.3, i / 3 + 0.2));

  // Boats: sea and bay.
  const boats: [number, number, number, number][] = [
    [-7.4, 7.2, 0xe8503a, 0.5], [-5.2, 8.7, 0xf2b630, 1.8], [-8.6, 5.4, 0x3aa0d8, 3.0],
    [9.2, -2.2, 0xe8503a, 1.0], [3.8, -5.8, 0xf4f1ea, 2.2], [3.5, -8.4, 0x3aa0d8, 0.2],
  ];
  for (const [x, z, color, ry] of boats) {
    root.add(anim.bob(boat({ x, z, y: 0.07, ry, color, len: 0.7 }), 0.025, 1.3));
  }

  return { root, update: anim.update };
}
