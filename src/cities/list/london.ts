import * as THREE from 'three';
import {
  Animator, M, beam, box, building, cone, createBase, crosswalk, cylinder, dome, floodMat, gableRoof, group, hipRoof, lamp, lathe, mat, tube, waterMat,
  patch, person, rng, road, row, scatter, sphere, tree, windowMaterial, boat, type Place,
} from '../../kit';
import { mergeStatic } from '../../kit/merge';
import type { CityScene } from '../types';

const SANDSTONE = mat(0xd8bd8a);
const SANDSTONE_DARK = mat(0xc4a56f);
const GOLD = mat(0xe1b13a, { roughness: 0.3, metalness: 0.8 });
const SPIRE_GREEN = mat(0x6f9a82, { roughness: 0.5, metalness: 0.2 });
const SLATE = mat(0x5f6b7a, { roughness: 0.7 });
const BUS_RED = mat(0xd02f2b, { roughness: 0.4 });
const CAB_BLACK = mat(0x1d1f23, { roughness: 0.35 });
const PORTLAND = mat(0xe6dfd0);
// Dome lead: plain by day, floodlit warm at night.
const LEAD = floodMat(0x8fa0a3, 0xffd9a0, 0.45, { roughness: 0.45 });
const SHARD_GLASS = mat(0x4a6f8c, { roughness: 0.1, metalness: 0.6 });
const SHARD_RIB = mat(0xc4deee, { roughness: 0.15, metalness: 0.55 });
const TB_STONE = mat(0xbfb7a4);
const TB_BLUE = mat(0x3f78b8, { roughness: 0.5, metalness: 0.2 });
const BRICK_COLORS = [mat(0xa8613f), mat(0xe8dcc3), mat(0xc9c4ba), mat(0xb5583f), mat(0xd9cdb6)];
const UMBRELLAS = [0xc8433a, 0x2f343b, 0x3d6fb6, 0xe0b43a, 0xf4f4f0];
const COATS = [0x2b2d33, 0x1f2a44, 0x3a3d42, 0xb08a5c, 0x23262b, 0x2d3a55, 0xc8433a, 0x4a4f57, 0xd9a93a, 0x7a6a55];

const RIVER_Z0 = -1.6;
const RIVER_Z1 = 2.6;
const ANCHOR_N = RIVER_Z0 - 1.4;
const ANCHOR_S = RIVER_Z1 + 1.5;

/** Gothic corner/ridge pinnacle. */
function pinnacle(x: number, y: number, z: number, h: number, m = SANDSTONE_DARK): THREE.Group {
  const g = group({ x, y, z });
  g.add(cylinder(0.04, 0.05, h * 0.55, m, { segments: 4 }));
  g.add(cone(0.06, h * 0.45, m, { y: h * 0.55, segments: 4 }));
  return g;
}

function westminster(p: Place): THREE.Group {
  // Identity: very long low Perpendicular Gothic river front, rhythm of buttress ribs with pinnacles,
  // projecting pavilions, steep slate roof, and the massive square Victoria Tower at one end.
  const g = group(p);
  const L = 5.8;
  const D = 1.4;
  const H = 1.2;
  const dark = mat(0x3a3f45);
  g.add(building({ w: L, d: D, h: H, wall: SANDSTONE, windows: 'none', roof: 'flat', plain: true }));
  g.add(gableRoof(L - 0.1, D - 0.1, 0.45, SLATE, { y: H }));
  g.add(box(L + 0.06, 0.1, D + 0.06, SANDSTONE_DARK, { y: 0 }));
  g.add(box(L + 0.06, 0.07, D + 0.06, SANDSTONE_DARK, { y: H - 0.07 }));
  // Regular bays on both long faces: buttress rib, tall window tier, upper window tier, pinnacle.
  const bays = 20;
  const step = (L - 0.2) / bays;
  for (const sz of [-1, 1]) {
    const zf = (D / 2) * sz;
    for (let i = 0; i <= bays; i++) {
      const x = -L / 2 + 0.1 + i * step;
      g.add(box(0.06, H + 0.05, 0.08, SANDSTONE_DARK, { x, z: zf + sz * 0.03 }));
      g.add(cone(0.05, 0.28, SANDSTONE_DARK, { x, y: H + 0.05, z: zf + sz * 0.03, segments: 4 }));
    }
    for (let i = 0; i < bays; i++) {
      const x = -L / 2 + 0.1 + (i + 0.5) * step;
      g.add(box(step * 0.5, 0.42, 0.03, dark, { x, y: 0.15, z: zf + sz * 0.005 }));
      g.add(box(step * 0.5, 0.36, 0.03, windowMaterial, { x, y: 0.68, z: zf + sz * 0.005 }));
      g.add(cone(step * 0.3, 0.12, dark, { x, y: 1.04, z: zf + sz * 0.005, segments: 4 }));
    }
  }
  // Projecting pavilions with gables, taller than the range.
  for (const x of [-1.9, 0.6, 2.2]) {
    g.add(box(0.7, 1.4, D + 0.16, SANDSTONE, { x }));
    g.add(gableRoof(0.76, D + 0.2, 0.55, SLATE, { x, y: 1.4 }));
    g.add(box(0.5, 0.45, 0.03, windowMaterial, { x, y: 0.5, z: D / 2 + 0.09 }));
    for (const sx of [-1, 1]) g.add(pinnacle(x + sx * 0.36, 1.4, D / 2 + 0.06, 0.55));
  }
  // Victoria Tower: massive square tower with corner turrets at the south end.
  const vx = -L / 2 - 0.1;
  g.add(building({ w: 1.1, d: 1.1, h: 3.4, x: vx, wall: SANDSTONE, windows: 'none', roof: 'flat', plain: true }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.12, 3.4, 0.12, SANDSTONE_DARK, { x: vx + sx * 0.55, z: sz * 0.55 }));
  for (let k = 0; k < 4; k++) {
    const f = group({ x: vx, ry: (k * Math.PI) / 2 });
    f.add(box(0.5, 0.9, 0.03, dark, { y: 0.5, z: 0.55 }));
    f.add(box(0.2, 0.5, 0.03, windowMaterial, { y: 1.9, z: 0.55 }));
    f.add(box(0.2, 0.4, 0.03, windowMaterial, { y: 2.6, z: 0.55 }));
    g.add(f);
  }
  g.add(box(1.2, 0.12, 1.2, SANDSTONE_DARK, { x: vx, y: 3.4 }));
  g.add(box(1.0, 0.4, 1.0, SANDSTONE, { x: vx, y: 3.52 }));
  g.add(box(1.06, 0.08, 1.06, GOLD, { x: vx, y: 3.92 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(pinnacle(vx + sx * 0.5, 3.9, sz * 0.5, 0.7));
  g.add(hipRoof(0.7, 0.7, 0.45, SLATE, { x: vx, y: 4.0 }));
  g.add(cylinder(0.01, 0.02, 0.4, GOLD, { x: vx, y: 4.45, segments: 5 }));
  return g;
}

function elizabethTower(p: Place): THREE.Group {
  // Identity: tall slim shaft, big clock stage with four dark-rimmed faces,
  // belfry with pinnacles, steep green pyramidal spire topped in gold.
  const g = group(p);
  const dark = mat(0x2a2f36);
  g.add(box(1.0, 0.3, 1.0, SANDSTONE_DARK));
  g.add(building({ w: 0.8, d: 0.8, h: 3.3, y: 0.3, wall: SANDSTONE, windows: 'none', roof: 'flat', plain: true }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.1, 3.3, 0.1, SANDSTONE_DARK, { x: sx * 0.4, z: sz * 0.4, y: 0.3 }));
  for (let k = 0; k < 4; k++) {
    const f = group({ ry: (k * Math.PI) / 2 });
    for (const y of [0.9, 1.7, 2.5]) f.add(box(0.12, 0.4, 0.03, dark, { y, z: 0.4 }));
    g.add(f);
  }
  g.add(box(0.92, 0.1, 0.92, SANDSTONE_DARK, { y: 3.6 }));
  // Clock stage.
  g.add(box(1.0, 1.4, 1.0, SANDSTONE, { y: 3.7 }));
  for (let k = 0; k < 4; k++) {
    const f = group({ ry: (k * Math.PI) / 2 });
    const rim = cylinder(0.46, 0.46, 0.04, dark, { segments: 28 });
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 4.4, 0.5);
    f.add(rim);
    const face = cylinder(0.4, 0.4, 0.04, M.white, { segments: 28 });
    face.rotation.x = Math.PI / 2;
    face.position.set(0, 4.4, 0.52);
    f.add(face);
    f.add(box(0.04, 0.34, 0.02, dark, { y: 4.4, z: 0.55 }));
    const hand = box(0.04, 0.24, 0.02, dark, { y: 4.4, z: 0.56 });
    hand.rotation.z = -1.9;
    f.add(hand);
    g.add(f);
  }
  g.add(box(1.1, 0.12, 1.1, GOLD, { y: 5.1 }));
  // Belfry.
  g.add(box(0.88, 0.8, 0.88, SANDSTONE, { y: 5.22 }));
  for (let k = 0; k < 4; k++) {
    const f = group({ ry: (k * Math.PI) / 2 });
    f.add(box(0.3, 0.5, 0.03, dark, { y: 5.37, z: 0.44 }));
    f.add(cone(0.15, 0.16, dark, { y: 5.87, z: 0.44, segments: 4 }));
    g.add(f);
  }
  g.add(box(1.02, 0.1, 1.02, SANDSTONE_DARK, { y: 6.02 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(pinnacle(sx * 0.47, 6.12, sz * 0.47, 0.6, SANDSTONE));
  // Green pyramidal spire with gold ledge and finial.
  g.add(hipRoof(0.9, 0.9, 2.1, SPIRE_GREEN, { y: 6.12 }));
  g.add(box(0.62, 0.05, 0.62, GOLD, { y: 6.92 }));
  g.add(sphere(0.07, GOLD, { y: 8.2, segments: 8 }));
  g.add(cylinder(0.01, 0.025, 0.3, GOLD, { y: 8.32, segments: 5 }));
  return g;
}

function stPauls(p: Place): THREE.Group {
  // Built at 1.3x so the dome carries over the city (set below).
  const g = group(p);
  g.scale.setScalar(1.3);
  // Nave runs along z, transept along x; west front faces +z.
  g.add(building({ w: 1.5, d: 3.6, h: 1.1, wall: PORTLAND, windows: 'bands', floorH: 0.5, roof: 'flat', plain: true }));
  g.add(box(3.0, 1.1, 1.4, PORTLAND));
  g.add(gableRoof(3.1, 1.5, 0.3, SLATE, { y: 1.1 }));
  g.add(gableRoof(1.6, 3.7, 0.3, SLATE, { y: 1.1, ry: Math.PI / 2 }));
  // Portico and pediment.
  g.add(box(1.3, 0.85, 0.5, PORTLAND, { z: 1.95 }));
  for (let i = 0; i < 6; i++) g.add(cylinder(0.045, 0.05, 0.7, M.white, { x: -0.5 + i * 0.2, y: 0.05, z: 2.22, segments: 8 }));
  g.add(gableRoof(1.3, 0.5, 0.35, PORTLAND, { y: 0.85, z: 1.95, ry: Math.PI / 2 }));
  // West towers.
  for (const sx of [-1, 1]) {
    const tx = sx * 0.9;
    g.add(box(0.55, 1.9, 0.55, PORTLAND, { x: tx, z: 1.7 }));
    g.add(box(0.62, 0.06, 0.62, PORTLAND, { x: tx, y: 1.9, z: 1.7 }));
    g.add(box(0.42, 0.4, 0.42, PORTLAND, { x: tx, y: 1.96, z: 1.7 }));
    for (const cx of [-1, 1]) for (const cz of [-1, 1]) g.add(cylinder(0.025, 0.03, 0.4, M.white, { x: tx + cx * 0.17, y: 1.96, z: 1.7 + cz * 0.17, segments: 6 }));
    g.add(cylinder(0.24, 0.24, 0.05, PORTLAND, { x: tx, y: 2.36, z: 1.7, segments: 12 }));
    g.add(cylinder(0.14, 0.17, 0.3, PORTLAND, { x: tx, y: 2.41, z: 1.7, segments: 10 }));
    g.add(dome(0.16, LEAD, { x: tx, y: 2.71, z: 1.7, segments: 12, squash: 1.5 }));
    g.add(sphere(0.035, GOLD, { x: tx, y: 2.95, z: 1.7, segments: 6 }));
    g.add(cylinder(0.008, 0.012, 0.2, GOLD, { x: tx, y: 3.0, z: 1.7, segments: 4 }));
  }
  // Drum, colonnade, dome and lantern.
  g.add(cylinder(0.78, 0.8, 0.65, PORTLAND, { y: 1.1, segments: 28 }));
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    g.add(cylinder(0.03, 0.035, 0.5, M.white, { x: Math.cos(a) * 0.84, z: Math.sin(a) * 0.84, y: 1.12, segments: 6 }));
  }
  g.add(cylinder(0.86, 0.86, 0.08, PORTLAND, { y: 1.65, segments: 28 }));
  g.add(cylinder(0.62, 0.7, 0.45, PORTLAND, { y: 1.73, segments: 28 }));
  // Lit gallery windows on the attic stage.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.add(box(0.07, 0.18, 0.04, windowMaterial, { x: Math.cos(a) * 0.68, z: Math.sin(a) * 0.68, y: 1.85, ry: -a + Math.PI / 2 }));
  }
  g.add(dome(0.66, LEAD, { y: 2.18, segments: 28, squash: 1.2 }));
  // Ribs run from the drum cornice up the lead dome to the lantern.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const at = (th: number): [number, number, number] => [Math.cos(a) * 0.675 * Math.sin(th), 2.18 + 0.79 * Math.cos(th), Math.sin(a) * 0.675 * Math.sin(th)];
    for (let j = 0; j < 4; j++) g.add(beam(at(Math.PI / 2 - (j / 4) * 1.15), at(Math.PI / 2 - ((j + 1) / 4) * 1.15), 0.022, PORTLAND));
  }
  g.add(cylinder(0.17, 0.2, 0.45, PORTLAND, { y: 2.9, segments: 12 }));
  g.add(dome(0.2, LEAD, { y: 3.35, segments: 12 }));
  g.add(sphere(0.06, GOLD, { y: 3.55, segments: 8 }));
  g.add(box(0.025, 0.28, 0.025, GOLD, { y: 3.7 }));
  g.add(box(0.14, 0.025, 0.025, GOLD, { y: 3.85 }));
  return g;
}

function shard(p: Place): THREE.Group {
  // Identity: tall dark-glass pyramid tapering to a needle, pale fracture ribs on the corners, lit window bands.
  const g = group(p);
  const W = 1.7;
  const H = 11.2;
  g.add(hipRoof(W, W, H, SHARD_GLASS));
  // Window bands hug the pyramid faces: a 4-sided frustum whose corner radius follows the taper.
  const taper = (W / 2) * Math.SQRT2 * 1.02;
  for (let y = 0.6; y < 9.6; y += 0.9) {
    g.add(cylinder(taper * (1 - (y + 0.14) / H), taper * (1 - y / H), 0.14, windowMaterial, { y, segments: 4, ry: Math.PI / 4 }));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(beam([sx * (W / 2) * 1.03, 0, sz * (W / 2) * 1.03], [sx * 0.02, H - 0.1, sz * 0.02], 0.05, SHARD_RIB));
  }
  g.add(cylinder(0.005, 0.02, 0.5, SHARD_RIB, { y: H - 0.1, segments: 4 }));
  return g;
}

function gherkin(p: Place): THREE.Group {
  // Identity: bulged egg-shaped glass tower tapering to a dome, diagonal lattice spiralling both ways, lit bands.
  const g = group(p);
  const H = 6.5;
  // Radius profile: foot ~60% of max, widest ~30% up, long taper to a point under the cap.
  const radius = (y: number): number => 0.62 * Math.sin(Math.PI * (0.2 + 0.8 * Math.pow(y / H, 0.8)));
  const steps = 14;
  const outline: [number, number][] = [];
  for (let i = 0; i <= steps; i++) outline.push([radius((i / steps) * H), (i / steps) * H]);
  g.add(lathe(outline, SHARD_GLASS, { segments: 24 }));
  // Lit floor bands hugging the hull.
  for (let y = 0.9; y < H - 0.8; y += 0.7) g.add(lathe([[radius(y) * 1.01, y], [radius(y + 0.12) * 1.01, y + 0.12]], windowMaterial, { segments: 24 }));
  // Diagonal lattice: two opposed families of helices following the hull.
  const strands = 8;
  const seg = 14;
  for (const dir of [-1, 1]) {
    for (let s = 0; s < strands; s++) {
      const phase = (s / strands) * Math.PI * 2;
      const at = (j: number): [number, number, number] => {
        const y = (j / seg) * (H - 0.3) + 0.1;
        const a = phase + dir * (y / H) * Math.PI * 1.5;
        const r = radius(y) * 1.025;
        return [Math.cos(a) * r, y, Math.sin(a) * r];
      };
      for (let j = 0; j < seg; j++) g.add(beam(at(j), at(j + 1), 0.022, SHARD_RIB));
    }
  }
  g.add(sphere(0.07, SHARD_RIB, { y: H - 0.03, segments: 8 }));
  return g;
}

function towerBridge(x: number): THREE.Group {
  // Identity: two heavy Gothic towers with corner turrets and steep roofs, a high blue walkway between them,
  // a low bascule deck, blue suspension chains falling to the banks.
  const g = group({ x });
  const zc = 0.5;
  const tz = [-0.6, 1.6];
  const roofM = mat(0x4f5d73, { roughness: 0.6 });
  for (const z of tz) {
    const t = group({ z });
    t.add(box(1.3, 0.25, 1.0, TB_STONE));
    t.add(building({ w: 1.2, d: 0.9, h: 2.5, y: 0.25, wall: TB_STONE, windows: 'none', roof: 'flat', plain: true }));
    // Recessed pointed-arch openings on the long faces.
    for (const sz of [-1, 1]) for (const ax of [-0.3, 0.3]) {
      t.add(box(0.2, 0.7, 0.03, M.dark, { x: ax, y: 0.9, z: sz * 0.45 }));
      t.add(box(0.2, 0.5, 0.03, windowMaterial, { x: ax, y: 1.8, z: sz * 0.45 }));
      t.add(cone(0.1, 0.18, M.dark, { x: ax, y: 1.6, z: sz * 0.45, segments: 4 }));
    }
    t.add(box(1.28, 0.1, 0.98, TB_STONE, { y: 2.75 }));
    t.add(box(1.0, 0.5, 0.78, TB_STONE, { y: 2.85 }));
    t.add(hipRoof(1.05, 0.85, 1.1, roofM, { y: 3.35 }));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      t.add(cylinder(0.11, 0.13, 3.2, TB_STONE, { x: sx * 0.6, z: sz * 0.45, segments: 8 }));
      t.add(cone(0.16, 0.6, roofM, { x: sx * 0.6, z: sz * 0.45, y: 3.2, segments: 8 }));
    }
    g.add(t);
  }
  // High-level walkway: blue girders with a glazed gallery.
  g.add(box(0.95, 0.12, 1.5, TB_BLUE, { y: 2.45, z: zc }));
  g.add(box(0.8, 0.14, 1.5, windowMaterial, { y: 2.57, z: zc }));
  g.add(box(0.95, 0.07, 1.5, TB_BLUE, { y: 2.71, z: zc }));
  // Suspension chains to the bank anchors.
  for (const sx of [-1, 1]) {
    for (const [zt, zb] of [[tz[0], ANCHOR_N], [tz[1], ANCHOR_S]] as const) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const k = i / 8;
        const y = 3.0 + (0.3 - 3.0) * k - Math.sin(Math.PI * k) * 0.45;
        pts.push(new THREE.Vector3(sx * 0.55, y, zt + (zb - zt) * k));
        // Skip hangers that would stand in an embankment lane.
        const inLane = Math.abs(zt + (zb - zt) * k - -2.3) < 0.45 || Math.abs(zt + (zb - zt) * k - 3.5) < 0.45;
        if (i > 0 && i < 8 && !inLane) g.add(beam([sx * 0.55, 0.05, zt + (zb - zt) * k], [sx * 0.55, y, zt + (zb - zt) * k], 0.012, TB_BLUE));
      }
      g.add(tube(pts, 0.025, TB_BLUE, { segments: 24 }));
    }
    g.add(box(0.05, 0.14, RIVER_Z1 - RIVER_Z0 + 0.3, TB_BLUE, { x: sx * 0.5, y: 0.05, z: zc }));
  }
  // Bascule leaves between the towers, and anchor pillars flanking the approach so both roads stay open.
  g.add(box(0.8, 0.012, 1.2, mat(0x8f949b), { y: 0.05, z: zc }));
  for (const z of [ANCHOR_N, ANCHOR_S]) for (const sx of [-1, 1]) {
    g.add(box(0.2, 0.4, 0.3, TB_STONE, { x: sx * 0.55, z }));
    g.add(box(0.26, 0.05, 0.36, TB_STONE, { x: sx * 0.55, y: 0.4, z }));
  }
  return g;
}

function westminsterBridge(x: number): THREE.Group {
  const g = group({ x });
  const green = mat(0x5d8b66, { roughness: 0.6 });
  for (const sx of [-1, 1]) g.add(box(0.05, 0.12, RIVER_Z1 - RIVER_Z0 + 0.1, green, { x: sx * 0.5, y: 0.05, z: 0.5 }));
  // Piers flank the road (cars drive over the middle) and rise clear of the water.
  for (const sx of [-1, 1]) for (const z of [-0.8, 0.5, 1.8]) g.add(box(0.2, 0.32, 0.2, TB_STONE, { x: sx * 0.66, y: -0.05, z }));
  for (const sx of [-1, 1]) for (const z of [-1.2, -0.3, 0.5, 1.3, 2.2]) g.add(lamp({ x: sx * 0.5, y: 0.05, z }));
  return g;
}

function londonEye(p: Place, anim: Animator): THREE.Group {
  // Identity: bold white rim, cable spokes to a hub, blue egg pods outside the rim, cantilevered A-frame on one side.
  const g = group(p);
  const R = 2.6;
  const hubY = 3.3;
  const white = floodMat(0xf5f5f2, 0xcfe4ff, 0.8, { roughness: 0.4 });
  const cable = mat(0xdfe3e6, { roughness: 0.5 });
  const wheel = group({ y: hubY });
  const N = 48;
  const pt = (a: number, x: number, r = R): [number, number, number] => [x, Math.cos(a) * r, Math.sin(a) * r];
  const rig = group();
  for (const x of [-0.1, 0.1]) {
    for (let i = 0; i < N; i++) rig.add(beam(pt((i / N) * Math.PI * 2, x), pt(((i + 1) / N) * Math.PI * 2, x), 0.06, white));
    for (let i = 0; i < 24; i++) rig.add(beam([x * 0.3, 0, 0], pt((i / 24) * Math.PI * 2, x), 0.014, cable));
  }
  for (let i = 0; i < N; i += 2) rig.add(beam(pt((i / N) * Math.PI * 2, -0.1), pt((i / N) * Math.PI * 2, 0.1), 0.03, white));
  rig.add(cylinder(0.2, 0.2, 0.46, white, { segments: 12 }).rotateZ(Math.PI / 2).translateY(-0.23));
  mergeStatic(rig);
  wheel.add(rig);
  // Bold blue pods, lit at night like the real wheel; egg-shaped, long axis along the rim tangent.
  const capMat = floodMat(0x5b9bd8, 0xbfe3ff, 1.1, { roughness: 0.25 });
  const caps: THREE.Group[] = [];
  const CAPS = 32;
  for (let i = 0; i < CAPS; i++) {
    const a = ((i + 0.5) / CAPS) * Math.PI * 2;
    const c = group({ y: Math.cos(a) * R });
    c.position.z = Math.sin(a) * R;
    const pod = sphere(0.1, capMat, { y: -0.17, x: 0.2, segments: 8 });
    pod.scale.set(0.8, 1, 1.15);
    c.add(pod);
    wheel.add(c);
    caps.push(c);
  }
  wheel.userData.dynamic = true;
  anim.add((_t, dt) => {
    wheel.rotation.x += dt * 0.05;
    for (const c of caps) c.rotation.x = -wheel.rotation.x;
  });
  g.add(wheel);
  // A-frame on the -x side holding the axle: front and rear legs meeting at the hub.
  g.add(beam([-0.36, 0, 1.7], [-0.16, hubY, 0], 0.1, white));
  g.add(beam([-0.36, 0, -1.3], [-0.16, hubY, 0], 0.1, white));
  g.add(beam([-0.36, 0.05, 1.7], [-0.36, 0.05, -1.3], 0.08, white));
  g.add(patch(1.2, 0.9, mat(0xb9b4aa), { z: 1.3, x: 0.2 }));
  return g;
}

function doubleDecker(p: Place = {}): THREE.Group {
  const g = group(p);
  g.add(box(0.26, 0.11, 0.8, BUS_RED, { y: 0.03 }));
  g.add(box(0.268, 0.04, 0.7, windowMaterial, { y: 0.075 }));
  g.add(box(0.26, 0.11, 0.8, BUS_RED, { y: 0.14 }));
  g.add(box(0.268, 0.045, 0.7, windowMaterial, { y: 0.17 }));
  g.add(box(0.24, 0.012, 0.78, BUS_RED, { y: 0.25 }));
  mergeStatic(g);
  return g;
}

const WHEEL = mat(0x1a1c20);
const SHOP_COLORS = [0x2f5d8a, 0x1f6b4a, 0x8a2f3a, 0x2f343b];
const MINI_COLORS = [mat(0x3d6fb6, { roughness: 0.4 }), mat(0xf4f4f0, { roughness: 0.4 }), mat(0x5c9c6b, { roughness: 0.4 }), mat(0x8a2f3a, { roughness: 0.4 })];
function miniCar(i: number): THREE.Group {
  const g = group({ y: 0.05 });
  g.add(box(0.22, 0.08, 0.42, MINI_COLORS[i % MINI_COLORS.length], { y: 0.05 }));
  g.add(box(0.18, 0.07, 0.22, windowMaterial, { y: 0.13, z: -0.02 }));
  for (const sx of [-1, 1]) for (const z of [-0.13, 0.13]) g.add(box(0.04, 0.06, 0.07, WHEEL, { x: sx * 0.115, y: 0, z }));
  mergeStatic(g);
  return g;
}

function blackCab(p: Place = {}): THREE.Group {
  const g = group(p);
  g.add(box(0.2, 0.07, 0.42, CAB_BLACK, { y: 0.03 }));
  g.add(box(0.18, 0.07, 0.2, CAB_BLACK, { y: 0.1, z: -0.05 }));
  g.add(box(0.19, 0.04, 0.19, windowMaterial, { y: 0.115, z: -0.05 }));
  g.add(box(0.07, 0.025, 0.04, CAB_BLACK, { y: 0.17, z: -0.02 }));
  mergeStatic(g);
  return g;
}

function phoneBox(x: number, z: number, ry = 0): THREE.Group {
  const g = group({ x, z, ry });
  g.add(box(0.075, 0.2, 0.075, BUS_RED));
  g.add(box(0.06, 0.13, 0.078, windowMaterial, { y: 0.04 }));
  g.add(dome(0.04, BUS_RED, { y: 0.2, segments: 8, squash: 0.6 }));
  return g;
}

function terrace(x: number, z: number, w: number, d: number, h: number, i: number, ry = 0): THREE.Group {
  return building({ w, d, h, x, z, ry, wall: BRICK_COLORS[i % BRICK_COLORS.length], windows: 'grid', floorH: 0.5, roof: i % 3 === 1 ? 'hip' : 'gable', roofMat: SLATE, roofH: Math.min(d, w) * 0.28, shop: SHOP_COLORS[i % SHOP_COLORS.length] });
}

export default function build(): CityScene {
  const rand = rng(51);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: M.asphalt, side: mat(0x4d535b, { roughness: 0.9 }) }));

  // Pavement ground on both banks.
  root.add(patch(19.6, 7.6, mat(0xa9a9a6), { z: -5.8, h: 0.02 }));
  root.add(patch(19.6, 6.6, mat(0xa9a9a6), { z: 6.5, h: 0.02 }));

  // River Thames across the whole tile.
  root.add(patch(19.9, RIVER_Z1 - RIVER_Z0, waterMat(0x6f94ad), { z: (RIVER_Z0 + RIVER_Z1) / 2, h: 0.03 }));
  const wallM = mat(0xb8b3a8, { roughness: 0.8 });
  const BX = [-0.35, 0.75, 5.15, 6.25];
  for (const z of [RIVER_Z0 - 0.07, RIVER_Z1 + 0.07]) {
    for (const [a, b] of [[-9.9, BX[0]], [BX[1], BX[2]], [BX[3], 9.9]] as const) {
      root.add(patch(b - a, 0.14, wallM, { x: (a + b) / 2, z, h: 0.07 }));
    }
  }
  // Parks / lawns.
  root.add(patch(5.0, 1.6, M.grass, { x: -6.8, z: -5.2, h: 0.03 }));
  root.add(patch(3.4, 1.9, M.grass, { x: 2.8, z: 7.2, h: 0.03 }));
  root.add(patch(5.2, 1.6, M.grass, { x: -6.6, z: 6.6, h: 0.03 }));

  // Roads: embankments and two crossings.
  const RD = mat(0x575d66, { roughness: 0.95, surface: 'road' });
  root.add(road(-10, -2.3, 10, -2.3, 0.6, { material: RD }));
  root.add(road(-10, 3.5, 10, 3.5, 0.6, { material: RD }));
  root.add(road(0.2, -10, 0.2, 10, 0.9, { material: RD }));
  root.add(road(5.7, -10, 5.7, 10, 0.9, { material: RD }));

  // Landmarks.
  root.add(westminster({ x: -5.2, z: -3.7 }));
  root.add(elizabethTower({ x: -1.6, z: -3.7 }));
  root.add(stPauls({ x: 2.7, z: -7.4 }));
  root.add(gherkin({ x: 4.5, z: -9.1 }));
  root.add(shard({ x: 7.7, z: -7.9 }));
  root.add(towerBridge(5.7));
  root.add(westminsterBridge(0.2));
  for (const [x, z, ry, w] of [[0.2, -3.0, 0, 0.9], [0.2, 4.2, 0, 0.9], [5.7, -3.0, 0, 0.9], [5.7, 4.2, 0, 0.9], [-4.0, -2.3, Math.PI / 2, 0.6]] as const) {
    root.add(crosswalk(x, z, w, { ry }));
  }
  root.add(londonEye({ x: -4.2, z: 3.0 }, anim));

  // Plazas and filler buildings.
  root.add(terrace(-8.4, -8.6, 2.2, 1.3, 1.4, 0));
  root.add(terrace(-5.8, -8.6, 2.6, 1.3, 1.8, 1));
  root.add(terrace(-2.6, -8.6, 2.0, 1.3, 1.5, 2));
  root.add(terrace(-1.3, -6.0, 1.0, 1.6, 1.6, 3));
  root.add(terrace(8.1, -3.9, 2.4, 1.2, 1.4, 4));
  root.add(terrace(8.4, -5.2, 1.6, 1.0, 1.8, 0));
  root.add(terrace(2.8, -3.3, 2.6, 0.9, 1.4, 1));
  root.add(terrace(3.4, 5.4, 3.2, 1.3, 1.3, 2));
  root.add(terrace(2.4, 8.7, 2.6, 1.3, 1.8, 3));
  root.add(terrace(8.2, 5.6, 2.4, 1.4, 1.5, 4));
  root.add(terrace(8.2, 8.2, 2.4, 1.5, 1.9, 0));
  root.add(terrace(-8.9, 8.9, 1.4, 1.4, 1.3, 1));
  root.add(terrace(-2.2, 8.8, 1.6, 1.3, 1.5, 4));

  // Street furniture.
  root.add(row(-9.5, -1.95, 9.5, -1.95, 14, (x, z) => (Math.abs(x - 0.2) < 1 || Math.abs(x - 5.7) < 1 ? group() : lamp({ x, z }))));
  root.add(row(-9.5, 3.9, 9.5, 3.9, 14, (x, z) => (Math.abs(x - 0.2) < 1 || Math.abs(x - 5.7) < 1 || Math.abs(x + 4.2) < 1 ? group() : lamp({ x, z }))));
  for (const [x, z, ry] of [[-3.2, -1.95, 0], [-2.6, -1.95, 0], [1.1, -2.0, 0], [-6.1, 4.0, 0], [-1.2, 4.0, 0], [4.2, 3.95, 0], [7.0, -1.95, 0]] as const) {
    root.add(phoneBox(x, z, ry));
  }
  root.add(row(-9.2, -1.85, -6.0, -1.85, 4, (x, z) => tree({ x: x + 0.2, z, s: 0.9 })));
  root.add(scatter({ x: -6.8, z: -5.2, w: 4.6, d: 1.1 }, 7, rand, (x, z) => tree({ x, z, s: 0.85 + rand() * 0.3 })));
  root.add(scatter({ x: 2.8, z: 7.2, w: 3.0, d: 1.4 }, 6, rand, (x, z) => tree({ x, z, s: 0.85 + rand() * 0.3 })));
  root.add(scatter({ x: -6.6, z: 6.6, w: 4.8, d: 1.2 }, 7, rand, (x, z) => tree({ x, z, s: 0.9 + rand() * 0.3 })));
  root.add(row(-9.3, 4.4, -9.3, 7.4, 4, (x, z) => tree({ x, z, s: 0.85 })));
  root.add(row(-1.4, 4.5, -1.4, 7.4, 4, (x, z) => tree({ x, z, s: 0.8 })));
  root.add(row(6.8, -1.85, 9.4, -1.85, 4, (x, z) => tree({ x, z, s: 0.8 })));
  // Londoners: dark wool, navy, charcoal, camel/trench, a few red and yellow raincoats; most under umbrellas.
  const londoner = (x: number, y: number, z: number, i: number, dry = false) =>
    person({ x, y, z, color: COATS[i % COATS.length], umbrella: dry ? undefined : UMBRELLAS[(i * 2 + 1) % UMBRELLAS.length] });
  const lampX = [-5.12, -3.65];
  // Eye quay crowd on the pavement (top 0.02): off the Eye's A-frame foot, phone boxes and the walker lane at z 5.3-5.6.
  const onEyeFoot = (x: number, z: number) => (Math.abs(x + 4.56) < 0.3 && z < 5.0) || (Math.abs(x + 6.1) < 0.3 && z < 4.3) || (Math.abs(x + 1.2) < 0.3 && z < 4.3);
  root.add(scatter({ x: -4.2, z: 4.65, w: 4.6, d: 1.1 }, 14, rand, (x, z, i) => londoner(x, 0.02, z, i), onEyeFoot));
  // Strip between the north embankment road and the river wall (asphalt, top 0): clear of lamps and phone boxes.
  root.add(scatter({ x: -4.55, z: -1.87, w: 2.1, d: 0.06 }, 5, rand, (x, z, i) => londoner(x, 0, z, i + 3), (x) => lampX.some((lx) => Math.abs(x - lx) < 0.14) || Math.abs(x + 4.0) < 0.1));
  root.add(scatter({ x: 2.7, z: -4.15, w: 3.4, d: 0.3 }, 6, rand, (x, z, i) => londoner(x, 0.02, z, i + 6)));
  // Walkers: the Eye quay, the strip south of the road by the river, the Tower Bridge embankment and Westminster Bridge.
  const eyeWalk: [number, number][] = [[-6.3, 5.3], [-2.2, 5.3], [-2.2, 5.6], [-6.3, 5.6]];
  for (let i = 0; i < 2; i++) root.add(anim.follow(londoner(0, 0.02, 0, i + 1, i === 1), eyeWalk, 0.26, i / 2, true));
  const quayWalk: [number, number][] = [[-9.2, 2.88], [-5.4, 2.88], [-5.4, 2.98], [-9.2, 2.98]];
  root.add(anim.follow(londoner(0, 0, 0, 4), quayWalk, 0.24, 0.3, true));
  const towerWalk: [number, number][] = [[6.8, 4.2], [9.3, 4.2], [9.3, 4.5], [6.8, 4.5]];
  root.add(anim.follow(londoner(0, 0.02, 0, 5, true), towerWalk, 0.25, 0, true));
  // Westminster Bridge: dry walkers on the free edges of the deck (top 0.05), outside the car lanes (x 0.0 and 0.4).
  const bridgeE: [number, number][] = [[0.595, -1.7], [0.595, 2.7]];
  const bridgeW: [number, number][] = [[-0.18, 2.7], [-0.18, -1.7]];
  root.add(anim.follow(londoner(0, 0.05, 0, 0, true), bridgeE, 0.22, 0, true));
  root.add(anim.follow(londoner(0, 0.05, 0, 7, true), bridgeW, 0.22, 0.4, true));

  // Traffic: left-hand driving. Embankment roads.
  const alongX = (z: number, dir: 1 | -1): [number, number][] => [[-dir * 9.6, z], [dir * 9.6, z]];
  const alongZ = (x: number, dir: 1 | -1): [number, number][] => [[x, -dir * 9.6], [x, dir * 9.6]];
  const fleet = (path: [number, number][], speed: number, n: number, kinds: ('bus' | 'cab' | 'car')[], off: number) => {
    for (let i = 0; i < n; i++) {
      const k = kinds[i % kinds.length];
      const o = k === 'bus' ? doubleDecker({ y: 0.05 }) : k === 'cab' ? blackCab({ y: 0.05 }) : miniCar(i);
      mergeStatic(o);
      root.add(anim.follow(o, path, speed, i / n + off));
    }
  };
  fleet(alongX(-2.45, 1), 1.3, 4, ['bus', 'cab', 'cab', 'car'], 0);
  fleet(alongX(-2.15, -1), 1.3, 4, ['cab', 'bus', 'car', 'cab'], 0.1);
  fleet(alongX(3.35, 1), 1.2, 4, ['bus', 'cab', 'car', 'cab'], 0.05);
  fleet(alongX(3.65, -1), 1.2, 4, ['cab', 'cab', 'bus', 'car'], 0.2);
  fleet(alongZ(0.0, 1), 1.0, 4, ['bus', 'cab', 'cab', 'bus'], 0.05);
  fleet(alongZ(0.4, -1), 1.0, 4, ['cab', 'bus', 'car', 'cab'], 0.15);
  fleet(alongZ(5.5, 1), 1.0, 3, ['bus', 'cab', 'car'], 0.1);
  fleet(alongZ(5.9, -1), 1.0, 3, ['cab', 'car', 'bus'], 0.3);

  // Boats on the Thames, staying clear of the bridges.
  const boats: [number, number, number, number, number, number][] = [
    [-9.6, -1.1, 0.2, 0.6, 0.6, 0xf4f4f0],
    [-1.1, -9.6, 1.5, 0.5, 0.2, 0xd0453a],
    [1.3, 4.5, 0.0, 0.5, 0.5, 0x3d6fb6],
    [4.5, 1.3, 1.0, 0.45, 0.1, 0xf4f4f0],
    [6.9, 9.6, 0.6, 0.4, 0.3, 0xe0b43a],
  ];
  for (const [x1, x2, z, speed, off, color] of boats) {
    const b = boat({ y: 0.0, len: 0.9, color });
    mergeStatic(b);
    root.add(anim.follow(b, [[x1, z], [x2, z]], speed, off));
  }

  return { root, update: anim.update };
}
