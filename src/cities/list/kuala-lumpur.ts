import * as THREE from 'three';
import {
  Animator, M, beam, box, boat, building, car, cone, createBase, cylinder, dome, floodMat, gableRoof, group, lamp,
  lathe, mat, patch, person, prism, profile, rng, road, row, scatter, sphere, tree, waterMat, windowMaterial, crosswalk, type Place,
} from '../../kit';
import type { CityScene } from '../types';

const SILVER = mat(0xd3dae1, { roughness: 0.3, metalness: 0.55 });
const TERRA = mat(0xc8663f, { roughness: 0.8 });
const DOME_RED = mat(0xc2512d, { roughness: 0.55, metalness: 0.2 });
const CREAM = mat(0xf0e2c4);
const SAMAD_WALL = mat(0xe0b88f);
const ROCK = mat(0xb7a48b, { flat: true });
const ROCK_DARK = mat(0x8f7d68, { flat: true });
const BLUE_GLASS_A = mat(0x5e84b0, { roughness: 0.15, metalness: 0.6 });
const BLUE_GLASS_B = mat(0x7a9fc8, { roughness: 0.15, metalness: 0.6 });
const TRACK = mat(0xb9bec4, { roughness: 0.6, metalness: 0.2 });
const RAINBOW = [0xd9473f, 0xf08a3a, 0xf2cd48, 0x6cbf5c, 0x4f9bd6, 0x8a5fc4].map((c) => mat(c));
const SHOP_COLORS = [0xe8c06a, 0xd9726a, 0x7fb6c9, 0xeadfc4, 0xb8d08a, 0xe09a5a];
const BANK = mat(0xd8d2c6);
// Murugan statue and Batu cave mouth: plain by day, floodlit at night.
const GOLD = floodMat(0xe1b13a, 0xffc060, 0.5, { roughness: 0.35 });
const CAVE = floodMat(0x23190f, 0xff9a40, 0.8);

const treeSpots: [number, number][] = [];
const T = (x: number, z: number, s = 1, kind: 'round' | 'cone' | 'palm' | 'blossom' = 'round') => {
  treeSpots.push([x, z]);
  return tree({ x, z, s, kind });
};

function starOutline(R: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    const r = k % 2 ? R * 0.74 : R;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

/** One Petronas tower: Rub el Hizb star plan (two squares + round lobes), tapering banded tiers, setback ledges, crown and spire. */
function petronas(p: Place): THREE.Group {
  const g = group(p);
  const tiers: [number, number][] = [[1.0, 2.2], [0.92, 1.7], [0.84, 1.6], [0.74, 1.5], [0.62, 1.4], [0.5, 1.2], [0.38, 1.0]];
  let y = 0;
  tiers.forEach(([R, h], t) => {
    g.add(prism(starOutline(R), h, SILVER, { y }));
    for (let f = 0.12; f < h - 0.2; f += 0.3) g.add(prism(starOutline(R * 1.012), 0.17, windowMaterial, { y: y + f }));
    for (let k = 0; k < 8; k++) {
      const a = (k * Math.PI) / 4 + Math.PI / 8;
      const lx = Math.cos(a) * R * 0.76;
      const lz = Math.sin(a) * R * 0.76;
      g.add(cylinder(R * 0.17, R * 0.17, h, SILVER, { x: lx, z: lz, y, segments: 8 }));
      for (let f = 0.12; f < h - 0.2; f += 0.3) g.add(cylinder(R * 0.18, R * 0.18, 0.17, windowMaterial, { x: lx, z: lz, y: y + f, segments: 8 }));
    }
    if (t > 0) g.add(prism(starOutline(tiers[t - 1][0] * 1.04), 0.07, SILVER, { y: y - 0.07 }));
    y += h;
  });
  g.add(prism(starOutline(tiers[tiers.length - 1][0] * 1.04), 0.07, SILVER, { y }));
  g.add(cylinder(0.24, 0.3, 0.45, SILVER, { y: y + 0.07, segments: 16 }));
  g.add(cylinder(0.31, 0.31, 0.05, M.steel, { y: y + 0.25, segments: 16 }));
  g.add(cylinder(0.12, 0.2, 0.6, SILVER, { y: y + 0.52, segments: 14 }));
  g.add(cylinder(0.012, 0.06, 1.3, M.steel, { y: y + 1.12, segments: 6 }));
  return g;
}

/** Double-deck skybridge with inverted-V legs, spanning local x (give it ry = π/4). */
function skybridge(p: Place, len: number): THREE.Group {
  const g = group(p);
  const y = 5.5;
  g.add(box(len, 0.14, 0.3, SILVER, { y }));
  g.add(box(len, 0.18, 0.26, windowMaterial, { y: y + 0.14 }));
  g.add(box(len, 0.14, 0.3, SILVER, { y: y + 0.32 }));
  g.add(box(len, 0.18, 0.26, windowMaterial, { y: y + 0.46 }));
  g.add(box(len, 0.08, 0.32, SILVER, { y: y + 0.64 }));
  for (const dz of [-0.13, 0.13]) {
    g.add(beam([-0.9, 3.7, dz], [0, y, dz], 0.08, SILVER));
    g.add(beam([0.9, 3.7, dz], [0, y, dz], 0.08, SILVER));
  }
  return g;
}

function klTower(p: Place): THREE.Group {
  const g = group(p);
  g.add(cylinder(1.05, 1.9, 0.85, M.grass, { segments: 18 }));
  g.add(cylinder(0.6, 1.0, 0.95, M.grassDark, { y: 0.0, segments: 14, x: 0.7, z: 0.6 }));
  g.add(cylinder(0.17, 0.3, 6.2, M.white, { y: 0.85, segments: 12 }));
  g.add(lathe([[0.2, 0], [0.62, 0.3], [0.76, 0.55], [0.62, 0.85], [0.3, 1.0], [0.24, 1.3]], M.white, { y: 6.6, segments: 16 }));
  g.add(cylinder(0.78, 0.78, 0.24, windowMaterial, { y: 6.88, segments: 16, open: true }));
  // Red bands under and over the glazed cabin ring, following the pod's lathe profile.
  g.add(cylinder(0.57, 0.38, 0.2, M.red, { y: 6.68, segments: 16 }));
  g.add(cylinder(0.72, 0.78, 0.2, M.red, { y: 7.12, segments: 16 }));
  g.add(cylinder(0.4, 0.4, 0.3, M.white, { y: 7.9, segments: 12 }));
  g.add(cylinder(0.405, 0.405, 0.12, windowMaterial, { y: 7.98, segments: 12, open: true }));
  g.add(cylinder(0.07, 0.07, 0.05, M.red, { y: 8.2, segments: 8 }));
  g.add(cylinder(0.025, 0.09, 2.6, M.white, { y: 8.2, segments: 8 }));
  g.add(cylinder(0.015, 0.05, 0.8, M.red, { y: 10.4, segments: 6 }));
  // Three splayed legs steadying the shaft where it leaves the hill.
  for (let k = 0; k < 3; k++) {
    const a = (k * Math.PI * 2) / 3 + 0.5;
    g.add(beam([Math.cos(a) * 0.95, 0.85, Math.sin(a) * 0.95], [Math.cos(a) * 0.2, 2.6, Math.sin(a) * 0.2], 0.07, M.white));
  }
  return g;
}

/** Merdeka 118: tapering five-facet glass shaft with a twist, faceted crown and lattice spire. */
function merdeka(p: Place): THREE.Group {
  const g = group(p);
  g.add(box(2.8, 0.5, 2.2, M.concrete));
  g.add(box(2.2, 0.35, 1.7, mat(0x8a98a8, { roughness: 0.3, metalness: 0.4 }), { y: 0.5 }));
  let y = 0.85;
  const n = 10;
  for (let i = 0; i < n; i++) {
    const r = 0.95 - (i / n) * 0.5;
    const h = 0.9;
    const rot = i * 0.16;
    g.add(cylinder(r * 0.94, r, h, BLUE_GLASS_A, { y, segments: 5, ry: rot }));
    // Diamond facets: alternating light triangular panels on each of the five faces.
    for (let f = 0; f < 5; f++) {
      const a = rot + (f + 0.5) * (Math.PI * 2) / 5;
      const rm = r * 0.97 * Math.cos(Math.PI / 5);
      // A third of the facets are lit panes so the tower reads as a lit shaft at night.
      const tri = profile(i % 2 ? [[-0.3 * r, 0], [0.3 * r, 0], [0, h]] : [[-0.3 * r, h], [0.3 * r, h], [0, 0]], 0.03, (i + f) % 3 === 0 ? windowMaterial : BLUE_GLASS_B, { x: Math.sin(a) * rm, z: Math.cos(a) * rm, y, ry: a });
      g.add(tri);
    }
    if (i % 3 === 2) g.add(cylinder(r * 0.97, r * 0.97, 0.05, M.steel, { y: y + h - 0.02, segments: 5, ry: rot }));
    y += h;
  }
  g.add(cylinder(0.2, 0.5, 0.9, BLUE_GLASS_A, { y, segments: 5, ry: n * 0.16 }));
  y += 0.9;
  g.add(cylinder(0.06, 0.2, 0.5, M.steel, { y, segments: 5, ry: n * 0.16 }));
  y += 0.5;
  g.add(cylinder(0.012, 0.06, 1.5, M.steel, { y, segments: 6 }));
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

function sultanAbdulSamad(p: Place): THREE.Group {
  const g = group(p);
  g.add(building({ w: 1.8, d: 6.0, h: 1.35, wall: SAMAD_WALL, roof: 'hip', roofMat: TERRA, roofH: 0.5, windows: 'none', plain: true }));
  g.add(box(1.88, 0.1, 6.08, CREAM, { y: 0.62 }));
  g.add(box(1.9, 0.08, 6.1, CREAM, { y: 1.27 }));
  g.add(box(1.9, 0.12, 6.1, CREAM));
  for (let i = 0; i < 9; i++) {
    const z = -2.6 + i * 0.65;
    if (Math.abs(z) < 0.6 || Math.abs(Math.abs(z) - 2.75) < 0.55) continue;
    archWin(g, 0.9, 0.14, z, 0.24, 0.3);
    archWin(g, 0.9, 0.74, z, 0.2, 0.28);
  }
  // Clock tower: square shaft, banded stages, belfry drum, onion dome and corner cupolas.
  g.add(box(1.0, 3.3, 1.0, SAMAD_WALL, { x: 0.45 }));
  for (const yy of [0.9, 2.0, 3.2]) g.add(box(1.1, 0.1, 1.1, CREAM, { x: 0.45, y: yy }));
  archWin(g, 0.96, 0.15, 0, 0.3, 0.5);
  archWin(g, 0.96, 1.15, 0, 0.26, 0.5);
  const face = cylinder(0.32, 0.32, 0.05, M.white, { x: 0.97, y: 2.35, segments: 18 });
  face.rotation.z = Math.PI / 2;
  g.add(face);
  g.add(box(0.05, 0.22, 0.04, M.dark, { x: 1.0, y: 2.35 }));
  g.add(box(0.05, 0.04, 0.16, M.dark, { x: 1.0, y: 2.33 }));
  const face2 = cylinder(0.32, 0.32, 0.05, M.white, { x: 0.45, y: 2.35, z: 0.5, segments: 18 });
  face2.rotation.x = Math.PI / 2;
  g.add(face2);
  g.add(box(0.04, 0.22, 0.05, M.dark, { x: 0.45, y: 2.35, z: 0.53 }));
  g.add(box(0.16, 0.04, 0.05, M.dark, { x: 0.45, y: 2.33, z: 0.53 }));
  for (const dx of [-0.38, 0.38]) for (const dz of [-0.38, 0.38]) {
    g.add(cylinder(0.08, 0.1, 0.32, CREAM, { x: 0.45 + dx, z: dz, y: 3.3, segments: 6 }));
    g.add(onion(0.11, DOME_RED, { x: 0.45 + dx, z: dz, y: 3.62 }));
  }
  g.add(cylinder(0.3, 0.38, 0.45, CREAM, { x: 0.45, y: 3.3, segments: 8 }));
  g.add(onion(0.42, DOME_RED, { x: 0.45, y: 3.75 }));
  // End pavilions with big onion domes on drums, flanked by small turrets.
  for (const z of [-2.75, 2.75]) {
    g.add(box(1.5, 1.95, 1.05, SAMAD_WALL, { z }));
    g.add(box(1.6, 0.08, 1.15, CREAM, { z, y: 1.9 }));
    g.add(box(1.58, 0.08, 1.13, CREAM, { z, y: 0.7 }));
    archWin(g, 0.75, 0.14, z, 0.3, 0.4);
    archWin(g, 0.75, 1.0, z, 0.3, 0.45);
    g.add(cylinder(0.3, 0.36, 0.36, CREAM, { z, y: 1.98, segments: 8 }));
    g.add(onion(0.4, DOME_RED, { z, y: 2.34 }));
    for (const dz of [-0.4, 0.4]) {
      g.add(cylinder(0.07, 0.09, 0.28, CREAM, { x: 0.62, z: z + dz, y: 1.98, segments: 6 }));
      g.add(onion(0.1, DOME_RED, { x: 0.62, z: z + dz, y: 2.26 }));
    }
  }
  return g;
}

function oldBlock(p: Place, w: number, d: number): THREE.Group {
  const g = group(p);
  g.add(building({ w, d, h: 1.3, wall: mat(0xe8cba5), roof: 'hip', roofMat: TERRA, roofH: 0.6, windows: 'none', plain: true }));
  g.add(box(w + 0.06, 0.08, d + 0.06, CREAM, { y: 0.62 }));
  const n = Math.floor(w / 0.5);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.35 + i * ((w - 0.7) / Math.max(1, n - 1));
    g.add(box(0.24, 0.5, 0.04, windowMaterial, { x, y: 0.1, z: d / 2 }));
    g.add(box(0.2, 0.4, 0.04, windowMaterial, { x, y: 0.8, z: d / 2 }));
  }
  return g;
}

/** Shophouse: open five-foot-way arcade below, shuttered upper floor, ridge-on-depth tiled roof, pediment. */
function shophouse(x: number, z: number, i: number, ry = 0): THREE.Group {
  const g = group({ x, z, ry });
  const wallM = mat(SHOP_COLORS[i % SHOP_COLORS.length]);
  const h = 1.15 + (i % 3) * 0.2;
  const gh = 0.5;
  const shutter = i % 2 ? mat(0x4f7a52) : mat(0x6b4a33);
  g.add(box(0.95, gh, 1.3, mat(0xe9dcc0), { z: -0.25 }));
  g.add(building({ w: 0.95, d: 1.8, h: h - gh, y: gh, wall: wallM, windows: 'none', plain: true, roof: 'flat' }));
  for (const cx of [-0.42, -0.14, 0.14, 0.42]) g.add(box(0.07, gh, 0.07, CREAM, { x: cx, z: 0.83 }));
  for (const cx of [-0.28, 0, 0.28]) {
    g.add(box(0.16, 0.3, 0.03, windowMaterial, { x: cx, y: 0.04, z: 0.41 }));
    const head = cylinder(0.08, 0.08, 0.03, windowMaterial, { x: cx, y: 0.34, z: 0.41, segments: 8 });
    head.rotation.x = Math.PI / 2;
    g.add(head);
    const arch = cylinder(0.14, 0.14, 0.05, CREAM, { x: cx, y: gh - 0.14, z: 0.83, segments: 10 });
    arch.rotation.x = Math.PI / 2;
    g.add(arch);
  }
  g.add(box(0.95, 0.07, 0.08, CREAM, { y: gh - 0.07, z: 0.86 }));
  for (const sx of [-0.22, 0.22]) {
    g.add(box(0.22, 0.4, 0.03, windowMaterial, { x: sx, y: gh + 0.22, z: 0.9 }));
    g.add(box(0.07, 0.4, 0.03, shutter, { x: sx - 0.1, y: gh + 0.22, z: 0.92 }));
    g.add(box(0.07, 0.4, 0.03, shutter, { x: sx + 0.1, y: gh + 0.22, z: 0.92 }));
  }
  g.add(box(0.99, 0.06, 0.1, CREAM, { y: h - 0.06, z: 0.87 }));
  g.add(box(0.95, 0.2, 0.05, wallM, { y: h, z: 0.88 }));
  g.add(gableRoof(1.86, 1.0, 0.34, i % 2 ? TERRA : mat(0xa8553a), { y: h, ry: Math.PI / 2 }));
  return g;
}

function officeTower(x: number, z: number, w: number, d: number, h: number, wall: THREE.Material): THREE.Group {
  return building({ x, z, w, d, h, wall, windows: 'bands', floorH: 0.5, roof: 'flat', shop: SHOP_COLORS[Math.floor(h * 7) % SHOP_COLORS.length] });
}

function murugan(p: Place): THREE.Group {
  const g = group(p);
  g.add(box(1.5, 0.45, 1.1, mat(0xe3d6b8)));
  g.add(box(1.0, 0.22, 0.8, mat(0xd2c4a3), { y: 0.45 }));
  const y0 = 0.67;
  for (const sx of [-0.18, 0.18]) g.add(box(0.2, 1.3, 0.22, GOLD, { x: sx, y: y0 }));
  g.add(cylinder(0.3, 0.4, 0.55, GOLD, { y: y0 + 1.3, segments: 10 }));
  g.add(cylinder(0.26, 0.32, 1.0, GOLD, { y: y0 + 1.85, segments: 10 }));
  g.add(box(0.8, 0.12, 0.2, GOLD, { y: y0 + 2.7 }));
  g.add(sphere(0.2, GOLD, { y: y0 + 3.0, segments: 10 }));
  g.add(cylinder(0.08, 0.25, 0.55, GOLD, { y: y0 + 3.1, segments: 8 }));
  g.add(beam([0.38, y0 + 2.7, 0], [0.5, y0 + 1.95, 0.08], 0.1, GOLD));
  g.add(beam([-0.38, y0 + 2.7, 0], [-0.52, y0 + 3.4, 0], 0.1, GOLD));
  g.add(beam([-0.52, y0 + 1.5, 0], [-0.52, y0 + 3.9, 0], 0.035, GOLD));
  g.add(cone(0.06, 0.3, GOLD, { x: -0.52, y: y0 + 3.9, segments: 4 }));
  g.scale.setScalar(0.95);
  return g;
}

function batuCaves(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  const parts: [number, number, number, number, number, number, number][] = [
    [1.6, 1.75, 2.8, 0, 0, 0, 0.3],
    [1.2, 1.4, 1.8, -0.15, 0.1, 2.6, 1.0],
    [0.8, 1.0, 1.3, 0.1, 0, 4.2, 0.4],
  ];
  parts.forEach(([rt, rb, h, dx, dz, y, ry], i) => g.add(cylinder(rt, rb, h, i % 2 ? ROCK_DARK : ROCK, { x: dx, z: dz, y, segments: 7, ry })));
  // Cave mouth at the head of the stairs: lit opening, round head, little portico.
  const my = 1.6;
  g.add(box(1.0, my, 0.35, M.pavement, { x: 0.95, z: 1.45 }));
  g.add(box(0.7, 0.6, 0.3, CAVE, { x: 0.95, y: my, z: 1.3 }));
  const head = cylinder(0.35, 0.35, 0.3, CAVE, { x: 0.95, y: my + 0.6, z: 1.3, segments: 10 });
  head.rotation.x = Math.PI / 2;
  g.add(head);
  for (const sx of [0.5, 1.4]) g.add(box(0.08, 1.2, 0.08, CREAM, { x: sx, y: my, z: 1.5 }));
  g.add(box(1.1, 0.08, 0.14, M.red, { x: 0.95, y: my + 1.2, z: 1.5 }));
  for (const [dx, dy, dz, s] of [[0, 5.45, 0, 1.7], [-1.1, 3.0, 0.5, 1.5], [0.9, 2.3, -0.9, 1.4], [-0.5, 4.2, 0.7, 1.3], [-1.4, 0.8, 0.3, 1.2]] as const) {
    g.add(tree({ x: dx, z: dz, y: dy, s }));
  }
  // Rainbow staircase climbing the front of the cliff to the cave mouth, with rails.
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    g.add(box(1.0, (i + 1) * 0.16, 0.2, RAINBOW[Math.floor(i / 2) % RAINBOW.length], { x: 0.95, z: 3.5 - i * 0.2 }));
  }
  for (const sx of [0.42, 1.48]) g.add(beam([sx, 0.15, 3.6], [sx, my + 0.2, 1.7], 0.05, M.white));
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
    for (let k = 0; k < 4; k++) g.add(cylinder(0.07, 0.075, 0.3, k % 2 ? M.white : M.red, { x: sx, z: -0.1, y: 0.3 + k * 0.3, segments: 8 }));
    g.add(cylinder(0.12, 0.1, 0.04, CREAM, { x: sx, z: -0.1, y: 1.5, segments: 8 }));
    g.add(cylinder(0.05, 0.06, 0.34, M.white, { x: sx, z: -0.1, y: 1.54, segments: 8 }));
    g.add(onion(0.1, DOME_RED, { x: sx, z: -0.1, y: 1.88 }));
  }
  return g;
}

/** Elevated monorail on pillars with a moving train. */
function monorail(anim: Animator, path: [number, number][]): THREE.Group {
  const g = group();
  const Y = 1.3;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, az] = path[i - 1];
    const [bx, bz] = path[i];
    g.add(beam([ax, Y, az], [bx, Y, bz], 0.24, TRACK));
    const len = Math.hypot(bx - ax, bz - az);
    total += len;
    const n = Math.floor(len / 2);
    for (let k = 0; k <= n; k++) {
      const t = n === 0 ? 0 : k / n;
      const px = ax + (bx - ax) * t;
      const pz = az + (bz - az) * t;
      if (len > 1.2 && !(Math.abs(px - 1.2) < 1.1 && pz > -3.5)) g.add(box(0.22, Y - 0.12, 0.22, TRACK, { x: px, z: pz }));
    }
  }
  const trainCar = () => {
    const c = group({ y: Y + 0.12 });
    c.add(box(0.46, 0.34, 1.05, M.white));
    c.add(box(0.48, 0.13, 0.95, windowMaterial, { y: 0.12 }));
    c.add(box(0.48, 0.05, 1.05, mat(0x2f6fb5), { y: 0.03 }));
    return c;
  };
  const spec: [number, number][] = [[3, 0], [2, 0.5]];
  spec.forEach(([cars, off]) => {
    for (let i = 0; i < cars; i++) g.add(anim.follow(trainCar(), path, 1.3, off - (i * 1.1) / total));
  });
  return g;
}

/** Shallow segmental-arch bridge: white arched body, asphalt deck and rails following its crown. Ends sit flush with the road (y 0.05); the crown stays low so lane cars crossing it are not buried. */
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
  const strip = (lo: number, hi: number): [number, number][] => [
    ...xs.map((x, i): [number, number] => [x, crown[i] + lo]),
    ...xs.map((x, i): [number, number] => [x, crown[i] + hi]).reverse(),
  ];
  g.add(profile(strip(-0.005, 0.02), w - 0.2, M.asphalt));
  for (const s of [-1, 1]) g.add(profile(strip(0.02, 0.11), 0.05, M.steel, { z: s * (w / 2 - 0.05) }));
  return g;
}

export default function build(): CityScene {
  const rand = rng(101);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: M.asphalt, side: mat(0x8a5a3c) }));

  // --- Ground blocks (everything else stays asphalt road). Overlapping blocks differ in height so their tops never z-fight. ---
  const block = (x: number, z: number, w: number, d: number, m: THREE.Material = M.pavement, h = 0.04) => root.add(patch(w, d, m, { x, z, h }));
  block(-7.4, -1.4, 4.6, 6.4);
  block(-7.6, -7.3, 4.3, 4.4, M.grass, 0.05);
  block(-7.4, -2.4, 3.8, 3.2, M.grass, 0.05);
  block(-3.1, -6.0, 5.4, 7.2, M.grassDark, 0.055);
  block(-3.3, 3.3, 2.6, 8.2);
  block(-3.3, 8.6, 2.6, 2.2, M.grass);
  block(-7.4, 6.2, 4.6, 7.0);
  block(3.9, -7.0, 4.0, 5.2);
  block(6.4, 5.8, 6.6, 7.6);
  block(-0.35, 4.0, 0.9, 11.4, M.pavement);
  block(8.4, -9.0, 2.4, 1.6, M.pavement);
  block(5.6, -4.6, 2.6, 2.2, M.pavement, 0.045);

  // --- River confluence: main leg, east leg, back tributary ---
  const water = (x1: number, z1: number, x2: number, z2: number, w: number) =>
    root.add(road(x1, z1, x2, z2, w, { lines: false, material: waterMat(0x4fa3d1) }));
  water(1.2, -3.5, 1.2, 9.95, 1.8);
  water(0.3, -2.6, 9.95, -2.6, 1.8);
  water(1.2, -9.95, 1.2, -3.0, 1.2);
  const bank = (x1: number, z1: number, x2: number, z2: number) =>
    root.add(road(x1, z1, x2, z2, 0.14, { lines: false, material: BANK }));
  bank(0.22, -3.5, 0.22, 9.95);
  bank(2.18, -1.6, 2.18, 9.95);
  bank(2.18, -1.62, 9.95, -1.62);
  bank(2.1, -3.58, 9.95, -3.58);
  bank(0.54, -9.95, 0.54, -3.58);
  bank(1.86, -9.95, 1.86, -3.58);

  // Bridges.
  root.add(archBridge({ x: 1.2, z: 6.0 }, 3.0, 1.1));
  root.add(archBridge({ x: 6.8, z: -2.6, ry: Math.PI / 2 }, 3.0, 1.0));
  root.add(road(-2.2, 6.0, -0.3, 6.0, 1.1));
  root.add(road(2.7, 6.0, 9.7, 6.0, 1.1));
  root.add(crosswalk(3.6, 6.0, 1.1, { ry: Math.PI / 2 }));
  root.add(crosswalk(-1.0, 3.0, 1.0));

  // Boats.
  root.add(anim.bob(anim.follow(boat({ color: 0xe8e2d4, len: 0.9 }), [[1.2, 9.0], [1.2, 0.5]], 0.45, 0.2) as THREE.Group, 0.01, 1.2));
  root.add(anim.follow(boat({ color: 0xd9726a, len: 0.8 }), [[3.0, -2.6], [8.8, -2.6]], 0.4, 0.5));

  // --- Landmarks ---
  root.add(petronas({ x: -8.6, z: 0.2, ry: Math.PI / 4 }));
  root.add(petronas({ x: -6.4, z: -2.0, ry: Math.PI / 4 }));
  // Suria KLCC podium wrapping the tower bases: banded mall block, glass-domed atrium and a fountain pool at the front.
  root.add(building({ x: -7.5, z: -0.9, w: 4.0, d: 2.2, h: 0.55, ry: Math.PI / 4, wall: mat(0xcfd6dc), windows: 'bands', floorH: 0.28, plain: true }));
  root.add(group({ x: -7.5, z: -0.9, ry: Math.PI / 4 },
    cylinder(0.48, 0.5, 0.14, SILVER, { y: 0.55, segments: 16 }),
    cylinder(0.49, 0.49, 0.08, windowMaterial, { y: 0.58, segments: 16 }),
    dome(0.44, BLUE_GLASS_B, { y: 0.69, segments: 16, squash: 0.8 }),
    cylinder(0.42, 0.42, 0.04, CREAM, { y: 0.04, z: 1.6, segments: 20 }),
    cylinder(0.34, 0.34, 0.035, waterMat(0x4fa3d1), { y: 0.04, z: 1.6, segments: 20 }),
  ));
  root.add(skybridge({ x: -7.5, z: -0.9, ry: Math.PI / 4 }, 1.9));
  root.add(klTower({ x: -3.2, z: -4.4 }));
  root.add(merdeka({ x: 3.9, z: -7.5, ry: 0.4 }));
  root.add(sultanAbdulSamad({ x: -3.3, z: 3.2 }));
  root.add(batuCaves(8.0, -7.4));
  root.add(murugan({ x: 7.0, z: -5.7, ry: Math.PI / 4 }));
  // Pavement forecourt so the mosque stands on a platform clear of the tower-park lawn.
  root.add(patch(2.1, 1.6, M.pavement, { x: -0.95, z: -2.2, h: 0.065 }));
  root.add(masjidJamek({ x: -0.95, y: 0.065, z: -2.2 }));

  // --- City fabric ---
  root.add(officeTower(-8.1, 6.6, 1.7, 1.7, 3.6, mat(0xc4673f)));
  root.add(officeTower(-8.5, 3.9, 1.3, 1.5, 4.7, mat(0xd7dde3)));
  root.add(oldBlock({ x: -6.0, z: 8.5 }, 3.4, 1.7));
  root.add(oldBlock({ x: -5.7, z: 4.9 }, 1.8, 2.4));
  root.add(officeTower(4.7, 2.0, 1.5, 1.5, 4.8, mat(0xcfd6dc)));
  root.add(officeTower(6.7, 3.0, 1.5, 1.6, 3.9, mat(0xc9d1d8)));
  root.add(officeTower(3.6, 9.15, 1.5, 1.2, 2.6, mat(0xa9bfd0, { roughness: 0.2, metalness: 0.4 })));
  // Shophouse rows sit clear of the z=6 road (z 5.45..6.55).
  for (let i = 0; i < 5; i++) root.add(shophouse(4.3 + i * 1.05, 7.5, i));
  for (let i = 0; i < 3; i++) root.add(shophouse(8.9, 3.0 + i * 0.98, i + 2, Math.PI / 2));
  root.add(building({ x: 3.7, z: -4.6, w: 1.4, d: 1.0, h: 0.9, wall: mat(0xe9d3a3), roof: 'gable', roofMat: TERRA, roofH: 0.4, windows: 'none' }));

  // Monorail running beside the river and over the east leg.
  root.add(monorail(anim, [[-1.4, 9.0], [-1.4, 0.2], [-0.6, -0.8], [9.2, -0.8]]));

  // --- Vegetation ---
  root.add(row(-9.2, -4.8, -5.6, -4.8, 5, (x, z, i) => T(x, z, 1.0 + (i % 2) * 0.2, i % 2 ? 'round' : 'palm')));
  root.add(scatter({ x: -7.6, z: -7.4, w: 3.8, d: 3.8 }, 10, rand, (x, z, i) => T(x, z, 1.1, i % 3 ? 'round' : 'palm')));
  root.add(scatter({ x: -3.0, z: -6.4, w: 4.4, d: 5.4 }, 9, rand, (x, z, i) => T(x, z, 1.1, i % 3 ? 'round' : 'palm')));
  root.add(scatter({ x: 3.9, z: -4.5, w: 2.2, d: 1.2 }, 3, rand, (x, z) => T(x, z, 0.9)));
  root.add(row(-2.4, 9.0, -4.4, 8.4, 4, (x, z) => T(x, z, 1.0, 'palm')));
  root.add(row(-2.1, 0.3, -2.1, 6.9, 5, (x, z) => T(x, z, 0.8, 'palm')));
  root.add(row(3.0, 9.4, 9.2, 9.4, 5, (x, z, i) => T(x, z, 0.9, i % 2 ? 'round' : 'palm')));
  root.add(scatter({ x: 7.3, z: 4.4, w: 2.2, d: 1.4 }, 6, rand, (x, z, i) => T(x, z, 1.0, i % 2 ? 'round' : 'palm')));
  root.add(row(-9.4, 9.4, -7.0, 9.4, 3, (x, z) => T(x, z, 0.9, 'round')));
  // East of the shophouse row (z 2.5..5.5), so the trees stand clear of it.
  root.add(row(9.3, 0.0, 9.3, 2.2, 3, (x, z) => T(x, z, 0.9, 'palm')));
  root.add(scatter({ x: 5.2, z: -9.0, w: 2.2, d: 1.2 }, 4, rand, (x, z, i) => T(x, z, 1.0, i % 2 ? 'round' : 'palm')));

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
  const inRect = (x: number, z: number, cx: number, cz: number, hw: number, hd: number, ry = 0) => {
    const dx = x - cx;
    const dz = z - cz;
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    return Math.abs(dx * c - dz * s) < hw && Math.abs(dx * s + dz * c) < hd;
  };
  // Standing groups: Suria KLCC front (off the podium, the fountain pool and the lamps), the Merdeka forecourt (off the plinth, the house and trees),
  // the Samad arcade lawn edge, the Batu steps' foot and the shophouse five-foot-way.
  const suria = (x: number, z: number) =>
    inRect(x, z, -7.5, -0.9, 2.15, 1.25, Math.PI / 4) || Math.hypot(x + 6.37, z - 0.23) < 0.65 || offTree(x, z);
  root.add(scatter({ x: -8.4, z: 0.9, w: 3.0, d: 0.7 }, 7, rand, pave, suria));
  const forecourt = (x: number, z: number) =>
    inRect(x, z, 3.9, -7.5, 1.55, 1.25, 0.4) || inRect(x, z, 3.7, -4.6, 0.8, 0.65) || Math.hypot(x - 7, z + 5.7) < 1.2 || offTree(x, z);
  root.add(scatter({ x: 2.1, z: -5.7, w: 4.2, d: 1.5 }, 8, rand, pave, forecourt));
  root.add(scatter({ x: -4.3, z: 6.65, w: 1.8, d: 0.7 }, 4, rand, pave, offTree));
  const batuFoot = (x: number, z: number) => inRect(x, z, 7, -5.7, 0.95, 0.75, Math.PI / 4) || (x > 8.3 && x < 9.6 && z < -3.7);
  root.add(scatter({ x: 7.0, z: -4.6, w: 1.4, d: 0.8 }, 4, rand, (x, z, i) => kl(x, z, i + 2, 0, i === 1), batuFoot));
  root.add(scatter({ x: 4.0, z: 8.6, w: 4.9, d: 0.5 }, 6, rand, pave, offTree));

  // Walkers on closed loops over paved ground, clear of the lanes.
  const walk = (loop: [number, number][], y: number, n: number, speed: number, seed: number, brolly = -1) => {
    for (let i = 0; i < n; i++) root.add(anim.follow(kl(0, 0, seed + i, y, i === brolly), loop, speed, i / n, true));
  };
  walk([[-9.2, 1.55], [-5.6, 1.55], [-5.6, 1.7], [-9.2, 1.7]], 0.04, 2, 0.26, 0);
  walk([[4.7, -5.35], [5.7, -5.35], [5.7, -4.1], [4.7, -4.1]], 0.045, 2, 0.22, 3, 1);
  walk([[-4.2, 6.85], [-2.6, 6.85], [-2.6, 7.2], [-4.2, 7.2]], 0.04, 1, 0.24, 6);
  walk([[7.1, -4.35], [8.2, -4.35], [8.2, -3.95], [7.1, -3.95]], 0, 1, 0.22, 7);
  walk([[4.5, 8.75], [8.3, 8.75], [8.3, 8.9], [4.5, 8.9]], 0.04, 2, 0.26, 8);

  // Traffic.
  const lanes: [number, number][][] = [
    [[-1.7, 9.0], [-1.7, 0.3]],
    [[-1.0, 0.3], [-1.0, 9.0]],
    [[-9.0, 2.35], [-1.0, 2.35]],
  ];
  lanes.forEach((path, li) => {
    for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: 0.05 }), path, 1.1, i / 3 + li * 0.17));
  });
  root.add(anim.follow(car({ y: 0.05, taxi: true }), [[9.0, 5.55], [2.2, 5.55]], 1.0, 0.1));
  root.add(anim.follow(car({ y: 0.05 }), [[2.5, 6.45], [9.0, 6.45]], 1.0, 0.6));

  return { root, update: anim.update };
}
