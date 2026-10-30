import * as THREE from 'three';
import {
  Animator, M, beam, box, boat, car, cone, crosswalk, createBase, cylinder, dome, floodMat, group, lamp, mat, mergeStatic, patch, person, profile, rng, road, row,
  waterMat,
  scatter, shape, tree, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';
import CAMEL from '../shapes/camel.shape';
import DHOW from '../shapes/dhow.shape';

const SILVER = mat(0xdde5ec, { roughness: 0.25, metalness: 0.55 });
const GLASS_BLUE = mat(0x86a7c2, { roughness: 0.2, metalness: 0.55 });
const SAND = mat(0xe9cf9b);
const SAND_LIGHT = mat(0xf0dcae);
const DUNE = mat(0xe3bb7c);
const DUNE_DARK = mat(0xd5a869);
const SEA = waterMat(0x2fc0cc);
const LAKE = waterMat(0x3aa6d0);
const ROAD = mat(0x585d66, { roughness: 0.95, surface: 'road' });
const WHITE = mat(0xf8f6f0);
const TEAL = mat(0x19a7b3, { roughness: 0.3, metalness: 0.3 });
const GOLD = floodMat(0xe3b13c, 0xffa726, 0.9, { roughness: 0.3 });
const CAR_COLORS = [0xf2f2f0, 0xd9dde2, 0x2f343b, 0xc8433a, 0xe9c545, 0x3d6fb6];

/**
 * Burj Khalifa: tri-lobed (Y) plan around a hex core; three wings spiral-step back
 * as they rise, each ending at a different height, then a long needle (~25% of height).
 */
function burjKhalifa(p: Place): THREE.Group {
  const g = group(p);
  const levels = 18;
  const step = 0.5;
  const y0 = 0.3;
  const wingEnd = [13, 16, 18]; // first level at which each wing is gone
  const hex = mat(0xcfd9e2, { roughness: 0.3, metalness: 0.5 });
  g.add(cylinder(2.0, 2.1, 0.3, mat(0xcfc7b8), { segments: 6 }));
  // Hex core runs up the whole shaft, tapering, so it stays the tallest mass inside the stepped wings.
  g.add(cylinder(0.4, 0.62, levels * step + 0.01, hex, { y: y0, segments: 6 }));
  for (let k = 0; k < levels; k++) {
    const y = y0 + k * step;
    const m = k % 2 === 0 ? SILVER : GLASS_BLUE;
    const len = 1.75 - k * 0.085;
    const wid = 0.72 - k * 0.025;
    for (let j = 0; j < 3; j++) {
      if (k >= wingEnd[j]) continue;
      // Each level turns a little further, so the setbacks read as a spiral.
      const a = (j * 2 * Math.PI) / 3 + Math.PI / 6 + k * 0.035;
      const place = { x: (Math.sin(a) * len) / 2, z: (Math.cos(a) * len) / 2, ry: a };
      g.add(box(wid, step + 0.01, len, m, { ...place, y }));
      // Lit window band round the wing, the glow that makes the tower read at night.
      g.add(box(wid + 0.02, step * 0.5, len + 0.02, windowMaterial, { ...place, y: y + step * 0.25 }));
    }
  }
  const top = y0 + levels * step;
  g.add(cylinder(0.3, 0.38, 0.9, SILVER, { y: top, segments: 8 }));
  g.add(cylinder(0.14, 0.28, 1.3, M.steel, { y: top + 0.9, segments: 8 }));
  g.add(cylinder(0.02, 0.1, 1.2, M.steel, { y: top + 2.2, segments: 6 }));
  return g;
}

/** Burj Al Arab: billowing sail (convex leading edge), X-braced mast truss, cantilevered helipad. */
function burjAlArab(p: Place): THREE.Group {
  const g = group(p);
  g.add(cylinder(1.65, 1.75, 0.1, SAND, { segments: 28, y: 0.04 }));
  const hotel = group({ y: 0.14, ry: Math.PI / 4 });
  const top = 5.7;
  const mastX = -0.55;
  const pts: [number, number][] = [[mastX, 0], [mastX, top]];
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    pts.push([mastX + 2.5 * t + Math.sin(t * Math.PI) * 0.55, top * (1 - t)]);
  }
  hotel.add(profile(pts, 0.9, WHITE));
  const sailPts: [number, number][] = [[mastX + 0.45, 0.5], [mastX + 0.45, top - 1.2]];
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    sailPts.push([mastX + 0.45 + 2.0 * t + Math.sin(t * Math.PI) * 0.4, (top - 1.2) * (1 - t) + 0.5 * t]);
  }
  // Translucent Teflon sail: pale by day, lit blue-violet at night.
  hotel.add(profile(sailPts, 0.96, floodMat(0xeef3f5, 0x7a6bff, 1.1, { roughness: 0.35 })));
  hotel.add(box(0.55, top, 1.1, TEAL, { x: mastX }));
  for (const sz of [-1, 1]) {
    const z = sz * 0.57;
    for (let k = 0; k < 6; k++) {
      const y0 = 0.3 + k * 0.85;
      hotel.add(beam([mastX - 0.3, y0, z], [mastX + 0.3, y0 + 0.85, z], 0.05, WHITE));
      hotel.add(beam([mastX + 0.3, y0, z], [mastX - 0.3, y0 + 0.85, z], 0.05, WHITE));
    }
  }
  for (let k = 1; k < 6; k++) hotel.add(box(0.7, 0.05, 1.2, WHITE, { x: mastX, y: k * 0.85 - 0.02 }));
  // Atrium glazing between the floor plates of the mast.
  for (let k = 0; k < 6; k++) hotel.add(box(0.57, 0.3, 1.12, windowMaterial, { x: mastX, y: 0.3 + k * 0.85 }));
  hotel.add(cylinder(0.02, 0.06, 0.6, M.steel, { x: mastX, y: top, segments: 6 }));
  // Helipad cantilevered off the spine, restaurant bulb below the sail.
  hotel.add(box(0.7, 0.07, 0.12, WHITE, { x: mastX - 0.5, y: 4.55 }));
  hotel.add(cylinder(0.34, 0.34, 0.06, WHITE, { x: mastX - 0.85, y: 4.6, segments: 20 }));
  hotel.add(cylinder(0.2, 0.2, 0.02, TEAL, { x: mastX - 0.85, y: 4.67, segments: 16 }));
  hotel.add(cylinder(0.4, 0.3, 0.3, windowMaterial, { x: mastX + 0.55, y: 3.45, segments: 16 }));
  hotel.add(box(1.9, 0.45, 1.3, WHITE, { x: 0.65 }));
  hotel.add(box(1.92, 0.18, 1.32, windowMaterial, { x: 0.65, y: 0.12 }));
  hotel.add(box(1.92, 0.08, 1.32, TEAL, { x: 0.65, y: 0.45 }));
  g.add(hotel);
  // Curved causeway to the shore.
  const pathPts: [number, number][] = [];
  for (let i = 0; i <= 9; i++) {
    const t = i / 9;
    pathPts.push([Math.sin(t * Math.PI * 0.9) * 0.7, -1.5 - t * 2.1]);
  }
  for (let i = 0; i < pathPts.length - 1; i++) {
    const [ax, az] = pathPts[i];
    const [bx, bz] = pathPts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    g.add(box(0.34, 0.07, len + 0.04, WHITE, { x: (ax + bx) / 2, z: (az + bz) / 2, y: 0.05, ry: Math.atan2(bx - ax, bz - az) }));
  }
  return g;
}

function ovalPts(a: number, b: number, n: number, rev = false): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = ((rev ? -i : i) / n) * Math.PI * 2;
    pts.push([Math.cos(t) * a, Math.sin(t) * b]);
  }
  return pts;
}

/** Museum of the Future: upright oval ring with a hollow eye, calligraphy-window band on both faces. */
function museumOfTheFuture(p: Place): THREE.Group {
  const g = group(p);
  g.add(dome(1.6, mat(0x8fb86a), { squash: 0.3, segments: 20 }));
  const cy = 2.0;
  const depth = 1.0;
  const ring = profile(ovalPts(1.1, 1.6, 40), depth, SILVER, { holes: [ovalPts(0.55, 1.0, 32, true)], y: cy });
  g.add(ring);
  const band = profile(ovalPts(0.98, 1.48, 40), depth + 0.04, windowMaterial, { holes: [ovalPts(0.68, 1.13, 32, true)], y: cy });
  g.add(band);
  // Calligraphy: slanted silver slits across the band, both faces.
  const n = 18;
  const rx = (0.98 + 0.68) / 2;
  const ry = (1.48 + 1.13) / 2;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    for (const sz of [-1, 1]) {
      const s = box(0.05, 0.3, 0.02, SILVER, { x: Math.cos(t) * rx, y: cy + Math.sin(t) * ry - 0.15, z: sz * (depth / 2 + 0.025) });
      s.rotation.z = t + Math.PI / 2 + 0.5;
      g.add(s);
    }
  }
  return g;
}

function dubaiFrame(p: Place): THREE.Group {
  const g = group(p);
  for (const sx of [-1.15, 1.15]) {
    g.add(box(0.5, 4.0, 0.5, GOLD, { x: sx }));
    g.add(box(0.36, 3.9, 0.36, windowMaterial, { x: sx, z: 0.1 }));
  }
  g.add(box(2.8, 0.55, 0.5, GOLD, { y: 3.55 }));
  g.add(box(2.0, 0.2, 0.52, windowMaterial, { y: 3.72 }));
  return g;
}

/** Stack of rotating floors, like the Cayan Tower. */
function twistTower(x: number, z: number, h: number, wall = SILVER): THREE.Group {
  const g = group({ x, z });
  const n = 12;
  for (let i = 0; i < n; i++) {
    const ry = (i / n) * (Math.PI / 2);
    g.add(box(0.9, h / n + 0.01, 0.9, i % 2 ? wall : GLASS_BLUE, { y: (h / n) * i, ry }));
    // Lit glazing band per floor plate.
    g.add(box(0.92, (h / n) * 0.4, 0.92, windowMaterial, { y: (h / n) * i + (h / n) * 0.3, ry }));
  }
  g.add(cylinder(0.02, 0.07, 0.5, M.steel, { y: h, segments: 6 }));
  return g;
}

/** Emirates Towers: twin triangular-plan towers with pyramidal crowns; the taller carries a spire. */
function emiratesTower(x: number, z: number, h: number, r: number, ry: number): THREE.Group {
  const g = group({ x, z, ry });
  const wall = mat(0xd5dde4, { roughness: 0.25, metalness: 0.55, flat: true });
  g.add(cylinder(r, r, h, wall, { segments: 3 }));
  const floors = Math.floor((h - 0.4) / 0.4);
  for (let f = 0; f < floors; f++) g.add(cylinder(r * 1.04, r * 1.04, 0.17, windowMaterial, { y: 0.2 + f * 0.4, segments: 3 }));
  g.add(cylinder(0.05, r * 0.98, 0.9, mat(0xaab8c4, { roughness: 0.3, metalness: 0.5, flat: true }), { y: h, segments: 3 }));
  g.add(cylinder(0.01, 0.04, 0.8, M.steel, { y: h + 0.9, segments: 5 }));
  return g;
}

/** Elevated Dubai Metro viaduct down the road median with a shuttle train on top. */
function metroLine(anim: Animator): THREE.Group {
  const g = group();
  const concrete = mat(0xbfb9ae);
  g.add(box(19.6, 0.14, 0.6, concrete, { y: 1.2, z: 0.9 }));
  g.add(box(19.6, 0.05, 0.12, M.steel, { y: 1.34, z: 0.9 }));
  for (const x of [-8.6, -6.4, -4.4, -0.7, 1.2, 5.0, 7.0, 9.0]) g.add(box(0.14, 1.2, 0.14, concrete, { x, z: 0.9 }));
  // Train built along +z (the follow heading): three cars with lit window strips.
  const train = group({ y: 1.39 });
  const body = mat(0xe8ecef, { roughness: 0.4 });
  const stripe = mat(0xc8433a);
  for (let c = 0; c < 3; c++) {
    const z = (c - 1) * 0.58;
    train.add(box(0.32, 0.28, 0.54, body, { z }));
    train.add(box(0.33, 0.1, 0.46, windowMaterial, { z, y: 0.12 }));
    train.add(box(0.33, 0.04, 0.54, stripe, { z, y: 0.04 }));
  }
  mergeStatic(train);
  g.add(anim.follow(train, [[-9.6, 0.9], [9.6, 0.9]], 1.4, 0.2, true));
  return g;
}

type Crown = 'flat' | 'spire' | 'slant' | 'prongs' | 'dome' | 'wedge';

function glassTower(x: number, z: number, w: number, d: number, h: number, wall: THREE.Material, crown: Crown = 'flat', ry = 0): THREE.Group {
  const g = group({ x, z, ry });
  g.add(box(w, h, d, wall));
  const floors = Math.floor((h - 0.2) / 0.4);
  for (let f = 0; f < floors; f++) {
    g.add(box(w + 0.03, 0.17, d + 0.03, windowMaterial, { y: 0.2 + f * 0.4 }));
  }
  const steel = mat(0x9aa3ab);
  if (crown === 'spire') g.add(cylinder(0.02, 0.08, 0.7, M.steel, { y: h, segments: 6 }));
  if (crown === 'slant') g.add(box(w * 0.8, 0.25, d * 0.8, wall, { y: h }));
  if (crown === 'flat') g.add(box(w * 0.7, 0.2, d * 0.7, steel, { y: h }));
  if (crown === 'prongs') {
    // Twin blades, like a marina crown.
    g.add(box(w * 0.9, 0.12, d * 0.9, steel, { y: h }));
    for (const s of [-1, 1]) g.add(box(w * 0.22, 0.6, d * 0.8, wall, { y: h + 0.12, x: s * w * 0.3 }));
  }
  if (crown === 'dome') {
    g.add(box(w * 1.05, 0.1, d * 1.05, steel, { y: h }));
    g.add(dome(Math.min(w, d) * 0.45, SILVER, { y: h + 0.1, squash: 0.9, segments: 12 }));
    g.add(cylinder(0.015, 0.03, 0.45, M.steel, { y: h + 0.5, segments: 5 }));
  }
  if (crown === 'wedge') {
    g.add(profile([[-w / 2, 0], [w / 2, 0], [w / 2, 0.7], [-w / 2, 0]], d, wall, { y: h }));
  }
  return g;
}

// Rodin-baked camel (scripts/rodin/assets.ts), head toward +z. Parts: saddle blanket, body.
function camel(p: Place): THREE.Group {
  return shape(CAMEL, [M.red, mat(0xc08a4e)], { ...p, height: 1.0, smooth: true });
}

// Rodin-baked dhow (scripts/rodin/assets.ts), bow toward +z (the follow heading). Parts: hull and mast (tinted per boat), sail.
// The model is 1.68x as long as tall; sized to 1.25x `len` long so the lateen mast stays near the old height.
function dhow(color: number, len: number): THREE.Group {
  const g = shape(DHOW, [mat(color, { roughness: 0.8 }), mat(0xf2e8d0, { roughness: 0.9 })], { height: (len * 1.25) / DHOW.size[2], smooth: true });
  mergeStatic(g);
  return g;
}

function abra(x: number, z: number): THREE.Group {
  const g = group({ x, y: 0.05, z });
  g.add(boat({ color: 0x8a5a35, len: 0.7 }));
  g.add(box(0.34, 0.03, 0.5, mat(0x2f6fa8), { y: 0.3 }));
  for (const pz of [-0.18, 0.18]) for (const px of [-0.15, 0.15]) g.add(box(0.02, 0.2, 0.02, M.wood, { x: px, z: pz, y: 0.15 }));
  mergeStatic(g);
  return g;
}

/**
 * Palm Jumeirah: trunk with 16 fronds of villas, a crown disc and the crescent breakwater. The sand sits just above
 * the sea (0.05) and each frond is wider than its two villa rows, so a strip of beach runs along every frond.
 */
function palmJumeirah(cx: number, cz: number): THREE.Group {
  const g = group({ x: cx, z: cz });
  const H = 0.075;
  const TERRA = mat(0xd98c5f);
  const ROOF = mat(0xb9654a);
  g.add(patch(0.5, 5.2, SAND, { h: H, z: -0.2 }));
  g.add(cylinder(0.5, 0.5, H, SAND, { z: 2.35, segments: 16 }));
  g.add(patch(0.14, 5.0, mat(0x6b6f76), { z: -0.2, y: H }));
  const n = 8;
  for (let i = 0; i < n; i++) {
    const z = -2.5 + i * 0.62;
    const u = (i - (n - 1) / 2) / ((n - 1) / 2);
    const len = 1.95 - u * u * 0.9;
    for (const s of [-1, 1]) {
      g.add(patch(len, 0.34, SAND, { h: H, x: s * (0.25 + len / 2), z }));
      const villas = Math.floor(len / 0.3);
      for (let k = 0; k < villas; k++) {
        const x = s * (0.5 + k * 0.3);
        g.add(box(0.15, 0.1, 0.07, k % 2 ? WHITE : TERRA, { x, y: H, z: z + 0.09 }));
        g.add(box(0.15, 0.1, 0.07, k % 2 ? TERRA : WHITE, { x, y: H, z: z - 0.09 }));
      }
      g.add(box(0.1, 0.08, 0.1, ROOF, { x: s * (0.25 + len), y: H, z }));
    }
  }
  const R = 3.0;
  const N = 30;
  for (let i = 0; i < N; i++) {
    const a = -1.85 + (i / (N - 1)) * 3.7;
    g.add(patch(0.5, 0.26, SAND_LIGHT, { h: H, x: Math.sin(a) * R, z: 0.2 + Math.cos(a) * R, ry: a }));
  }
  const pink = mat(0xe7a6a0);
  g.add(box(0.9, 0.5, 0.34, pink, { x: 0, y: H, z: 3.2 }));
  g.add(box(0.3, 0.8, 0.34, pink, { x: -0.3, y: H, z: 3.2 }));
  g.add(box(0.3, 0.8, 0.34, pink, { x: 0.3, y: H, z: 3.2 }));
  g.add(box(0.5, 0.1, 0.34, WHITE, { x: 0, y: H + 0.5, z: 3.2 }));
  return g;
}

export default function build(): CityScene {
  const rand = rng(2024);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: SAND, side: mat(0xd9b27c) }));

  root.add(patch(19.6, 6.4, SEA, { z: 6.6, h: 0.05 }));
  root.add(patch(19.6, 0.5, SAND_LIGHT, { z: 3.15, h: 0.07 }));
  // Pavement plaza strips.
  root.add(patch(19.6, 1.2, mat(0xc9c2b4), { z: 2.5 }));

  // Sheikh Zayed Road.
  root.add(road(-9.8, 0.9, 9.8, 0.9, 1.9, { material: ROAD }));
  root.add(patch(19.6, 0.4, mat(0xc9c2b4), { z: -0.55 }));
  root.add(row(-9.2, -0.2, 9.2, -0.2, 11, (x, z) => lamp({ x, z })));
  root.add(row(-9.2, 2.0, 9.2, 2.0, 11, (x, z) => lamp({ x, z })));

  // Burj Khalifa with its fountain lake.
  root.add(patch(6.6, 6.6, mat(0xcfc7b8), { x: -6.2, z: -4.6 }));
  root.add(patch(3.0, 3.2, mat(0x8fb86a), { x: -8.3, z: -8.2, h: 0.05 }));
  root.add(burjKhalifa({ x: -6.5, z: -6.8 }));
  root.add(patch(5.2, 2.6, mat(0xe9e2d2), { x: -5.4, z: -2.6, h: 0.06 }));
  root.add(patch(4.8, 2.2, LAKE, { x: -5.4, z: -2.6, h: 0.09 }));
  for (const [x, z, h] of [[-6.6, -2.6, 0.9], [-5.4, -2.6, 1.2], [-4.2, -2.6, 0.9], [-5.4, -3.2, 0.6], [-5.4, -2.0, 0.6]] as const) {
    root.add(cone(0.1, h, mat(0xe9f6fb, { transparent: true, opacity: 0.8 }), { x, z, y: 0.08, segments: 8 }));
  }
  root.add(patch(0.3, 2.4, WHITE, { x: -7.9, z: -2.6, h: 0.1 }));
  root.add(patch(0.3, 2.4, WHITE, { x: -2.9, z: -2.6, h: 0.1 }));

  // Dubai Frame and Museum of the Future.
  root.add(patch(3.6, 2.4, mat(0x8fb86a), { x: -0.3, z: -6.8 }));
  root.add(dubaiFrame({ x: -0.3, z: -6.8, ry: Math.PI / 4 }));
  root.add(museumOfTheFuture({ x: 3.8, z: -3.0, ry: Math.PI / 4 }));

  // Desert dunes with a camel.
  root.add(dome(2.6, DUNE, { x: 7.0, z: -7.2, squash: 0.45, segments: 20 }));
  root.add(dome(1.9, DUNE_DARK, { x: 7.8, z: -6.5, squash: 0.4, segments: 16 }));
  root.add(dome(1.6, DUNE, { x: 5.4, z: -8.2, squash: 0.35, segments: 16 }));
  // Caravan on the open sand strip in front of the east towers, walking along the road.
  const caravan: [number, number][] = [[7.2, -1.55], [9.4, -1.55], [9.4, -1.05], [7.2, -1.05]];
  for (const off of [0, 0.1]) {
    const c = camel({ x: 0, z: 0 });
    mergeStatic(c);
    root.add(anim.follow(c, caravan, 0.25, off, true));
  }
  root.add(tree({ x: 6.0, z: -4.6, kind: 'palm', s: 0.8 }));

  // Sheikh Zayed Road skyline.
  root.add(glassTower(1.2, -1.3, 1.0, 1.0, 4.8, mat(0x6f94b3, { roughness: 0.25, metalness: 0.5 }), 'spire'));
  root.add(glassTower(-1.4, -0.8, 0.9, 0.9, 3.2, SILVER, 'prongs'));
  root.add(twistTower(7.8, -3.2, 5.2));
  root.add(glassTower(9.1, -4.0, 0.8, 0.8, 3.4, mat(0xb8c6d1, { roughness: 0.3, metalness: 0.4 }), 'flat'));
  root.add(glassTower(6.2, -0.9, 0.9, 0.9, 3.8, mat(0x7fb4bd, { roughness: 0.25, metalness: 0.5 }), 'wedge'));
  root.add(glassTower(-9.0, -1.5, 0.8, 0.9, 2.6, SILVER, 'flat'));
  root.add(glassTower(-3.0, 2.7, 0.8, 0.8, 1.9, mat(0xd9cfbf), 'dome'));
  root.add(glassTower(0.4, 2.7, 0.9, 0.8, 2.2, mat(0x7fb4bd, { roughness: 0.25, metalness: 0.5 }), 'prongs'));
  root.add(glassTower(9.0, 2.6, 0.8, 0.8, 2.0, SILVER, 'wedge'));
  // Emirates Towers (interlocked triangles) on the back sand, clear of the Frame and the dunes.
  root.add(emiratesTower(1.9, -8.4, 6.4, 0.55, 0));
  root.add(emiratesTower(3.1, -6.9, 4.7, 0.5, Math.PI));
  root.add(metroLine(anim));
  root.add(glassTower(-9.0, 2.6, 0.8, 0.8, 2.4, mat(0x6f94b3, { roughness: 0.25, metalness: 0.5 }), 'dome'));
  root.add(crosswalk(-2.6, 0.9, 1.9, { ry: Math.PI / 2 }));
  root.add(crosswalk(3.2, 0.9, 1.9, { ry: Math.PI / 2 }));
  // Date palms.
  root.add(row(-9.4, -0.6, -2.2, -0.6, 5, (x, z) => tree({ x, z, kind: 'palm', s: 0.8 })));
  root.add(row(2.0, 2.45, 8.0, 2.45, 4, (x, z) => tree({ x, z, kind: 'palm', s: 0.8 })));
  // Locals in white kandura and black abaya, mixed with tourists in cream, pastel and light blue.
  const ROBES = [0xf4f1ea, 0x1d1d22, 0xf4f1ea, 0xe8d9b8, 0x9cc4e4, 0xf1c9c0, 0x1d1d22, 0xb9d8c4];
  const emirati = (x: number, z: number, i: number) => person({ x, y: 0.04, z, color: ROBES[i % ROBES.length] });
  // Sidewalk strip on the north side of the road, clear of the date-palm trunks.
  const palmX = [-9.4, -7.55, -5.7, -3.85, -2.0];
  root.add(scatter({ x: -5.5, z: -0.575, w: 5.6, d: 0.25 }, 5, rand, emirati, (x, z) => palmX.some((px) => Math.hypot(x - px, z + 0.6) < 0.3)));
  // Burj plaza, north of the fountain lake: off the tower base, the lawn and the promenade loop.
  const onBurjBase = (x: number, z: number) => Math.hypot(x + 6.5, z + 6.8) < 2.4 || z < -6.4 || z > -4.55;
  root.add(scatter({ x: -6.2, z: -5.1, w: 6.4, d: 1.8 }, 7, rand, emirati, onBurjBase));
  // Promenade walkers circling the lake's north edge on the plaza paving.
  const promenade: [number, number][] = [[-8.4, -4.35], [-3.3, -4.35], [-3.3, -4.1], [-8.4, -4.1]];
  for (let i = 0; i < 5; i++) root.add(anim.follow(emirati(0, 0, i + 1), promenade, 0.22, i / 5, true));

  // Palm Jumeirah (left/front) and Burj Al Arab (right/front).
  root.add(palmJumeirah(-5.0, 6.3));
  root.add(burjAlArab({ x: 6.6, z: 7.0 }));

  // Traffic.
  const lanes: [number, number][][] = [
    [[-9.6, 0.5], [9.6, 0.5]],
    [[9.6, 1.35], [-9.6, 1.35]],
  ];
  lanes.forEach((path, li) => {
    for (let i = 0; i < 5; i++) {
      root.add(anim.follow(car({ y: 0.05, color: CAR_COLORS[(i + li * 2) % CAR_COLORS.length], taxi: i === 2 }), path, 1.5, i / 5 + li * 0.1));
    }
  });

  // Dhows and abra on the water.
  const loop: [number, number][] = [[0.2, 4.2], [3.2, 4.2], [3.2, 9.3], [0.2, 9.3]];
  root.add(anim.follow(dhow(0x8a5a35, 0.9), loop, 0.5, 0, true));
  root.add(anim.follow(dhow(0xa8703f, 0.8), loop, 0.5, 0.5, true));
  const loop2: [number, number][] = [[8.6, 4.3], [9.4, 4.3], [9.4, 9.4], [8.6, 9.4]];
  root.add(anim.follow(dhow(0x7a4d2e, 0.7), loop2, 0.4, 0.25, true));
  for (const [x, z] of [[-9.1, 4.2], [-1.4, 9.2]] as const) {
    root.add(anim.bob(abra(x, z), 0.015, 1.4));
  }

  return { root, update: anim.update };
}
