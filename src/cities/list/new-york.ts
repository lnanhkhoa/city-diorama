import * as THREE from 'three';
import {
  Animator, M, area, beam, box, building, car, cone, createBase, crosswalk, cylinder, dome, group, lamp, mat, mergeStatic,
  floodMat, lampMaterial, patch, person, profile, rng, road, row, scatter, screen, shape, sphere, tree, waterMat, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';
import LIBERTY from '../shapes/statue-of-liberty.shape';

const STREET = mat(0x5d636b, { roughness: 0.95 });
const LIMESTONE = mat(0xd9d2c3);
const GLASS_TALL = mat(0x86a9c9, { roughness: 0.15, metalness: 0.6 });
// Flat: One WTC's crown is a 4-segment cylinder, whose smooth normals streak the glass.
const GLASS_DARK = mat(0x5f82a6, { roughness: 0.15, metalness: 0.6, flat: true });
const GRANITE = mat(0xb8a68c);
const CABLE = mat(0x6e5f50, { roughness: 0.6, metalness: 0.3 });
// Statue copper is floodlit at night, like the real one.
const COPPER = floodMat(0x72b9a0, 0x9fe8c8, 0.35, { roughness: 0.6 });
// Bridge tower stone, floodlit warm at night.
const BRIDGE_STONE = floodMat(0xb8a68c, 0xffc47a, 0.4);
// One WTC glass: cool blue glow at night under warm lit window bands; the crown glows brighter.
const WTC_GLASS = floodMat(0x86a9c9, 0x4a78b8, 0.45, { roughness: 0.15 });
const WTC_CROWN = floodMat(0x5f82a6, 0xbfe0ff, 1.1, { roughness: 0.15, flat: true });
// Empire State upper stonework and lantern are floodlit.
const ESB_LIT = floodMat(0xd9d2c3, 0xffcf8a, 0.3);
const ESB_LANTERN = floodMat(0xe8e0d0, 0xffd890, 0.9);
const BRICKS = [0xb5583f, 0xa44c38, 0xc26a4a, 0x9b5a45, 0xb8795a].map((c) => mat(c));
const SCREEN_COLORS = [0xff4fa0, 0x2fb6ff, 0xffb02e, 0x7a5cff, 0x34d399, 0xff5a3c];

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

function empireState(p: Place): THREE.Group {
  const g = group(p);
  const pier = mat(0xc9c2b2);
  g.add(building({ w: 3.2, d: 3.2, h: 1.2, wall: LIMESTONE, trim: pier, windows: 'grid' }));
  // Low wings flanking the base on the cross-street fronts (z), like the real five-storey base.
  for (const sz of [-1, 1]) g.add(building({ w: 2.2, d: 1.1, h: 0.9, z: sz * 2.1, wall: LIMESTONE, trim: pier, windows: 'grid', plain: true }));
  // Setback shafts, each with corner piers, a ledge and five continuous piers per face; the upper shafts are floodlit.
  const shafts: [number, number][] = [[2.5, 2.4], [2.1, 1.6], [1.7, 1.4], [1.3, 1.2], [0.9, 0.8]];
  let y = 1.2;
  shafts.forEach(([w, h], i) => {
    g.add(building({ w, d: w, h, y, wall: i >= 2 ? ESB_LIT : LIMESTONE, trim: pier, windows: 'grid', floorH: 0.45, plain: true }));
    g.add(box(w + 0.1, 0.07, w + 0.1, pier, { y: y + h - 0.07 }));
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) g.add(box(0.07, h - 0.07, 0.07, pier, { x: (sx * w) / 2, z: (sz * w) / 2, y }));
    for (let k = -2; k <= 2; k++) {
      for (const s of [-1, 1]) {
        g.add(box(0.05, h - 0.07, 0.04, pier, { x: k * w * 0.2, z: s * (w / 2 + 0.01), y }));
        g.add(box(0.04, h - 0.07, 0.05, pier, { x: s * (w / 2 + 0.01), z: k * w * 0.2, y }));
      }
    }
    y += h;
  });
  // Glassed lantern: observation drum with a lit band, stepped crown, a slim mast and a beacon.
  g.add(cylinder(0.3, 0.34, 0.35, ESB_LANTERN, { y, segments: 12 }));
  g.add(cylinder(0.31, 0.31, 0.1, lampMaterial, { y: y + 0.12, segments: 12 }));
  g.add(cylinder(0.22, 0.3, 0.28, ESB_LANTERN, { y: y + 0.35, segments: 12 }));
  g.add(cone(0.22, 0.45, ESB_LANTERN, { y: y + 0.63, segments: 12 }));
  g.add(cylinder(0.018, 0.05, 2.0, M.steel, { y: y + 1.08, segments: 6 }));
  g.add(sphere(0.05, lampMaterial, { y: y + 3.1, segments: 6 }));
  return g;
}

/** One WTC: square base with corners cut into 8 facets, lofted to a square rotated 45 degrees at the top. */
function oneWTC(p: Place): THREE.Group {
  const g = group(p);
  const s = 1.25;
  const c = 0.5;
  const t = 0.8;
  const H = 8.2;
  const y0 = 0.5;
  // Base ring: two vertices per side; each long-side pair converges to one top vertex on the axis.
  const base: [number, number][] = [];
  const top: [number, number][] = [];
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const rot = (x: number, z: number): [number, number] => [x * ca - z * sa, x * sa + z * ca];
    base.push(rot(s, -(s - c)), rot(s, s - c));
    top.push(rot(t, 0), rot(t, 0));
  }
  const pos: number[] = [];
  const v = (i: number, up: boolean): number[] => (up ? [top[i][0], y0 + H, top[i][1]] : [base[i][0], y0, base[i][1]]);
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    if (i % 2 === 0) pos.push(...v(i, false), ...v(i, true), ...v(j, false));
    else pos.push(...v(i, false), ...v(i, true), ...v(j, false), ...v(j, false), ...v(i, true), ...v(j, true));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const shaft = new THREE.Mesh(geo, WTC_GLASS);
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  g.add(shaft);
  // Lit window bands: level lines across the facets (lerp base -> top), skipping where triangular faces pinch to a point.
  for (let f = 0.04; f < 0.97; f += 0.055) {
    const ring = base.map((b, i): [number, number, number] => [b[0] + (top[i][0] - b[0]) * f, y0 + H * f, b[1] + (top[i][1] - b[1]) * f]);
    for (let i = 0; i < 8; i++) {
      const a = ring[i];
      const b = ring[(i + 1) % 8];
      if (Math.hypot(a[0] - b[0], a[2] - b[2]) > 0.12) g.add(beam(a, b, 0.07, windowMaterial));
    }
  }
  g.add(box(2.7, 0.5, 2.7, mat(0x9aa3ab)));
  // Lit glass crown, a beacon at the spire's foot, then the spire with rings.
  const topY = y0 + H;
  g.add(cylinder(0.6, 0.8, 0.35, WTC_CROWN, { y: topY, segments: 4 }));
  g.add(sphere(0.1, lampMaterial, { y: topY + 0.35, segments: 8 }));
  g.add(cylinder(0.025, 0.07, 3.4, M.steel, { y: topY + 0.35, segments: 6 }));
  for (const r of [0.8, 1.6, 2.4]) g.add(cylinder(0.07, 0.07, 0.05, M.steel, { y: topY + 0.35 + r, segments: 6 }));
  return g;
}

// Rodin-baked Statue of Liberty on Fort Wood (scripts/rodin/assets.ts), facing +z.
// Parts: copper statue, granite pedestal, fort walls. ~4.9 high, fort ~3.9 across.
function statueOfLiberty(p: Place): THREE.Group {
  const g = group(p);
  g.add(shape(LIBERTY, [COPPER, GRANITE, LIMESTONE], { height: 4.9, smooth: true }));
  // Torch flame at the raised hand: topmost copper vertex of the baked mesh (-0.07, 1.0, 0.01 of the normalised frame).
  g.add(sphere(0.1, lampMaterial, { x: -0.337, y: 4.9, z: 0.053, segments: 8 }));
  return g;
}

/** Gothic pointed arch opening for `profile` holes: two circular arcs meeting at an apex. */
function pointedArch(cx: number, r: number, springY: number): [number, number][] {
  const pts: [number, number][] = [[cx - r, 0], [cx - r, springY]];
  for (let i = 1; i <= 6; i++) {
    const t = (i / 6) * (Math.PI / 3);
    pts.push([cx + r - 2 * r * Math.cos(t), springY + 2 * r * Math.sin(t)]);
  }
  for (let i = 5; i >= 0; i--) {
    const t = (i / 6) * (Math.PI / 3);
    pts.push([cx - r + 2 * r * Math.cos(t), springY + 2 * r * Math.sin(t)]);
  }
  pts.push([cx + r, 0]);
  return pts;
}

/** Brooklyn Bridge along Z at x: towers on the two banks (z -0.5 north, 6.6 south), span across the water between. */
function brooklynBridge(x: number): THREE.Group {
  const g = group({ x });
  const towerZ = [6.6, -0.5];
  const topY = 3.2;
  // Deck: thin stone slab with sloped approach ramps (profile x = -world z); the south ramp ends before the z=9.1 street.
  const deckPts: [number, number][] = [
    [-8.55, 0], [-7.0, 0.95], [1.0, 0.95], [4.6, 0], [3.9, 0], [1.0, 0.8], [-7.0, 0.8], [-7.9, 0],
  ];
  // Two roadways, one through each Gothic arch; the central pier stands between them.
  for (const lx of [-0.5, 0.5]) {
    g.add(profile(deckPts, 0.56, GRANITE, { ry: Math.PI / 2, x: lx }));
    g.add(box(0.46, 0.02, 8.0, STREET, { y: 0.95, z: 3.05, x: lx }));
  }
  // Gothic stone towers with pointed-arch passages.
  for (const z of towerZ) {
    const openings = [pointedArch(-0.5, 0.33, 1.15), pointedArch(0.5, 0.33, 1.15), pointedArch(0, 0.2, 2.25)];
    g.add(profile(
      [[-1.1, 0], [1.1, 0], [1.1, 2.9], [0.8, 3.2], [-0.8, 3.2], [-1.1, 2.9]],
      0.7,
      BRIDGE_STONE,
      { z, holes: openings },
    ));
    for (const lx of [-0.85, 0.85]) g.add(sphere(0.06, lampMaterial, { x: lx, y: 3.3, z, segments: 6 }));
    g.add(box(1.9, 0.1, 0.8, mat(0xa39076), { y: 3.2, z }));
    g.add(box(2.3, 0.14, 0.8, mat(0xa39076), { y: 1.9, z: z }));
  }
  // Cables, suspenders and diagonal stays on both sides.
  const cableY = (z: number) => 1.15 + (topY - 1.15) * Math.pow((z - 3.05) / 3.55, 2);
  for (const sx of [-0.62, 0.62]) {
    const N = 10;
    for (let i = 0; i < N; i++) {
      const z0 = 6.6 - (i * 7.1) / N;
      const z1 = 6.6 - ((i + 1) * 7.1) / N;
      g.add(beam([sx, cableY(z0), z0], [sx, cableY(z1), z1], 0.05, CABLE));
    }
    g.add(beam([sx, topY, 6.6], [sx, 0.97, 8.4], 0.045, CABLE));
    g.add(beam([sx, topY, -0.5], [sx, 0.97, -3.6], 0.045, CABLE));
    for (let k = 1; k <= 8; k++) {
      const z = 6.6 - k * 0.75;
      g.add(beam([sx, 0.97, z], [sx, cableY(z), z], 0.018, CABLE));
      g.add(sphere(0.04, lampMaterial, { x: sx * 1.2, y: 1.0, z, segments: 5 })); // deck-edge lamps
    }
    for (let k = 1; k <= 5; k++) {
      g.add(beam([sx, topY - 0.1, 6.6], [sx, 0.97, 6.6 + k * 0.3], 0.018, CABLE));
      g.add(beam([sx, topY - 0.1, -0.5], [sx, 0.97, -0.5 - k * 0.55], 0.018, CABLE));
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

const WOOD = mat(0x8a5a3a);
const CREAM = mat(0xe7e0d2);
const AWNINGS = [0x2f6b4f, 0xc8433a, 0x3d6fb6, 0xe0b43a];

/** Rooftop wooden water tank: tapered drum on four legs under a conical cap. */
function waterTower(x: number, y: number, z: number): THREE.Group {
  const g = group({ x, y, z });
  for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) g.add(box(0.025, 0.2, 0.025, M.dark, { x: lx * 0.08, z: lz * 0.08 }));
  g.add(box(0.22, 0.02, 0.22, M.dark, { y: 0.2 }));
  g.add(cylinder(0.11, 0.12, 0.24, WOOD, { y: 0.22, segments: 10 }));
  g.add(cone(0.14, 0.12, M.slate, { y: 0.46, segments: 10 }));
  return g;
}

/** Zig-zag iron fire escape on the +x face: landings per floor joined by stairs. */
function fireEscape(w: number, h: number, floorH: number): THREE.Group {
  const g = group();
  const floors = Math.max(1, Math.floor((h - 0.3) / floorH));
  for (let f = 1; f < floors; f++) {
    const y = 0.3 + f * floorH;
    g.add(box(0.12, 0.02, 0.42, M.dark, { x: w / 2 + 0.06, y }));
    g.add(box(0.012, 0.07, 0.42, M.dark, { x: w / 2 + 0.12, y }));
    if (f > 1) g.add(beam([w / 2 + 0.07, y - floorH, f % 2 ? -0.17 : 0.17], [w / 2 + 0.07, y, f % 2 ? 0.17 : -0.17], 0.018, M.dark));
  }
  return g;
}

function walkUp(x: number, z: number, w: number, d: number, h: number, i: number, ry = 0): THREE.Group {
  const g = group({ x, z, ry });
  const wall = BRICKS[i % BRICKS.length];
  const shop = i % 3 === 0 && h >= 1.2 ? AWNINGS[i % AWNINGS.length] : undefined;
  g.add(building({ w, d, h, wall, trim: CREAM, roof: 'flat', floorH: 0.38, shop }));
  if (shop === undefined) g.add(box(w * 0.34, 0.1, 0.22, CREAM, { z: d / 2 + 0.11 })); // stoop
  if (i % 2 === 1) g.add(fireEscape(w, h, 0.38));
  if (i % 2 === 0 && h > 1.1) g.add(waterTower(w * 0.22, h + 0.03, -d * 0.22));
  return g;
}

function skyBlock(x: number, z: number, w: number, d: number, h: number, wall: THREE.Material): THREE.Group {
  return building({ x, z, w, d, h, wall, trim: CREAM, roof: 'flat', windows: 'grid', floorH: 0.45 });
}

/** Art Deco setback slab: three shrinking shafts with corner piers, ledges, a crown and (optionally) a finial. */
function artDeco(
  x: number, z: number, w: number, d: number, h: number, wall: THREE.Material, trim: THREE.Material,
  secs: [number, number][] = [[1, 0.55], [0.78, 0.27], [0.52, 0.18]],
  finial = true,
): THREE.Group {
  const g = group({ x, z });
  let y = 0;
  for (const [f, hf] of secs) {
    const sw = w * f;
    const sd = d * f;
    const sh = h * hf;
    g.add(building({ w: sw, d: sd, h: sh, y, wall, trim, windows: 'grid', floorH: 0.45, plain: true }));
    g.add(box(sw + 0.1, 0.07, sd + 0.1, trim, { y: y + sh - 0.07 }));
    for (const [cx, cz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) g.add(box(0.08, sh - 0.07, 0.08, trim, { x: (cx * sw) / 2, z: (cz * sd) / 2, y }));
    y += sh;
  }
  if (!finial) return g;
  const last = secs[secs.length - 1][0];
  g.add(box(w * last * 0.5, 0.25, d * last * 0.5, trim, { y }));
  g.add(cylinder(0.015, 0.04, h * 0.18, M.steel, { y: y + 0.25, segments: 5 }));
  return g;
}

/** Chrysler-style tower: setback shafts under a sunburst crown of terraced steel arches with lit triangular windows. */
function chrysler(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  const H = 5.4;
  g.add(artDeco(0, 0, 1.8, 1.8, H, mat(0xd6d1c6), mat(0xeee9dc), [[1, 0.52], [0.8, 0.26], [0.6, 0.22]], false));
  for (let t = 0; t < 6; t++) {
    const r = 0.56 * Math.pow(0.8, t);
    const y = H + t * 0.34;
    g.add(dome(r, M.steel, { y, squash: 0.75, segments: 16 }));
    if (t === 5) continue;
    // Triangular windows around each tier, staggered so they climb in a spiral.
    for (let k = 0; k < 8; k++) {
      const a = ((k + (t % 2) / 2) / 8) * Math.PI * 2;
      g.add(cone(0.045, 0.14, windowMaterial, { x: Math.cos(a) * r * 0.99, y: y + 0.1, z: Math.sin(a) * r * 0.99, segments: 3 }));
    }
  }
  g.add(cylinder(0.012, 0.04, 1.5, M.steel, { y: H + 1.9, segments: 5 }));
  return g;
}

/** Times Square block: Deco massing with glowing screens stacked on the +z and +x faces of the base. */
function timesSquare(x: number, z: number, w: number, d: number, h: number, wall: THREE.Material, seed: number): THREE.Group {
  const g = group();
  g.add(artDeco(x, z, w, d, h, wall, CREAM, [[1, 0.72], [0.7, 0.28]]));
  for (let i = 0; i < 2; i++) {
    const c = SCREEN_COLORS[(seed + i) % SCREEN_COLORS.length];
    g.add(screen(w * 0.75, 0.5, c, { x, y: 0.5 + i * 0.6, z: z + d / 2 + 0.05 }));
    const c2 = SCREEN_COLORS[(seed + i + 3) % SCREEN_COLORS.length];
    g.add(screen(d * 0.75, 0.5, c2, { x: x + w / 2 + 0.05, y: 0.7 + i * 0.6, z, ry: Math.PI / 2 }));
  }
  return g;
}

function steamVent(x: number, z: number, anim: Animator): THREE.Group {
  const g = group({ x, z });
  const puff = mat(0xffffff, { transparent: true, opacity: 0.7, roughness: 1 });
  g.add(cylinder(0.05, 0.07, 0.16, mat(0xe0792f), { segments: 8 }));
  g.add(anim.bob(sphere(0.11, puff, { x: 0.02, y: 0.34, segments: 6 }), 0.04, 1.6));
  return g;
}

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

const PARK = { cx: -0.5, cz: 5.5, w: 7.8, d: 5.8 };
const POND = { cx: -0.5, cz: 5.5, rx: 1.5, rz: 0.9 };

function ellipse(rx: number, rz: number, n = 22): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([Math.cos(a) * rx, Math.sin(a) * rz]);
  }
  return pts;
}

export default function build(): CityScene {
  const rand = rng(1776);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: mat(0xcfd3d8), side: mat(0xf1efe9) }));
  const asphalt = { lines: false, material: STREET } as const;

  // East River (front-right inlet, open to the +x plinth edge) with kerbs on all four sides.
  const RX0 = 5.4;
  const RZ0 = 1.7;
  const RZ1 = 6.1;
  const RW = RZ1 - RZ0;
  root.add(patch(9.8 - RX0, RW, waterMat(0x4fa3d1), { x: (RX0 + 9.8) / 2, z: (RZ0 + RZ1) / 2 }));
  root.add(patch(0.5, RW, mat(0xe9d9b0), { x: RX0 - 0.25, z: (RZ0 + RZ1) / 2, h: 0.03 })); // quay strip
  const kerb = mat(0xe5e1d6);
  root.add(box(0.12, 0.1, RW, kerb, { x: RX0 - 0.06, z: (RZ0 + RZ1) / 2 }));
  root.add(box(0.12, 0.1, RW, kerb, { x: 9.74, z: (RZ0 + RZ1) / 2 }));
  root.add(box(9.8 - RX0, 0.1, 0.12, kerb, { x: (RX0 + 9.8) / 2, z: RZ0 - 0.06 }));
  root.add(box(9.8 - RX0, 0.1, 0.12, kerb, { x: (RX0 + 9.8) / 2, z: RZ1 + 0.06 }));

  // Streets.
  root.add(road(-9.8, 1.0, 9.8, 1.0, 1.2, asphalt)); // runs under the bridge deck to the plinth edge
  root.add(road(-5.2, -9.8, -5.2, 9.8, 1.0, asphalt));
  root.add(road(4.4, -9.8, 4.4, 9.8, 0.9, asphalt));
  root.add(road(-4.7, 9.1, 9.8, 9.1, 0.9, asphalt));
  root.add(road(7.6, -9.8, 7.6, -4.6, 1.4, asphalt)); // bridge approach
  root.add(road(-5.2, -2.2, 4.4, -2.2, 0.8, asphalt)); // cross street through midtown
  // Zebra crossings at the avenue intersections.
  root.add(crosswalk(-5.2, 1.85, 1.0, { ry: 0 }));
  root.add(crosswalk(-4.1, 1.0, 1.2, { ry: Math.PI / 2 }));
  root.add(crosswalk(-6.3, 1.0, 1.2, { ry: Math.PI / 2 }));
  root.add(crosswalk(4.4, 1.85, 0.9, { ry: 0 }));
  root.add(crosswalk(4.4, -1.5, 0.9, { ry: 0 }));
  root.add(crosswalk(-5.2, -1.5, 1.0, { ry: 0 }));
  root.add(crosswalk(-5.2, 8.4, 1.0, { ry: 0 }));

  // Statue of Liberty on its star fort (left corner).
  root.add(statueOfLiberty({ x: -7.4, z: 7.4, ry: Math.PI / 4 }));
  root.add(row(-9.2, 3.2, -9.2, 5.2, 3, (x, z) => tree({ x, z, s: 0.7 })));

  // Empire State Building (back-left) and One WTC (back-right).
  root.add(empireState({ x: -7.3, z: -4.2 }));
  root.add(oneWTC({ x: 6.5, z: -6.9 }));

  // Midtown cluster with Times Square screens.
  root.add(artDeco(-3.2, -7.8, 1.6, 1.6, 5.4, mat(0xcfc8bb), LIMESTONE));
  root.add(chrysler(-1.0, -8.2));
  root.add(artDeco(1.6, -6.4, 1.8, 1.8, 6.0, mat(0xdcd4c4), LIMESTONE));
  root.add(skyBlock(-3.4, -4.6, 1.4, 1.4, 3.2, mat(0xe2d3b4)));
  root.add(artDeco(3.1, -4.2, 1.3, 1.4, 3.8, mat(0xcdd2d6), mat(0xe8e8e4)));
  root.add(skyBlock(3.0, -8.7, 1.4, 1.2, 2.8, mat(0xb7a998)));
  root.add(timesSquare(-1.0, -4.8, 1.7, 1.6, 3.3, mat(0xc9c6cc), 0));
  root.add(timesSquare(0.9, -3.4, 1.5, 1.5, 2.8, mat(0xa9a6ae), 2));
  root.add(timesSquare(-2.9, -3.25, 1.3, 1.3, 2.4, BRICKS[0], 4));
  root.add(building({ x: 1.5, z: -4.8, w: 1.0, d: 1.0, h: 4.0, wall: GLASS_DARK, trim: GLASS_TALL, windows: 'bands', plain: true }));

  // Front row of brownstones along 1st street, left side tenements, east-side row.
  [-3.9, -2.6, -1.3, 0.0, 1.3, 2.7].forEach((x, i) => root.add(walkUp(x, -0.55, 1.2, 1.0, 1.1 + (i % 3) * 0.35, i)));
  [-1.0, 0.6, 2.2, 3.7].forEach((z, i) => root.add(walkUp(-9.1, z, 1.4, 1.3, 1.5 + (i % 2) * 0.5, i + 2)));
  [-9.0, -7.5, -6.0, -4.5, -3.0].forEach((z, i) => root.add(walkUp(9.0, z, 1.2, 1.4, 1.2 + (i % 3) * 0.3, i + 1))); // x=9.0 keeps the +x fire escapes inside the plinth

  // Central Park: pavement frame, lawn, ring path, frozen pond.
  root.add(patch(PARK.w + 0.5, PARK.d + 0.5, mat(0xe6e1d4), { x: PARK.cx, z: PARK.cz }));
  root.add(patch(PARK.w, PARK.d, mat(0x9fcb82), { x: PARK.cx, z: PARK.cz, h: 0.06 }));
  const pathMat = mat(0xeee8d9);
  const pathOpts = { lines: false, material: pathMat } as const;
  const px0 = PARK.cx - PARK.w / 2 + 0.55;
  const px1 = PARK.cx + PARK.w / 2 - 0.55;
  const pz0 = PARK.cz - PARK.d / 2 + 0.5;
  const pz1 = PARK.cz + PARK.d / 2 - 0.5;
  const paths = [
    road(px0, pz0, px1, pz0, 0.3, pathOpts), road(px0, pz1, px1, pz1, 0.3, pathOpts),
    road(px0, pz0, px0, pz1, 0.3, pathOpts), road(px1, pz0, px1, pz1, 0.3, pathOpts),
    road(px0, PARK.cz, px1, PARK.cz, 0.22, pathOpts), road(PARK.cx, pz0, PARK.cx, pz1, 0.22, pathOpts),
  ];
  for (const p of paths) {
    p.position.y = 0.025;
    root.add(p);
  }
  root.add(area(ellipse(POND.rx + 0.14, POND.rz + 0.14), mat(0xe8e2d2), { x: POND.cx, z: POND.cz, h: 0.1 }));
  root.add(area(ellipse(POND.rx, POND.rz), waterMat(0x8fcdea), { x: POND.cx, z: POND.cz, h: 0.12 }));
  const near = (x: number, z: number) => {
    const dx = (x - POND.cx) / (POND.rx + 0.45);
    const dz = (z - POND.cz) / (POND.rz + 0.45);
    if (dx * dx + dz * dz < 1) return true;
    if (Math.abs(x - px0) < 0.25 || Math.abs(x - px1) < 0.25 || Math.abs(z - pz0) < 0.25 || Math.abs(z - pz1) < 0.25) return true;
    return Math.abs(x - PARK.cx) < 0.2 || Math.abs(z - PARK.cz) < 0.2;
  };
  const treeAt: [number, number, number][] = [];
  for (let n = 0, placed = 0; n < 400 && placed < 38; n++) {
    const x = PARK.cx + (rand() - 0.5) * (PARK.w - 0.5);
    const z = PARK.cz + (rand() - 0.5) * (PARK.d - 0.5);
    if (near(x, z)) continue;
    const s = 0.7 + rand() * 0.35;
    root.add(tree({ x, y: 0.06, z, s, kind: rand() < 0.45 ? 'cone' : 'round' }));
    treeAt.push([x, z, s]);
    placed++;
  }
  for (const [bx, bz, br] of [[-0.5, 4.2, 0], [-0.5, 6.8, Math.PI], [-2.5, 5.5, -Math.PI / 2], [1.5, 5.5, Math.PI / 2]] as const) {
    root.add(box(0.3, 0.03, 0.09, M.wood, { x: bx, y: 0.1, z: bz, ry: br }));
  }
  // New Yorkers: black, charcoal, camel, navy, denim, with a few bright scarves/coats.
  const COATS = [0x1b1b1f, 0x3a3d44, 0xc19a6b, 0x1f2d4d, 0x4a6fa5, 0x2b2b2b, 0xc19a6b, 0x1f2d4d, 0xd9382b, 0xf2b632, 0x3a3d44, 0x2f6d57];
  const newYorker = (y: number) => (x: number, z: number, i: number) => person({ x, y, z, color: COATS[i % COATS.length] });
  // Lawn crowd stays off trees, benches, the pond rim and the paths.
  const BENCHES: [number, number][] = [[-0.5, 4.2], [-0.5, 6.8], [-2.5, 5.5], [1.5, 5.5]];
  const blocked = (x: number, z: number) =>
    near(x, z) ||
    treeAt.some(([tx, tz, ts]) => Math.hypot(x - tx, z - tz) < 0.22 * ts + 0.12) ||
    BENCHES.some(([bx, bz]) => Math.hypot(x - bx, z - bz) < 0.4);
  root.add(scatter({ x: PARK.cx, z: PARK.cz, w: PARK.w - 0.4, d: PARK.d - 0.4 }, 14, rand, newYorker(0.06), blocked));
  // Walkers on the ring path (deck top 0.075) and the pavement frame / brownstone sidewalk (top 0.04 / 0).
  const ring: [number, number][] = [[px0, pz0], [px1, pz0], [px1, pz1], [px0, pz1]];
  for (let i = 0; i < 2; i++) root.add(anim.follow(newYorker(0.075)(0, 0, i + 1), ring, 0.3, i / 2, true));
  const frame: [number, number][] = [[-4.0, 2.46], [3.0, 2.46], [3.0, 2.56], [-4.0, 2.56]];
  root.add(anim.follow(newYorker(0.04)(0, 0, 5), frame, 0.3, 0, true));
  const walk: [number, number][] = [[-3.6, 0.1], [3.2, 0.1], [3.2, 0.18], [-3.6, 0.18]];
  for (let i = 0; i < 2; i++) root.add(anim.follow(newYorker(0)(0, 0, i + 8), walk, 0.3, i / 2, true));
  // Skaters circling the frozen pond (ice top 0.12).
  const ice: [number, number][] = ellipse(POND.rx - 0.35, POND.rz - 0.3, 16).map(([x, z]) => [POND.cx + x, POND.cz + z]);
  for (let i = 0; i < 2; i++) root.add(anim.follow(person({ color: COATS[(i * 4 + 8) % COATS.length], y: 0.12 }), ice, 0.7, i / 2, true));

  // Brooklyn Bridge across the East River.
  root.add(brooklynBridge(7.6));
  root.add(anim.bob(group({ x: 9.2, y: 0.04, z: 3.0 }, ...[]).add(box(0.5, 0.08, 1.1, mat(0x3d6fb6), { y: 0 }), box(0.3, 0.1, 0.4, M.white, { y: 0.08 })), 0.02, 1.1));
  root.add(anim.bob(group({ x: 6.4, y: 0.04, z: 4.6 }, ...[]).add(box(0.4, 0.07, 0.9, mat(0xc8433a), { y: 0 }), box(0.25, 0.08, 0.35, M.white, { y: 0.07 })), 0.02, 1.4));

  // Lamps and pedestrians.
  root.add(row(-9.5, 0.3, 5.2, 0.3, 9, (x, z) => lamp({ x, z })));
  root.add(row(-4.5, -9.5, -4.5, 9.5, 9, (x, z) => lamp({ x, z })));
  root.add(row(3.9, -9.5, 3.9, 9.5, 8, (x, z) => lamp({ x, z })));
  root.add(row(-4.0, 8.55, 5.2, 8.55, 6, (x, z) => lamp({ x, z })));
  root.add(steamVent(-4.2, 1.9, anim));
  root.add(steamVent(6.0, -3.6, anim));
  root.add(steamVent(2.4, -2.2, anim));

  // Taxi traffic.
  const solid = (c: THREE.Group) => {
    mergeStatic(c);
    return c;
  };
  const taxi = () => solid(car({ taxi: true, y: 0.05 }));
  const pickColored = (i: number) => (i % 3 === 0 ? solid(car({ y: 0.05 })) : taxi());
  const lane = (path: [number, number][], n: number, speed: number, off: number) => {
    for (let i = 0; i < n; i++) root.add(anim.follow(pickColored(i + Math.floor(off * 10)), path, speed, i / n + off));
  };
  lane([[-9.6, 0.75], [9.6, 0.75]], 2, 1.2, 0.0);
  lane([[9.6, 1.25], [-9.6, 1.25]], 2, 1.2, 0.2);
  lane([[-5.4, -9.6], [-5.4, 9.6]], 3, 1.3, 0.1);
  lane([[-5.0, 9.6], [-5.0, -9.6]], 2, 1.3, 0.4);
  lane([[4.25, -9.6], [4.25, 9.6]], 2, 1.2, 0.15);
  lane([[4.55, 9.6], [4.55, -9.6]], 2, 1.2, 0.5);
  lane([[-5.2, 9.0], [9.6, 9.0]], 2, 1.0, 0.1);
  lane([[9.6, 9.25], [-5.2, 9.25]], 1, 1.0, 0.45);
  lane([[-5.2, -2.1], [4.4, -2.1]], 1, 0.9, 0.3);

  // Bridge traffic follows the deck profile (ramps up onto the flat span).
  const deckY = (z: number) => {
    if (z > 7.0) return Math.max(0, 0.95 * ((8.55 - z) / 1.55));
    if (z < -1.0) return Math.max(0, 0.95 * ((z + 4.6) / 3.6));
    return 0.95;
  };
  for (const [bx, a, b] of [[7.1, 9.5, -9.6], [8.1, -9.6, 9.5]] as const) {
    for (let i = 0; i < 2; i++) {
      const c = anim.follow(taxi(), [[bx, a], [bx, b]], 1.1, i / 2 + (bx > 8 ? 0.12 : 0)) as THREE.Group;
      anim.add(() => { c.position.y = deckY(c.position.z) + 0.05; });
      root.add(c);
    }
  }

  return { root, update: anim.update };
}
