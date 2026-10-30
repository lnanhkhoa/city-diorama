import * as THREE from 'three';
import {
  Animator, M, archHole, area, beam, box, building, bus, car, cone, createBase, crosswalk, cylinder, dome, group, hipRoof, gableRoof, lamp, lampMaterial,
  floodMat, mat, mergeStatic, patch, person, prism, profile, rng, road, row, scatter, screen, shape, sphere, tree, vietnamFlag, waterMat,
  windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';
import MOTORBIKE from '../shapes/motorbike.shape';

// Layout follows assets/hanoi.png (positions read off the poster through a homography fitted to the plinth
// corners): Long Bien runs the full left (x = -10) edge; Hoan Kiem Lake fills the middle with the Turtle Tower
// island; the Opera House and a row of Old Quarter houses line the back (z = -10) edge. Along the front
// (z = +10) edge the Flag Tower and the Ho Chi Minh Mausoleum stand as a balanced pair, the same size and the
// same distance from the edge. The mausoleum faces the lake road across a courtyard with the flagpole on its axis.

const RUST = mat(0xb9552c, { roughness: 0.7, metalness: 0.25 });
const RUST_DARK = mat(0x7a4a36, { roughness: 0.75, metalness: 0.2 });
const PIER_STONE = mat(0xa29d94, { roughness: 0.9 });
const TILE = mat(0xd0623a, { roughness: 0.8 });
const BRICK = mat(0x9c4f37, { roughness: 0.85 });
const BRICK_DARK = mat(0x7a3a2a, { roughness: 0.85 });
const BRICK_FLOOR = mat(0xb4644a, { roughness: 0.9 });
const BANK_STONE = mat(0xd8c98e);
const SHUTTER = mat(0x3f7a5a, { roughness: 0.8 });
const IRON_DARK = mat(0x3b4a3f, { roughness: 0.6, metalness: 0.3 });
// Hoan Kiem's water is an opaque jade green from its algae, not clear turquoise.
const LAKE = waterMat(0x6f9e72);
const ASPHALT = mat(0x8a8d90, { roughness: 0.95, surface: 'road' });
const PLAZA = mat(0xd9d5c8);
const LAWN_EDGE = mat(0xf1eee4);
const VILLA_WALL = mat(0xf0dcae);
const HOUSE_COLORS = [0xf0d27a, 0x8fb6d8, 0x9cc48a, 0xe7a99a, 0xe8a05a, 0xf3e3b0, 0xe6c15a, 0xb7d4a0, 0xd98a6a, 0x7fa8d0];
const AWNINGS = [0xc8433a, 0x3d6fb6, 0x4a9a5b, 0xe0b43a, 0xf4f4f0];
// Scooter body colours: the Rodin asset's red first, then common Hanoi scooter paints.
const BIKE_COLORS = [0xcc2e20, 0xcc2e20, 0x3d6fb6, 0xf4f4f0, 0x7a828c, 0xe0b43a, 0x4a9a5b];
const SIGN_COLORS = [0xc8433a, 0xe0b43a, 0x3d6fb6, 0x4a9a5b, 0xf4f4f0];

// Streets: [x1, z1, x2, z2]; width 0.9. Trees and props are kept clear of these.
const ROAD_W = 0.9;
const ROADS: [number, number, number, number][] = [
  [-6.8, -9.8, -6.8, 9.8], // beside Long Bien
  [-6.8, -7.0, 9.8, -7.0], // Old Quarter street along the lake's north shore
  [-6.8, 3.3, 7.0, 3.3], // lake south shore, between the lake and Ba Dinh
  [7.0, 3.3, 8.3, 2.0], // corner toward the east side
  [8.3, 2.0, 8.3, -7.0], // up the east side to the Old Quarter street
];

function onRoad(x: number, z: number, margin = 0.25): boolean {
  const h = ROAD_W / 2 + margin;
  return ROADS.some(([x1, z1, x2, z2]) => {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - x1 - t * dx, z - z1 - t * dz) < h;
  });
}

const BIKE_DARK = mat(0x2a2527, { roughness: 0.8 });
const BIKE_HAT = mat(0xd2ac73, { roughness: 0.7 });

// Two riders on the Rodin scooter from .rodin/motorbike.glb (+z is forward), pre-merged, painted as the asset:
// tyres, seat and the dark-clad rider share one charcoal, the conical hat is straw, and only the scooter body
// takes the per-mover colour. 4 draws per mover including the headlights.
function motorbikePair(color: number): THREE.Group {
  const g = group();
  const body = mat(color, { roughness: 0.45 });
  for (const [ox, oz] of [[-0.1, 0.13], [0.1, -0.13]] as const) {
    g.add(shape(MOTORBIKE, [BIKE_DARK, BIKE_DARK, body, BIKE_HAT], { x: ox, z: oz, height: 0.34 }));
    g.add(box(0.035, 0.03, 0.02, lampMaterial, { x: ox, y: 0.12, z: oz + 0.17 }));
  }
  mergeStatic(g);
  return g;
}

// Hanoi pedestrians: pastel and white ao dai, light shirts, olive and khaki, many in a straw non la.
const NON_LA = mat(0xefe0a8);
const HANOI_CLOTHES = [0xf4f0e6, 0xf0c8d0, 0xbcd6ea, 0x7a7a4a, 0xc2b280, 0xe8e2d0, 0x9cc4a0, 0xd9a05a, 0xfaf7ee, 0xa7c7a0];
function hanoian(x: number, z: number, i: number, y: number): THREE.Group {
  const g = group({ x, y, z, ry: (i * 2.399 + x * 3.1 + z * 1.7) % (Math.PI * 2) });
  g.add(person({ color: HANOI_CLOTHES[i % HANOI_CLOTHES.length] }));
  if (i % 3 !== 1) g.add(cone(0.08, 0.045, NON_LA, { y: 0.195, segments: 8 }));
  return g;
}

function vendor(x: number, z: number, ry: number): THREE.Group {
  const g = group({ x, z, ry });
  const shirt = [0x8a6a4a, 0x4a7a5a, 0xc8433a, 0x3d6fb6][Math.abs(Math.round(x * 7 + z * 3)) % 4];
  g.add(person({ color: shirt }));
  g.add(cone(0.08, 0.045, NON_LA, { y: 0.195, segments: 8 }));
  g.add(box(0.3, 0.012, 0.012, M.wood, { y: 0.14 }));
  for (const sx of [-1, 1]) g.add(cylinder(0.04, 0.03, 0.04, mat(0xc99a4a), { x: sx * 0.15, y: 0.08, segments: 6 }));
  return g;
}

function tubeHouse(x: number, z: number, w: number, d: number, h: number, color: number, hip: boolean): THREE.Group {
  const g = group({ x, z });
  const wall = mat(color);
  const floorH = 0.5;
  const floors = Math.max(2, Math.floor((h - 0.1) / floorH));
  const hash = Math.abs(Math.round(x * 5 + z * 3));
  g.add(building({ w, d, h, wall, windows: 'grid', roof: 'flat', floorH, plain: true, shop: AWNINGS[hash % AWNINGS.length] }));
  // Blade sign over the pavement, alternating sides.
  const side = hash % 2 === 0 ? 1 : -1;
  g.add(screen(0.2, 0.34, SIGN_COLORS[(hash + 1) % SIGN_COLORS.length], { x: side * (w / 2 - 0.05), y: 0.45, z: d / 2 + 0.12, ry: Math.PI / 2 }));
  // Green shutters on every upper floor, iron balconies on alternate floors.
  for (let f = 1; f < floors; f++) {
    const y = 0.25 + f * floorH;
    for (const sx of [-1, 1]) g.add(box(0.05, 0.22, 0.02, SHUTTER, { x: sx * w * 0.38, y: y + 0.06, z: d / 2 + 0.02 }));
    if (f % 2 === 1) {
      g.add(box(w * 0.9, 0.035, 0.16, IRON_DARK, { y: y - 0.02, z: d / 2 + 0.08 }));
      g.add(box(w * 0.9, 0.1, 0.015, IRON_DARK, { y, z: d / 2 + 0.155 }));
    }
  }
  // Terracotta roofs: gable along the street on most, hipped on the rest.
  if (hip) g.add(hipRoof(w + 0.1, d + 0.1, 0.36, TILE, { y: h }));
  else g.add(gableRoof(w + 0.1, d + 0.1, 0.32, TILE, { y: h }));
  return g;
}

// Small colonial house: cream walls, orange hipped roof.
function villa(x: number, z: number, w: number, d: number, ry = 0): THREE.Group {
  return building({ x, z, ry, w, d, h: 0.85, wall: VILLA_WALL, trim: mat(0xfaf2dc), roof: 'hip', roofMat: TILE, roofH: 0.45, windows: 'grid', floorH: 0.42 });
}

// Thap Rua, as in the poster: a square three-storey pale stone tower narrowing upward, tall arched openings
// on every face (two per face on the lower storeys, one on the third), corner pilasters, projecting two-step
// cornices with corner finials, then a small top storey ringed by a crenellated parapet under a crown.
function turtleTower(p: Place): THREE.Group {
  const g = group(p);
  // Plain by day, floodlit warm at night like the real tower.
  const wall = floodMat(0xdcd8cd, 0xffd9a0, 0.45, { roughness: 0.85 });
  const ledge = floodMat(0xb7b2a5, 0xffc888, 0.35, { roughness: 0.85 });
  const stain = floodMat(0xc8c3b5, 0xffd9a0, 0.4, { roughness: 0.9 });
  g.add(box(0.64, 0.06, 0.64, ledge));
  // [width, height, arches per face]
  const storeys: [number, number, number][] = [[0.5, 0.44, 2], [0.4, 0.34, 2], [0.31, 0.27, 1]];
  let y = 0.06;
  storeys.forEach(([w, h, n], i) => {
    g.add(box(w, h, w, i === 0 ? stain : wall, { y }));
    const aw = n === 2 ? w * 0.28 : w * 0.42;
    for (let f = 0; f < 4; f++) {
      const face = group({ ry: (f * Math.PI) / 2 });
      for (let k = 0; k < n; k++) {
        const x = n === 2 ? (k === 0 ? -1 : 1) * w * 0.22 : 0;
        face.add(profile(archHole(0, aw, h * 0.5), 0.012, mat(0x4b4a47), { x, y: y + h * 0.08, z: w / 2 }));
      }
      for (const sx of [-1, 1]) face.add(box(0.035, h, 0.02, ledge, { x: sx * (w / 2 - 0.0175), y, z: w / 2 }));
      g.add(face);
    }
    y += h;
    g.add(box(w + 0.1, 0.035, w + 0.1, ledge, { y }));
    g.add(box(w + 0.05, 0.03, w + 0.05, wall, { y: y + 0.035 }));
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) g.add(cone(0.02, 0.07, ledge, { x: sx * (w / 2 + 0.03), y: y + 0.035, z: sz * (w / 2 + 0.03), segments: 4 }));
    }
    y += 0.065;
  });
  // Top storey: crenellated parapet around a small lantern with a crown.
  const t = 0.25;
  g.add(box(t, 0.1, t, wall, { y }));
  for (let f = 0; f < 4; f++) {
    const face = group({ ry: (f * Math.PI) / 2 });
    for (const x of [-0.09, 0, 0.09]) face.add(box(0.045, 0.05, 0.03, wall, { x, y: y + 0.1, z: t / 2 - 0.015 }));
    g.add(face);
  }
  g.add(box(0.12, 0.11, 0.12, wall, { y: y + 0.1 }));
  g.add(box(0.16, 0.025, 0.16, ledge, { y: y + 0.21 }));
  g.add(cone(0.06, 0.09, ledge, { y: y + 0.235, segments: 4 }));
  return g;
}

// The Huc bridge: a long, gently arched red deck from shore point `a` to island point `b`, post-and-rail
// balustrades on both sides, red posts standing in the water with knee braces under the deck, and lamps
// at both ends.
function theHucBridge(a: [number, number], b: [number, number]): THREE.Group {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz);
  // Local +x runs from a to b.
  const g = group({ x: a[0], z: a[1], ry: Math.atan2(-dz, dx) });
  // Plain red by day, glowing red at night as the real bridge is lit.
  const red = floodMat(0xd0402f, 0xff3a22, 0.6, { roughness: 0.5 });
  const n = 14;
  const half = 0.2;
  const yAt = (t: number) => 0.12 + Math.sin(Math.PI * t) * 0.2;
  let prev: [number, number] = [0, yAt(0)];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const cur: [number, number] = [len * t, yAt(t)];
    const seg = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]);
    const deck = box(seg + 0.012, 0.045, half * 2, red, { x: (prev[0] + cur[0]) / 2, y: (prev[1] + cur[1]) / 2 - 0.045 });
    deck.rotation.z = Math.atan2(cur[1] - prev[1], cur[0] - prev[0]);
    g.add(deck);
    for (const sz of [-1, 1]) {
      const zz = sz * half;
      g.add(beam([prev[0], prev[1] + 0.15, zz], [cur[0], cur[1] + 0.15, zz], 0.03, red));
      g.add(beam([prev[0], prev[1] + 0.07, zz], [cur[0], cur[1] + 0.07, zz], 0.018, red));
      g.add(box(0.03, 0.15, 0.03, red, { x: cur[0], y: cur[1], z: zz }));
      if (i % 2 === 0 && i < n) {
        g.add(box(0.045, cur[1] - 0.07, 0.045, red, { x: cur[0], y: 0.02, z: sz * 0.17 }));
        for (const ox of [-0.09, 0.09]) g.add(beam([cur[0], cur[1] - 0.16, sz * 0.17], [cur[0] + ox, cur[1] - 0.06, sz * 0.17], 0.025, red));
      }
    }
    prev = cur;
  }
  for (const sz of [-1, 1]) {
    g.add(lamp({ x: -0.06, y: 0.1, z: sz * (half + 0.06) }));
    g.add(lamp({ x: len + 0.06, y: yAt(1), z: sz * (half + 0.06) }));
  }
  return g;
}

// Flag Tower of Hanoi: three stepped brick terraces with brick-paved walks, continuous parapets with
// posts and arched gates, a stair up the +x side; a tapering octagonal shaft with rows of small windows,
// a wider lantern head with an overhanging cap, and the flag.
function flagTower(p: Place): THREE.Group {
  const g = group(p);
  const tiers: [number, number][] = [[4.2, 0.6], [3.2, 0.55], [2.2, 0.5]];
  let y = 0;
  tiers.forEach(([s, h], i) => {
    g.add(box(s, h, s, BRICK, { y }));
    g.add(box(s - 0.04, 0.02, s - 0.04, BRICK_FLOOR, { y: y + h }));
    for (let f = 0; f < 4; f++) {
      const face = group({ ry: (f * Math.PI) / 2 });
      // Arched gates: two per face on the bottom terrace, one framed gate on the middle one.
      if (i === 0) {
        for (const sx of [-1, 1]) face.add(profile(archHole(0, 0.34, h * 0.45), 0.02, M.dark, { x: sx * s * 0.25, y, z: s / 2 }));
      } else if (i === 1) {
        face.add(box(0.46, 0.4, 0.03, BRICK_FLOOR, { y, z: s / 2 }));
        face.add(profile(archHole(0, 0.28, 0.18), 0.02, M.dark, { y, z: s / 2 + 0.02 }));
      }
      // Parapet: a low continuous wall along the walk with a post every ~0.35.
      face.add(box(s, 0.1, 0.05, BRICK, { y: y + h, z: s / 2 - 0.025 }));
      face.add(box(s + 0.02, 0.025, 0.08, BRICK_DARK, { y: y + h + 0.1, z: s / 2 - 0.025 }));
      const posts = Math.round(s / 0.35);
      for (let k = 0; k <= posts; k++) {
        face.add(box(0.06, 0.16, 0.06, BRICK_DARK, { x: -s / 2 + (k * s) / posts, y: y + h, z: s / 2 - 0.025 }));
      }
      g.add(face);
    }
    y += h;
  });
  // Stair up the +x face to the first walk, near the +z corner, with side walls.
  const sh = tiers[0][1];
  const sx0 = tiers[0][0] / 2;
  const steps = 6;
  const run = 0.65;
  for (let k = 0; k < steps; k++) {
    g.add(box(run / steps, (sh * (steps - k)) / steps, 0.46, BRICK_FLOOR, { x: sx0 + ((k + 0.5) * run) / steps, z: 0.95 }));
  }
  for (const sz of [-1, 1]) {
    g.add(profile([[0, 0], [run, 0], [0, sh + 0.1]], 0.05, BRICK, { x: sx0, z: 0.95 + sz * 0.255 - 0.025 }));
  }
  // Octagonal shaft with staggered rows of small windows.
  const shaftH = 3.0;
  g.add(cylinder(0.36, 0.44, shaftH, BRICK, { y, segments: 8, ry: Math.PI / 8 }));
  g.add(box(0.16, 0.26, 0.03, M.dark, { y: 0.02 + y, z: 0.43 }));
  for (let lvl = 0; lvl < 5; lvl++) {
    for (let f = 0; f < 4; f++) {
      const a = (f * Math.PI) / 2 + (lvl % 2) * (Math.PI / 4);
      const r = 0.43 - lvl * 0.018;
      g.add(box(0.07, 0.13, 0.03, M.dark, { x: Math.sin(a) * r, y: y + 0.45 + lvl * 0.52, z: Math.cos(a) * r, ry: a }));
    }
  }
  y += shaftH;
  // Lantern head: wider than the shaft top, lit windows, overhanging flat cap.
  g.add(cylinder(0.44, 0.38, 0.12, BRICK_DARK, { y, segments: 8, ry: Math.PI / 8 }));
  y += 0.12;
  g.add(cylinder(0.42, 0.42, 0.42, BRICK, { y, segments: 8, ry: Math.PI / 8 }));
  for (let f = 0; f < 8; f++) {
    const a = (f * Math.PI) / 4;
    g.add(box(0.12, 0.2, 0.02, windowMaterial, { x: Math.sin(a) * 0.4, y: y + 0.12, z: Math.cos(a) * 0.4, ry: a }));
  }
  y += 0.42;
  g.add(cylinder(0.52, 0.5, 0.07, BRICK_DARK, { y, segments: 8, ry: Math.PI / 8 }));
  g.add(cylinder(0.14, 0.16, 0.14, BRICK, { y: y + 0.07, segments: 8 }));
  g.add(vietnamFlag({ y: y + 0.21, h: 1.4, s: 1.5 }));
  return g;
}

// Ho Chi Minh Mausoleum: a broad three-step grey podium, a hall of square columns in front of dark red
// walls, a lettered entablature on the +z face and a stepped flat roof.
function mausoleum(p: Place): THREE.Group {
  const g = group(p);
  const stone = [mat(0xb3b1aa), mat(0xa6a49e), mat(0x9a9893)];
  const col = mat(0xc4c2bb, { roughness: 0.7 });
  const tiers: [number, number, number][] = [[4.8, 4.6, 0.32], [4.2, 4.0, 0.32], [3.6, 3.4, 0.32]];
  let y = 0;
  tiers.forEach(([w, d, h], i) => {
    g.add(box(w, h, d, stone[i], { y }));
    y += h;
  });
  // Narrow side stair down the +x flank, near the back corner.
  for (let k = 0; k < 3; k++) g.add(box(0.2, 0.32 * (3 - k), 0.7, stone[k], { x: 2.5 + k * 0.2, z: -1.8 }));
  const hallH = 1.1;
  g.add(box(2.7, hallH, 2.5, mat(0x7a3a30, { roughness: 0.8 }), { y }));
  for (let i = 0; i <= 8; i++) {
    const x = -1.4 + i * 0.35;
    g.add(box(0.14, hallH, 0.14, col, { x, y, z: 1.42 }));
    g.add(box(0.14, hallH, 0.14, col, { x, y, z: -1.42 }));
  }
  for (let i = 1; i < 8; i++) {
    const z = -1.42 + i * 0.355;
    g.add(box(0.14, hallH, 0.14, col, { x: 1.4, y, z }));
    g.add(box(0.14, hallH, 0.14, col, { x: -1.4, y, z }));
  }
  y += hallH;
  g.add(box(3.1, 0.24, 3.1, stone[0], { y }));
  g.add(box(1.5, 0.09, 0.02, mat(0x8a2f28), { y: y + 0.08, z: 1.56 }));
  y += 0.24;
  g.add(box(2.7, 0.14, 2.7, stone[1], { y }));
  y += 0.14;
  g.add(box(2.2, 0.12, 2.2, stone[2], { y }));
  return g;
}

// Opera House: yellow two-storey block, a projecting central bay of tall arches between columns under a
// pediment, a grey slate roof with two domed corner turrets carrying spires, and a flag on the ridge.
function operaHouse(p: Place): THREE.Group {
  const g = group(p);
  const yellow = mat(0xf2d27a);
  const trim = mat(0xf6efd6);
  const slate = mat(0x6f7880, { roughness: 0.6 });
  g.add(box(2.6, 0.1, 1.7, trim));
  g.add(box(2.6, 1.2, 1.6, yellow, { y: 0.1 }));
  g.add(box(2.7, 0.08, 1.7, trim, { y: 1.3 }));
  g.add(box(2.7, 0.04, 1.7, trim, { y: 0.68 }));
  // Wing windows on the front and sides: arched below, rectangular above.
  for (const x of [-1.1, -0.82, 0.82, 1.1]) {
    g.add(profile(archHole(0, 0.14, 0.2), 0.02, windowMaterial, { x, y: 0.2, z: 0.8 }));
    g.add(box(0.13, 0.3, 0.03, windowMaterial, { x, y: 0.82, z: 0.8 }));
  }
  for (const sx of [-1, 1]) {
    for (const z of [-0.45, 0, 0.45]) {
      g.add(box(0.03, 0.3, 0.13, windowMaterial, { x: sx * 1.3, y: 0.82, z }));
      g.add(box(0.03, 0.3, 0.13, windowMaterial, { x: sx * 1.3, y: 0.24, z }));
    }
  }
  // Central bay: tall arches between columns, entablature, balustrade and pediment.
  g.add(box(1.4, 1.2, 0.3, yellow, { y: 0.1, z: 0.9 }));
  for (const x of [-0.42, 0, 0.42]) g.add(profile(archHole(0, 0.28, 0.75), 0.02, windowMaterial, { x, y: 0.12, z: 1.05 }));
  for (const x of [-0.63, -0.21, 0.21, 0.63]) g.add(cylinder(0.045, 0.05, 1.12, trim, { x, y: 0.1, z: 1.1, segments: 8 }));
  g.add(box(1.5, 0.1, 0.4, trim, { y: 1.22, z: 0.92 }));
  g.add(profile([[-0.72, 0], [0.72, 0], [0, 0.3]], 0.06, trim, { y: 1.32, z: 1.04 }));
  // Slate roof with a ridge crest, domed turrets with spires on the front corners.
  g.add(hipRoof(2.6, 1.6, 0.5, slate, { y: 1.38 }));
  g.add(box(0.9, 0.08, 0.16, slate, { y: 1.8 }));
  for (const sx of [-1, 1]) {
    g.add(box(0.46, 0.28, 0.46, yellow, { x: sx * 1.02, y: 1.38, z: 0.5 }));
    g.add(dome(0.27, slate, { x: sx * 1.02, y: 1.66, z: 0.5, squash: 1.35, segments: 8 }));
    g.add(cylinder(0.005, 0.025, 0.28, M.dark, { x: sx * 1.02, y: 2.02, z: 0.5, segments: 4 }));
  }
  g.add(vietnamFlag({ y: 1.86, h: 0.75, s: 0.85 }));
  return g;
}

// Long Bien: rust-red cantilever truss on solid stone piers along the whole left edge. The truss is deepest
// over the piers and at the back end, dipping at mid-span and down to the deck at the front corner.
const BRIDGE_X = -9.0;
const DECK_Y = 1.3;
const BRIDGE_Z0 = -9.6;
const BRIDGE_Z1 = 9.6;
function longBien(): THREE.Group {
  const g = group({ x: BRIDGE_X });
  const spans = 6;
  const L = (BRIDGE_Z1 - BRIDGE_Z0) / spans;
  const panels = 8;
  const zm = (BRIDGE_Z0 + BRIDGE_Z1) / 2;
  g.add(box(1.0, 0.1, BRIDGE_Z1 - BRIDGE_Z0, RUST_DARK, { y: DECK_Y - 0.1, z: zm }));
  for (const sx of [-0.16, 0.16]) g.add(box(0.03, 0.03, BRIDGE_Z1 - BRIDGE_Z0, M.dark, { x: sx, y: DECK_Y, z: zm }));
  for (let z = BRIDGE_Z0 + 0.15; z < BRIDGE_Z1; z += 0.3) g.add(box(0.5, 0.02, 0.08, M.wood, { y: DECK_Y - 0.01, z }));
  for (let k = 0; k <= spans; k++) {
    const z = BRIDGE_Z0 + k * L;
    g.add(box(0.8, DECK_Y - 0.2, 0.5, PIER_STONE, { z }));
    g.add(box(1.05, 0.1, 0.6, PIER_STONE, { y: DECK_Y - 0.2, z }));
  }
  for (let s = 0; s < spans; s++) {
    const za = BRIDGE_Z0 + s * L;
    const last = s === spans - 1;
    const depth = (t: number) => 0.3 + 0.9 * (last && t > 0.5 ? 0 : Math.abs(2 * t - 1)) ** 0.9;
    const P = (i: number): [number, number] => [za + (i / panels) * L, DECK_Y + depth(i / panels)];
    for (const sx of [-0.42, 0.42]) {
      for (let i = 0; i < panels; i++) {
        const [a, ay] = P(i);
        const [b, by] = P(i + 1);
        g.add(beam([sx, ay, a], [sx, by, b], 0.05, RUST));
        // Diagonals run from the deck at mid-span up toward the deep truss over each pier.
        if (i < panels / 2) g.add(beam([sx, DECK_Y, b], [sx, ay, a], 0.028, RUST));
        else g.add(beam([sx, DECK_Y, a], [sx, by, b], 0.028, RUST));
      }
      for (let i = 0; i <= panels; i++) {
        const [a, ay] = P(i);
        g.add(beam([sx, DECK_Y, a], [sx, ay, a], 0.036, RUST));
      }
      g.add(beam([sx, DECK_Y, za], [sx, DECK_Y, za + L], 0.045, RUST));
    }
    for (let i = 0; i <= panels; i += 2) {
      const [a, ay] = P(i);
      if (ay - DECK_Y > 0.45) g.add(beam([-0.42, ay, a], [0.42, ay, a], 0.03, RUST));
    }
    g.add(box(0.06, 0.06, 0.06, lampMaterial, { x: 0.47, y: DECK_Y + 0.14, z: za + L / 2 }));
  }
  return g;
}

function train(): THREE.Group {
  const g = group();
  const body = mat(0x2f4f8a, { roughness: 0.5 });
  const stripe = mat(0xf4f4f0);
  g.add(box(0.3, 0.2, 0.55, body, { y: 0.03, z: 0.78 }));
  g.add(box(0.31, 0.04, 0.55, stripe, { y: 0.1, z: 0.78 }));
  g.add(box(0.2, 0.08, 0.2, windowMaterial, { y: 0.17, z: 0.82 }));
  for (let i = 0; i < 3; i++) {
    g.add(box(0.3, 0.2, 0.7, body, { y: 0.03, z: 0.1 - i * 0.78 }));
    g.add(box(0.31, 0.04, 0.7, stripe, { y: 0.1, z: 0.1 - i * 0.78 }));
    g.add(box(0.31, 0.06, 0.55, windowMaterial, { y: 0.14, z: 0.1 - i * 0.78 }));
  }
  return g;
}

export default function build(): CityScene {
  const rand = rng(1010);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: M.pavement, side: mat(0x9c6a45) }));

  // Hoan Kiem Lake: a sandstone curb standing above the water, a grass verge lined with a clipped hedge
  // and round shrubs; long axis runs left-right on screen.
  const lakePoly: [number, number][] = [
    [-2.2, 0.4], [-2.6, -2.2], [-2.4, -4.6], [-0.6, -5.6], [1.8, -5.8], [4.4, -5.3], [6.4, -3.8],
    [6.7, -1.2], [6.3, 1.2], [4.6, 1.9], [2.3, 2.0], [0.0, 1.5],
  ];
  const cx = lakePoly.reduce((s, p) => s + p[0], 0) / lakePoly.length;
  const cz = lakePoly.reduce((s, p) => s + p[1], 0) / lakePoly.length;
  const scaled = (k: number) => lakePoly.map(([x, z]): [number, number] => [cx + (x - cx) * k, cz + (z - cz) * k]);
  root.add(area(scaled(1.13), M.grass, { h: 0.03 }));
  root.add(prism(scaled(1.06), 0.1, BANK_STONE, { holes: [lakePoly] }));
  root.add(area(lakePoly, LAKE, { h: 0.06 }));

  // The Huc bridge lands on the south-west shore; the hedge opens there.
  const shore: [number, number] = [-1.3, 1.3];
  const hedge = mat(0x4f8a3e, { flat: true });
  const shrub = mat(0x5f9a4a, { flat: true });
  const hedgeLine = scaled(1.095);
  hedgeLine.forEach(([x, z], i) => {
    const [nx, nz] = hedgeLine[(i + 1) % hedgeLine.length];
    const pieces = Math.max(1, Math.round(Math.hypot(nx - x, nz - z) / 0.5));
    for (let k = 0; k < pieces; k++) {
      const ax = x + ((nx - x) * k) / pieces;
      const az = z + ((nz - z) * k) / pieces;
      const bx = x + ((nx - x) * (k + 1)) / pieces;
      const bz = z + ((nz - z) * (k + 1)) / pieces;
      if (Math.hypot((ax + bx) / 2 - shore[0], (az + bz) / 2 - shore[1]) < 0.5) continue;
      root.add(beam([ax, 0.085, az], [bx, 0.085, bz], 0.11, hedge));
      if ((i + k) % 3 === 0) root.add(sphere(0.1, shrub, { x: (ax + bx) / 2, y: 0.08, z: (az + bz) / 2, segments: 5 }));
    }
  });

  // Turtle Tower island: an irregular stone-edged island, lawn crowded with round shrubs and small trees,
  // the tower set toward its back.
  const island: [number, number] = [2.4, -1.4];
  const islandShape: [number, number][] = [[-1.15, 0.25], [-0.75, -0.75], [0.35, -1.05], [1.25, -0.55], [1.3, 0.45], [0.55, 1.05], [-0.55, 0.95]];
  const islandAt = (k: number) => islandShape.map(([ox, oz]): [number, number] => [island[0] + ox * k, island[1] + oz * k]);
  root.add(area(islandAt(1), BANK_STONE, { h: 0.1 }));
  root.add(area(islandAt(0.92), M.grass, { h: 0.12 }));
  const tt = turtleTower({ x: island[0] + 0.05, y: 0.12, z: island[1] - 0.3 });
  tt.scale.setScalar(1.5);
  root.add(tt);
  for (const [ox, oz, s] of [[-0.7, -0.35, 0.5], [0.8, 0.5, 0.5], [0.9, -0.25, 0.5], [-0.25, 0.75, 0.5], [0.35, 0.8, 0.45]] as const) {
    root.add(tree({ x: island[0] + ox, y: 0.12, z: island[1] + oz, s }));
  }
  const ux = island[0] - shore[0];
  const uz = island[1] - shore[1];
  const ul = Math.hypot(ux, uz);
  const landing: [number, number] = [island[0] - (ux / ul) * 1.0, island[1] - (uz / ul) * 1.0];
  const rim = islandAt(0.8);
  rim.forEach(([x, z], i) => {
    const [nx, nz] = rim[(i + 1) % rim.length];
    for (const t of [0, 0.5]) {
      const bx = x + (nx - x) * t;
      const bz = z + (nz - z) * t;
      if (Math.hypot(bx - landing[0], bz - landing[1]) < 0.4) continue;
      root.add(sphere(0.12, shrub, { x: bx, y: 0.1, z: bz, segments: 5 }));
    }
  });
  root.add(theHucBridge(shore, landing));

  // Streets, with discs filling the bends.
  for (const [x1, z1, x2, z2] of ROADS) root.add(road(x1, z1, x2, z2, ROAD_W, { lines: false, material: ASPHALT }));
  for (const [x, z] of [[7.0, 3.3], [8.3, 2.0]] as const) root.add(cylinder(ROAD_W / 2, ROAD_W / 2, 0.05, ASPHALT, { x, z, segments: 12 }));
  root.add(crosswalk(-6.8, 2.2, ROAD_W));
  root.add(crosswalk(-6.8, -5.9, ROAD_W));
  root.add(crosswalk(-0.6, 3.3, ROAD_W, { ry: Math.PI / 2 }));
  root.add(crosswalk(8.3, -5.9, ROAD_W));
  root.add(crosswalk(-2.6, -7.0, ROAD_W, { ry: Math.PI / 2 }));
  root.add(crosswalk(5.4, -7.0, ROAD_W, { ry: Math.PI / 2 }));

  // Long Bien with a train shuttling out and back on the deck.
  root.add(longBien());
  const trainCars = train();
  mergeStatic(trainCars);
  // Three cars trail ~1.9 behind the loco, so the turn-back points stay clear of the plinth edges.
  root.add(anim.follow(group({ y: DECK_Y }, trainCars), [[BRIDGE_X, -7.4], [BRIDGE_X, 7.4], [BRIDGE_X, -7.4]], 0.7, 0));

  // Small house with a café parasol in the front-left corner, between the bridge and its road.
  root.add(villa(-7.6, 8.2, 1.0, 0.9));
  root.add(cylinder(0.01, 0.01, 0.32, M.dark, { x: -7.6, z: 9.2, segments: 4 }));
  root.add(cone(0.24, 0.1, mat(0xd0402f), { x: -7.6, y: 0.3, z: 9.2, segments: 8 }));

  // Ba Dinh: the Flag Tower and the Mausoleum as a pair along the front edge, both about 4.2 across, centred
  // at the same depth and mirrored about x ≈ 0. The square runs from the lake road back to the edge.
  const pairZ = 7.3;
  const towerX = -4.0;
  const mausX = 4.2;
  root.add(flagTower({ x: towerX, z: pairZ }));
  root.add(patch(11.05, 6.05, PLAZA, { x: 4.275, z: 6.775, h: 0.035 }));
  // Mausoleum turned to face the lake road; podium scaled to the Flag Tower's terrace (4.2).
  const maus = mausoleum({ x: mausX, y: 0.035, z: pairZ, ry: Math.PI });
  maus.scale.setScalar(0.88);
  root.add(maus);
  // Courtyard between the mausoleum and the street: flagpole on the axis, lawns either side of the
  // central walk, more lawns flanking the mausoleum.
  const yardZ = 4.5;
  root.add(patch(0.7, 0.7, mat(0xb8453a), { x: mausX, z: yardZ, h: 0.1 }));
  root.add(vietnamFlag({ x: mausX, y: 0.1, z: yardZ, h: 2.6, s: 1.3 }));
  const lawns: [number, number, number, number][] = [];
  for (const off of [1.2, 2.7, 4.2]) {
    for (const sx of [-1, 1]) lawns.push([mausX + sx * off, yardZ, 1.2, 1.0]);
  }
  for (const z of [6.4, 8.3]) lawns.push([0.6, z, 1.1, 1.5], [7.25, z, 1.2, 1.5], [8.85, z, 1.2, 1.5]);
  for (const [x, z, w, d] of lawns) {
    root.add(patch(w + 0.1, d + 0.1, LAWN_EDGE, { x, z, h: 0.05 }));
    root.add(patch(w, d, M.grass, { x, z, h: 0.065 }));
  }
  for (const sx of [-1.6, -0.8, 0.8, 1.6]) {
    root.add(cylinder(0.06, 0.05, 0.1, mat(0xa0522d), { x: mausX + sx, y: 0.035, z: 5.15, segments: 6 }));
    root.add(sphere(0.08, shrub, { x: mausX + sx, y: 0.12, z: 5.15, segments: 5 }));
  }
  // Courtyard walk (plaza top 0.035), clear of the flagpole base and the lawns either side of the walk.
  const peopleRand = rng(1011); // own stream, so the layout drawn from `rand` stays as it was
  for (let k = 0; k < 10; k++) rand(); // the 5 courtyard figures used to draw 2 numbers each
  const spots: [number, number, number][] = []; // trees and lamps people must stay off: x, z, radius
  const nearSpot = (x: number, z: number) => spots.some(([sx, sz, r]) => Math.hypot(x - sx, z - sz) < r);
  root.add(scatter({ x: mausX, z: 4.5, w: 1.0, d: 1.1 }, 5, peopleRand, (x, z, i) => hanoian(x, z, i, 0.035), (x, z) => Math.abs(x - mausX) < 0.5 && Math.abs(z - yardZ) < 0.5));

  // Opera House at the back, facing the lake road.
  const opera = operaHouse({ x: -4.6, z: -8.85 });
  opera.scale.setScalar(1.15);
  root.add(opera);

  // Old Quarter: one long row of tube houses of varied width and height along the back edge.
  for (let x = -2.2; x < 9.3;) {
    const w = Math.min(0.55 + rand() * 0.3, 9.45 - x);
    const h = 1.8 + rand() * 0.9;
    const c = HOUSE_COLORS[Math.floor(rand() * HOUSE_COLORS.length)];
    root.add(tubeHouse(x + w / 2, -8.75, w - 0.03, 1.3, h, c, rand() < 0.3));
    x += w;
  }
  const vendorXs: number[] = [];
  root.add(row(-1.8, -7.75, 8.9, -7.75, 6, (x, z) => (vendorXs.push(x), vendor(x, z, rand() * 6))));

  // Colonial houses: an L-shaped one between the bridge road and the lake, one on the east side.
  root.add(villa(-5.0, -2.6, 1.2, 1.0, Math.PI / 2));
  root.add(villa(-4.85, -1.65, 0.8, 0.8));
  root.add(villa(9.35, -3.0, 1.1, 0.8, -Math.PI / 2));

  // Lamps and trees around the lake, kept off roads, the Huc bridge and the flagpole.
  const ring: [number, number][] = [];
  const outer = scaled(1.22);
  outer.forEach(([x, z], i) => {
    const [nx, nz] = outer[(i + 1) % outer.length];
    ring.push([x, z], [(x + nx) / 2, (z + nz) / 2]);
  });
  ring.forEach(([x, z], i) => {
    if (onRoad(x, z) || Math.hypot(x - shore[0], z - shore[1]) < 0.7) return;
    spots.push([x, z, 0.4]);
    root.add(i % 2 === 0 ? tree({ x, z, s: 1.1 }) : lamp({ x, z }));
  });

  // Trees fill the open ground on a jittered grid, clear of roads, the lake, buildings and the bridge.
  const blocked: [number, number, number, number][] = [
    [-9.8, -9.8, -8.3, 9.8], // Long Bien
    [-6.4, 4.9, -1.0, 9.8], // Flag Tower terraces and stair
    [-6.4, -9.8, -2.9, -7.4], // Opera House
    [-2.6, -9.8, 9.8, -7.4], // Old Quarter row
    [-1.3, 3.7, 9.8, 9.8], // Ba Dinh square
    [-5.8, -3.4, -4.2, -1.1], [-8.3, 7.5, -6.8, 9.8], [8.8, -3.8, 9.8, -2.2], // houses
  ];
  const lakeZone = scaled(1.2);
  const inLakeZone = (x: number, z: number) => {
    let inside = false;
    for (let i = 0, j = lakeZone.length - 1; i < lakeZone.length; j = i++) {
      const [xi, zi] = lakeZone[i];
      const [xj, zj] = lakeZone[j];
      if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
    }
    return inside;
  };
  for (let gx = -9.3; gx <= 9.3; gx += 1.0) {
    for (let gz = -9.3; gz <= 9.3; gz += 1.0) {
      const x = Math.max(-9.3, Math.min(9.3, gx + (rand() - 0.5) * 0.5));
      const z = Math.max(-9.3, Math.min(9.3, gz + (rand() - 0.5) * 0.5));
      const s = 0.9 + rand() * 0.4;
      if (onRoad(x, z, 0.3) || inLakeZone(x, z) || blocked.some(([ax, az, bx, bz]) => x > ax && x < bx && z > az && z < bz)) continue;
      spots.push([x, z, 0.4]);
      root.add(tree({ x, z, s }));
    }
  }

  // Street life: the south shore walk (pavement, y 0), the north pavement behind the Old Quarter street
  // (clear of the vendors), the two Flag Tower walks (brick floors 0.62 / 1.17) and the east verge.
  for (let k = 0; k < 48; k++) rand(); // the 24 street figures used to draw 2 numbers each
  const free = (x: number, z: number) => !nearSpot(x, z);
  root.add(scatter({ x: 2.2, z: 2.65, w: 4, d: 0.1 }, 6, peopleRand, (x, z, i) => hanoian(x, z, i, 0), free));
  root.add(scatter({ x: 2.0, z: -7.6, w: 5, d: 0.1 }, 5, peopleRand, (x, z, i) => hanoian(x, z, i + 2, 0), (x, z) => nearSpot(x, z) || vendorXs.some((vx) => Math.abs(x - vx) < 0.35)));
  root.add(scatter({ x: towerX, z: pairZ + 1.32, w: 2.6, d: 0.1 }, 4, peopleRand, (x, z, i) => hanoian(x, z, i + 4, 1.17)));
  root.add(scatter({ x: towerX, z: pairZ - 1.85, w: 3.6, d: 0.1 }, 4, peopleRand, (x, z, i) => hanoian(x, z, i + 1, 0.62)));
  root.add(scatter({ x: 9.3, z: 0.4, w: 0.4, d: 3 }, 3, peopleRand, (x, z, i) => hanoian(x, z, i + 6, 0), free));
  // Walkers: along the south shore walk and round the flagpole on the courtyard walk.
  const shoreWalk: [number, number][] = [[0.6, 2.58], [5.0, 2.58], [5.0, 2.72], [0.6, 2.72]];
  for (let i = 0; i < 4; i++) root.add(anim.follow(hanoian(0, 0, i + 3, 0), shoreWalk, 0.26, i / 4, true));
  const flagWalk: [number, number][] = [[3.75, 3.95], [4.65, 3.95], [4.65, 5.0], [3.75, 5.0]];
  for (let i = 0; i < 3; i++) root.add(anim.follow(hanoian(0, 0, i + 8, 0.035), flagWalk, 0.22, i / 3, true));

  // Traffic: a bus on the bridge road, a few cars, then motorbike swarms (each mover a pre-merged pair).
  const busG = bus({ color: 0xf2e6b0 });
  mergeStatic(busG);
  root.add(anim.follow(group({ y: 0.05 }, busG), [[-6.6, 9.4], [-6.6, -9.4]], 1.0, 0.3));
  const lakeLoopOut: [number, number][] = [[-6.6, 3.5], [7.0, 3.5], [8.5, 2.0], [8.5, -7.2]];
  const lakeLoopBack: [number, number][] = [[8.1, -7.2], [8.1, 1.9], [6.9, 3.1], [-6.6, 3.1]];
  for (const [path, taxi, color, off] of [
    [lakeLoopBack, false, 0x6fa8dc, 0.5],
    [[[9.6, -6.8], [-6.6, -6.8]], true, 0, 0.7],
    [lakeLoopOut, true, 0, 0.2],
  ] as [[number, number][], boolean, number, number][]) {
    root.add(anim.follow(group({ y: 0.05 }, car({ taxi, color })), path, 1.1, off));
  }
  const lane = (path: [number, number][], n: number, speed: number, off: number) => {
    for (let i = 0; i < n; i++) {
      const pair = motorbikePair(BIKE_COLORS[Math.floor(rand() * BIKE_COLORS.length)]);
      root.add(anim.follow(group({ y: 0.05 }, pair), path, speed * (0.9 + rand() * 0.25), (i + rand() * 0.6) / n + off));
    }
  };
  lane([[-7.0, -9.6], [-7.0, 9.6]], 4, 1.5, 0.05);
  lane([[-6.6, -7.2], [9.6, -7.2]], 4, 1.4, 0.1);
  lane(lakeLoopOut, 4, 1.3, 0.4);
  lane(lakeLoopBack, 4, 1.4, 0.15);

  return { root, update: anim.update };
}
