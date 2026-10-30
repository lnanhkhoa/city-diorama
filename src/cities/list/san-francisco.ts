import * as THREE from 'three';
import {
  Animator, M, beam, box, building, car, cone, createBase, crosswalk, cylinder, dome, floodMat, gableRoof, group, lamp, lampMaterial, lathe, mat,
  mergeStatic, patch, person, prism, profile, rng, road, row, scatter, tower, tree, tube, waterMat, windowMaterial, boat, type Place,
} from '../../kit';
import type { CityScene } from '../types';

const ORANGE = mat(0xc0362c, { roughness: 0.5 });
const ORANGE_DARK = mat(0x9c2a22, { roughness: 0.5 });
const ROCK = mat(0x9a9082, { roughness: 0.95, flat: true });
const HEADLAND = mat(0x9fae6a, { roughness: 0.95 });
const LAND = mat(0xbab7b0);
const CONCRETE_W = mat(0xece9e2);
const PASTEL = [0xe9c6b8, 0x9fc3d6, 0xf1dd9a, 0xc9d8b6, 0xd8b7d4, 0xf3e7d0];
// Floodlit at night like the real bridge towers; the cables and deck keep the plain orange.
const ORANGE_LIT = floodMat(0xc0362c, 0xff7a3c, 0.55, { roughness: 0.5 });
const TRAFFIC = [0xc8433a, 0x3d6fb6, 0xf4f4f0, 0x2f343b, 0xe0b43a, 0x6a9a5b];

// Bridge layout (bridge runs along X at z = BZ, deck at y = DECK).
const BZ = 8.6;
const DECK = 1.0;
const TOWER_X = 5.0;
const TOWER_H = 4.4;
const LEG_Z = 0.58;

function goldenGateBridge(anim: Animator): THREE.Group {
  const g = group();
  // Deck: truss underside, road surface, edge rails.
  g.add(box(19.6, 0.2, 0.84, ORANGE_DARK, { y: DECK - 0.2, z: BZ }));
  g.add(box(19.6, 0.1, 0.8, ORANGE, { y: DECK - 0.02, z: BZ }));
  g.add(box(19.6, 0.03, 0.62, mat(0x484d55, { roughness: 0.95 }), { y: DECK + 0.08, z: BZ }));
  for (const s of [-1, 1]) g.add(box(19.6, 0.1, 0.04, ORANGE, { y: DECK + 0.08, z: BZ + s * 0.38 }));
  // Truss diagonals under the deck.
  for (let x = -9.4; x < 9.4; x += 0.7) {
    g.add(beam([x, DECK - 0.2, BZ + 0.43], [x + 0.35, DECK, BZ + 0.43], 0.03, ORANGE));
    g.add(beam([x + 0.35, DECK - 0.2, BZ + 0.43], [x + 0.7, DECK, BZ + 0.43], 0.03, ORANGE));
  }

  // Art Deco towers: tapering legs, four portal struts with recessed panels, stepped caps.
  const struts = [1.65, 2.5, 3.25, 3.9] as const;
  for (const tx of [-TOWER_X, TOWER_X]) {
    g.add(cylinder(0.62, 0.72, 0.28, ROCK, { x: tx, z: BZ, segments: 12 }));
    for (const s of [-1, 1]) {
      const leg = cylinder(0.1, 0.19, TOWER_H, ORANGE_LIT, { x: tx, z: BZ + s * LEG_Z, y: 0.1, segments: 4, ry: Math.PI / 4 });
      leg.scale.x = 1.5;
      g.add(leg);
      // Stepped Deco cap on each leg.
      g.add(box(0.3, 0.08, 0.2, ORANGE_LIT, { x: tx, y: TOWER_H + 0.1, z: BZ + s * LEG_Z }));
      g.add(box(0.2, 0.1, 0.13, ORANGE_LIT, { x: tx, y: TOWER_H + 0.18, z: BZ + s * LEG_Z }));
      // Beacon on each leg.
      g.add(box(0.07, 0.1, 0.07, lampMaterial, { x: tx, y: TOWER_H + 0.28, z: BZ + s * LEG_Z }));
    }
    const span = LEG_Z * 2;
    struts.forEach((y, i) => {
      g.add(box(0.27 - i * 0.02, 0.17, span, ORANGE_LIT, { x: tx, y, z: BZ }));
      const next = i + 1 < struts.length ? struts[i + 1] : TOWER_H + 0.1;
      // Recessed panel between struts, with an X brace on the lower two bays.
      g.add(box(0.12, next - y - 0.17, span, ORANGE_DARK, { x: tx, y: y + 0.17, z: BZ }));
      if (i < 2) {
        g.add(beam([tx, y + 0.17, BZ - LEG_Z + 0.1], [tx, next, BZ + LEG_Z - 0.1], 0.04, ORANGE_LIT));
        g.add(beam([tx, y + 0.17, BZ + LEG_Z - 0.1], [tx, next, BZ - LEG_Z + 0.1], 0.04, ORANGE_LIT));
      }
    });
    // Top strut bridging the legs under the cap, with a finial.
    g.add(box(0.22, 0.14, span + 0.3, ORANGE_LIT, { x: tx, y: TOWER_H + 0.1 - 0.02, z: BZ }));
  }

  // Main cables (parabolic main span + sagging side spans) and suspenders.
  const topY = TOWER_H + 0.1;
  const lowY = 1.45;
  const anchorY = 1.35;
  const cableY = (x: number): number => {
    const a = Math.abs(x);
    if (a <= TOWER_X) return lowY + (topY - lowY) * (x / TOWER_X) ** 2;
    const u = (a - TOWER_X) / (9.6 - TOWER_X);
    return topY + (anchorY - topY) * u - 0.35 * 4 * u * (1 - u);
  };
  const spanPts = (x0: number, x1: number, zz: number): THREE.Vector3[] => {
    const pts: THREE.Vector3[] = [];
    const n = 24;
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      pts.push(new THREE.Vector3(x, cableY(x), zz));
    }
    return pts;
  };
  for (const s of [-1, 1]) {
    const zz = BZ + s * LEG_Z;
    g.add(tube(spanPts(-TOWER_X, TOWER_X, zz), 0.05, ORANGE, { segments: 48 }));
    g.add(tube(spanPts(-9.6, -TOWER_X, zz), 0.045, ORANGE, { segments: 24 }));
    g.add(tube(spanPts(TOWER_X, 9.6, zz), 0.045, ORANGE, { segments: 24 }));
    for (let x = -9.4; x <= 9.4; x += 0.5) {
      if (Math.abs(Math.abs(x) - TOWER_X) < 0.25) continue;
      g.add(beam([x, DECK + 0.1, zz], [x, cableY(x), zz], 0.018, ORANGE));
    }
  }
  // Anchorage blocks.
  for (const sx of [-1, 1]) g.add(box(0.5, 1.25, 1.6, CONCRETE_W, { x: sx * 9.5, z: BZ, y: 0.2 }));

  // Deck lamps: a bulb on a short post along each rail (lampMaterial follows the city lights).
  for (let x = -9.2; x <= 9.2; x += 0.8) {
    for (const s of [-1, 1]) {
      g.add(box(0.012, 0.1, 0.012, ORANGE, { x, y: DECK + 0.18, z: BZ + s * 0.38 }));
      g.add(box(0.05, 0.04, 0.05, lampMaterial, { x, y: DECK + 0.27, z: BZ + s * 0.38 }));
    }
  }

  // Traffic on the deck: two short platoons per lane (draw calls scale with materials, not cars). A platoon's
  // tail trails the lead car, so it must stay short enough to remain on the plinth where the lane wraps.
  const gaps = [0, 0.8, 1.4];
  g.add(anim.follow(convoy(0, gaps, 0.62, DECK + 0.1), [[-8.9, BZ + 0.16], [8.9, BZ + 0.16]], 1.0, 0.05));
  g.add(anim.follow(convoy(2, gaps, 0.62, DECK + 0.1), [[-8.9, BZ + 0.16], [8.9, BZ + 0.16]], 1.0, 0.55));
  g.add(anim.follow(convoy(1, gaps, 0.62, DECK + 0.1), [[8.9, BZ - 0.16], [-8.9, BZ - 0.16]], 1.0, 0.3));
  g.add(anim.follow(convoy(3, gaps, 0.62, DECK + 0.1), [[8.9, BZ - 0.16], [-8.9, BZ - 0.16]], 1.0, 0.8));
  return g;
}

function alcatraz(p: Place): THREE.Group {
  const g = group(p);
  const concrete = floodMat(0xd9d2c2, 0xffd9a0, 0.35);
  const roofC = mat(0x8c8a84, { roughness: 0.8 });
  // Rocky island: stacked cliff tiers, squashed along z so the enlarged rock stays inside the bay.
  const tiers = [[1.15, 1.4, 0.3, 0, ROCK], [1.0, 1.15, 0.2, 0.3, ROCK], [0.9, 1.0, 0.06, 0.5, mat(0x8fa070, { roughness: 1 })]] as const;
  for (const [rTop, rBot, h, y, m] of tiers) {
    const t = cylinder(rTop, rBot, h, m, { y, segments: 9 });
    t.scale.z = 0.8;
    g.add(t);
  }
  // Pier on the landing side.
  g.add(box(0.2, 0.06, 0.4, M.wood, { x: 0.2, y: 0.12, z: 1.25 }));
  // Long cell house with a shallow gable roof, window rows and an end annex.
  const ch = group({ x: -0.15, y: 0.56, z: 0.05 });
  ch.add(building({ w: 1.7, d: 0.55, h: 0.55, wall: concrete, trim: M.white, roof: 'gable', roofMat: roofC, roofH: 0.16, windows: 'grid', floorH: 0.2, plain: true }));
  ch.add(box(1.74, 0.04, 0.59, M.white, { y: 0.28 }));
  g.add(ch);
  g.add(building({ w: 0.6, d: 0.45, h: 0.4, x: -0.5, y: 0.56, z: -0.6, wall: mat(0xcfc3ac), roof: 'flat', windows: 'grid', floorH: 0.2, plain: true }));
  // Guard tower at the corner.
  g.add(cylinder(0.05, 0.05, 0.3, concrete, { x: 0.75, y: 0.56, z: -0.45, segments: 8 }));
  g.add(cylinder(0.08, 0.08, 0.08, M.dark, { x: 0.75, y: 0.86, z: -0.45, segments: 8 }));
  g.add(cone(0.09, 0.08, roofC, { x: 0.75, y: 0.94, z: -0.45, segments: 8 }));
  // Water tower: tank on a braced four-leg frame with a conical cap.
  const wx = -0.95;
  const wz = -0.1;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(beam([wx + sx * 0.08, 0.56, wz + sz * 0.08], [wx + sx * 0.06, 1.05, wz + sz * 0.06], 0.025, M.dark));
  g.add(beam([wx - 0.08, 0.7, wz - 0.08], [wx + 0.06, 0.95, wz + 0.06], 0.015, M.dark));
  g.add(beam([wx + 0.08, 0.7, wz - 0.08], [wx - 0.06, 0.95, wz + 0.06], 0.015, M.dark));
  g.add(cylinder(0.12, 0.12, 0.26, M.wood, { x: wx, y: 1.05, z: wz, segments: 10 }));
  g.add(cone(0.14, 0.12, roofC, { x: wx, y: 1.31, z: wz, segments: 10 }));
  // Lighthouse: tapering white tower, gallery, lantern, red cap.
  const lx = 0.75;
  const lz = 0.0;
  g.add(box(0.3, 0.12, 0.3, concrete, { x: lx, y: 0.56, z: lz }));
  g.add(cylinder(0.075, 0.12, 0.85, M.white, { x: lx, y: 0.68, z: lz, segments: 12 }));
  g.add(cylinder(0.14, 0.14, 0.04, M.dark, { x: lx, y: 1.5, z: lz, segments: 12 }));
  g.add(cylinder(0.065, 0.065, 0.13, windowMaterial, { x: lx, y: 1.54, z: lz, segments: 8 }));
  g.add(cone(0.1, 0.12, M.red, { x: lx, y: 1.67, z: lz, segments: 10 }));
  return g;
}

function transamerica(p: Place): THREE.Group {
  const g = group(p);
  // Shorter than Salesforce Tower (real: 260 m vs 326 m).
  const H = 7.8;
  const r0 = 0.85;
  const r1 = 0.1;
  g.add(box(1.3, 0.25, 1.3, M.concrete));
  const rAt = (y: number) => r0 + (r1 - r0) * (y / H);
  g.add(cylinder(r1, r0, H, M.white, { y: 0.25, segments: 4, ry: Math.PI / 4 }));
  // Thin dark glass slits on the white quartz faces.
  for (let y = 0.5; y < H - 0.6; y += 0.4) {
    g.add(cylinder(rAt(y + 0.1) * 1.01, rAt(y) * 1.01, 0.1, windowMaterial, { y: 0.25 + y, segments: 4, ry: Math.PI / 4, open: true }));
  }
  // Two vertical elevator/stair wings on opposite faces; each leans with the pyramid face.
  const lean = Math.atan((r0 - r1) / Math.SQRT2 / H);
  for (const s of [-1, 1]) {
    const w = group({ x: s * (rAt(3.05) / Math.SQRT2), y: 3.24 });
    w.rotation.z = s * lean;
    w.add(box(0.14, 3.0, 0.3, M.white, { x: s * 0.05 }));
    w.add(box(0.15, 2.86, 0.18, M.glassDark, { x: s * 0.055, y: 0.05 }));
    for (const y of [0.58, 1.33, 2.08]) w.add(box(0.18, 0.04, 0.32, M.concrete, { x: s * 0.05, y }));
    w.add(box(0.18, 0.06, 0.34, M.concrete, { x: s * 0.05, y: 3.0 }));
    g.add(w);
  }
  g.add(cylinder(0.02, 0.07, 1.7, M.white, { y: 0.25 + H, segments: 4, ry: Math.PI / 4 }));
  g.add(cylinder(0.01, 0.03, 0.7, M.steel, { y: 0.25 + H + 1.6, segments: 6 }));
  return g;
}

/** Ferry Building: long arcaded hall on the quay with the clock tower rising from its centre. */
function ferryBuilding(p: Place): THREE.Group {
  const g = group(p);
  const stone = floodMat(0xe4d9c0, 0xffd6a0, 0.35, { roughness: 0.7 });
  g.add(box(3.6, 0.16, 1.0, M.concrete));
  g.add(box(3.2, 0.5, 0.7, stone, { y: 0.16, z: -0.05 }));
  g.add(box(3.26, 0.05, 0.76, M.white, { y: 0.66, z: -0.05 }));
  for (let x = -1.4; x < 1.45; x += 0.28) {
    if (Math.abs(x) < 0.5) continue;
    g.add(box(0.14, 0.24, 0.02, M.dark, { x, y: 0.2, z: 0.31 }));
  }
  // Central pavilion with the main arch, then the tower.
  g.add(box(0.95, 0.9, 0.78, stone, { y: 0.16, z: -0.03 }));
  g.add(box(0.3, 0.5, 0.02, M.dark, { y: 0.2, z: 0.37 }));
  g.add(box(0.46, 1.2, 0.46, stone, { y: 1.06, z: -0.05 }));
  g.add(box(0.36, 0.3, 0.36, stone, { y: 2.26, z: -0.05 }));
  // Lit clock faces on all four sides.
  g.add(box(0.2, 0.2, 0.02, lampMaterial, { y: 1.65, z: 0.19 }));
  g.add(box(0.2, 0.2, 0.02, lampMaterial, { y: 1.65, z: -0.29 }));
  for (const sx of [-1, 1]) g.add(box(0.02, 0.2, 0.2, lampMaterial, { x: sx * 0.235, y: 1.65, z: -0.05 }));
  g.add(cone(0.26, 0.45, M.copper, { y: 2.56, z: -0.05, segments: 4, ry: Math.PI / 4 }));
  g.add(cylinder(0.01, 0.02, 0.25, M.steel, { y: 3.0, z: -0.05, segments: 5 }));
  return g;
}

/** Wooden pier running along +z from its origin, with a shed and a lamp at the end. */
function pier(x: number, len: number): THREE.Group {
  const g = group({ x, z: 4.3 + len / 2 });
  g.add(box(0.7, 0.07, len, M.wood, { y: 0.1 }));
  g.add(building({ w: 0.5, d: len * 0.5, h: 0.28, y: 0.17, wall: mat(0xcfc3ac), roof: 'gable', roofMat: ROOF_V, roofH: 0.12, plain: true }));
  g.add(lamp({ z: len / 2 - 0.1, y: 0.17 }));
  return g;
}

function salesforceTower(p: Place): THREE.Group {
  const g = group(p);
  const prof: [number, number][] = [[0, 0], [0.82, 0], [0.9, 2.6], [0.87, 5.2], [0.74, 8.3], [0.52, 10.8], [0.3, 11.85], [0, 12.3]];
  const glass = mat(0xcdd9e3, { roughness: 0.2, metalness: 0.4 });
  g.add(lathe(prof, glass, { segments: 28 }));
  const rAt = (y: number): number => {
    for (let i = 1; i < prof.length; i++) {
      if (y <= prof[i][1]) {
        const [r0, y0] = prof[i - 1];
        const [r1, y1] = prof[i];
        return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0);
      }
    }
    return 0.2;
  };
  for (let y = 0.5; y < 10.8; y += 0.45) {
    const r = rAt(y + 0.1) + 0.012;
    g.add(cylinder(r, rAt(y) + 0.012, 0.13, windowMaterial, { y, segments: 28, open: true }));
  }
  g.add(cylinder(0.04, 0.06, 0.45, M.steel, { y: 12.25, segments: 6 }));
  g.add(box(0.06, 0.06, 0.06, lampMaterial, { y: 12.68 }));
  return g;
}

function coitTower(p: Place): THREE.Group {
  const g = group(p);
  const stone = floodMat(0xf1ede4, 0xffe2b0, 0.5, { roughness: 0.7 });
  g.add(cylinder(0.3, 0.3, 0.08, stone, { segments: 12 }));
  g.add(cylinder(0.2, 0.24, 1.55, stone, { y: 0.08, segments: 10 }));
  // Fluting.
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.add(box(0.035, 1.5, 0.035, stone, { x: Math.cos(a) * 0.23, z: Math.sin(a) * 0.23, y: 0.1 }));
  }
  g.add(cylinder(0.27, 0.22, 0.12, stone, { y: 1.63, segments: 10 }));
  g.add(cylinder(0.2, 0.2, 0.2, stone, { y: 1.75, segments: 10 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.05, 0.12, 0.03, M.dark, { x: Math.cos(a) * 0.2, z: Math.sin(a) * 0.2, y: 1.8, ry: -a + Math.PI / 2 }));
  }
  g.add(cylinder(0.21, 0.21, 0.04, stone, { y: 1.95, segments: 10 }));
  g.add(dome(0.14, stone, { y: 1.99, segments: 10 }));
  return g;
}

const TRIMS = [0xf6f1e6, 0x6f5a86, 0xfff6dc, 0x9a3b34, 0xf6f1e6, 0x3f6f8a];
const ROOF_V = mat(0x7d6354, { roughness: 0.7 });
const DOOR_V = mat(0x6b3a30);

/** Painted Lady: steep front gable with bargeboards, three-sided bay window, porch with steps. */
function victorian(x: number, z: number, color: number, trimColor: number): THREE.Group {
  const g = group({ x, z });
  const w = 0.82;
  const d = 1.2;
  const h = 1.35;
  const rh = 0.78;
  const wall = mat(color);
  const trim = mat(trimColor);
  const zf = d / 2;
  g.add(building({ w, d, h, wall, trim, roof: 'flat', windows: 'none', plain: true }));
  g.add(box(w + 0.05, 0.16, d + 0.05, trim));
  g.add(box(w + 0.1, 0.06, d + 0.1, trim, { y: h - 0.06 }));
  // Steep gable roof (ridge along z) and wall-colour gable face with trim.
  g.add(gableRoof(d - 0.04, w + 0.14, rh, ROOF_V, { y: h, ry: Math.PI / 2 }));
  g.add(profile([[-w / 2 - 0.02, 0], [w / 2 + 0.02, 0], [0, rh * 0.93]], 0.06, wall, { y: h, z: zf }));
  for (const s of [-1, 1]) g.add(beam([s * (w / 2 + 0.08), h - 0.02, zf + 0.05], [0, h + rh, zf + 0.05], 0.045, trim));
  g.add(box(0.05, 0.14, 0.05, trim, { y: h + rh - 0.02, z: zf + 0.05 }));
  // Attic vent / window in the gable and a tie beam.
  g.add(box(0.16, 0.22, 0.03, windowMaterial, { y: h + 0.2, z: zf + 0.07 }));
  g.add(box(0.3, 0.03, 0.05, trim, { y: h + 0.12, z: zf + 0.07 }));
  // Second-storey windows with lintels.
  for (const sx of [-1, 1]) {
    g.add(box(0.17, 0.32, 0.03, windowMaterial, { x: sx * 0.22, y: 0.82, z: zf + 0.02 }));
    g.add(box(0.23, 0.04, 0.06, trim, { x: sx * 0.22, y: 1.15, z: zf + 0.03 }));
  }
  // Three-sided bay window over the left half of the ground floor.
  const bx = -0.17;
  g.add(box(0.36, 0.78, 0.14, trim, { x: bx, y: 0.2, z: zf + 0.07 }));
  for (const s of [-1, 1]) g.add(box(0.14, 0.78, 0.14, trim, { x: bx + s * 0.25, y: 0.2, z: zf + 0.03, ry: s * 0.6 }));
  g.add(box(0.28, 0.4, 0.03, windowMaterial, { x: bx, y: 0.42, z: zf + 0.15 }));
  for (const s of [-1, 1]) g.add(box(0.1, 0.4, 0.03, windowMaterial, { x: bx + s * 0.26, y: 0.42, z: zf + 0.1, ry: s * 0.6 }));
  g.add(box(0.74, 0.05, 0.2, trim, { x: bx, y: 0.98, z: zf + 0.07 }));
  // Porch: steps, door, posts, small roof.
  const px = 0.24;
  g.add(box(0.26, 0.05, 0.24, M.concrete, { x: px, z: zf + 0.12 }));
  g.add(box(0.26, 0.05, 0.16, M.concrete, { x: px, y: 0.05, z: zf + 0.1 }));
  g.add(box(0.15, 0.55, 0.03, DOOR_V, { x: px, y: 0.1, z: zf + 0.01 }));
  for (const s of [-1, 1]) g.add(box(0.025, 0.55, 0.025, trim, { x: px + s * 0.12, y: 0.1, z: zf + 0.2 }));
  g.add(box(0.32, 0.04, 0.26, trim, { x: px, y: 0.65, z: zf + 0.12 }));
  return g;
}

function cableCar(): THREE.Group {
  const g = group();
  const cream = mat(0xf0e4c4);
  const red = mat(0xb8322a);
  g.add(box(0.3, 0.14, 0.62, red, { y: 0.06 }));
  g.add(box(0.28, 0.22, 0.34, cream, { y: 0.2 }));
  g.add(box(0.27, 0.12, 0.34, windowMaterial, { y: 0.26 }));
  g.add(box(0.34, 0.03, 0.42, red, { y: 0.42 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.025, 0.2, 0.025, M.dark, { x: sx * 0.13, z: sz * 0.28, y: 0.2 }));
  g.add(box(0.3, 0.02, 0.62, M.dark, { y: 0.05 }));
  g.add(box(0.02, 0.36, 0.02, M.steel, { x: 0, z: 0.0, y: 0.0 }));
  return g;
}

/** Downtown tower with a distinct crown per `kind`. */
function downtownTower(x: number, z: number, w: number, d: number, sections: number[], color: number, kind: number): THREE.Group {
  const g = tower({ x, z, w, d, sections, step: 0.22, wall: mat(color), windows: 'bands' });
  const top = sections.reduce((a, b) => a + b, 0);
  const tw = Math.max(0.3, w - 0.22 * (sections.length - 1));
  const td = Math.max(0.3, d - 0.22 * (sections.length - 1));
  const glass = mat(0x5f7a92, { roughness: 0.2, metalness: 0.5 });
  if (kind % 3 === 0) {
    // Chamfered crown (Millennium): clipped pyramid.
    g.add(cylinder(Math.min(tw, td) * 0.3, Math.min(tw, td) * 0.7, 0.5, glass, { y: top, segments: 4, ry: Math.PI / 4 }));
  } else if (kind % 3 === 1) {
    // Dark slab crown with stepped mechanical penthouse and mast (555 California).
    g.add(box(tw * 0.8, 0.3, td * 0.8, M.dark, { y: top }));
    g.add(box(tw * 0.45, 0.25, td * 0.45, M.steel, { y: top + 0.3 }));
    g.add(cylinder(0.015, 0.03, 0.6, M.steel, { y: top + 0.55, segments: 5 }));
  } else {
    // Lantern band + hip cap.
    g.add(box(tw * 0.9, 0.18, td * 0.9, windowMaterial, { y: top }));
    g.add(cone(Math.min(tw, td) * 0.55, 0.35, M.copper, { y: top + 0.18, segments: 4, ry: Math.PI / 4 }));
  }
  return g;
}

/** A platoon of cars welded into one animated object. `gaps` are distances behind the lead car; `lane` picks the paint pair. */
function convoy(lane: number, gaps: number[], scale: number, y: number): THREE.Group {
  const g = group({ y });
  gaps.forEach((gap, i) => g.add(car({ z: -gap, color: TRAFFIC[(lane + (i % 2) * 2) % TRAFFIC.length] })));
  g.scale.setScalar(scale);
  mergeStatic(g);
  return g;
}

/** Fog-weather San Franciscans: layered jackets (grey, navy, olive, red flannel, denim, black). */
const COATS = [0x6b7078, 0x253a5c, 0x6b7048, 0xb02a2a, 0x4a6a9a, 0x22252a];
const sfPerson = (x: number, z: number, i: number, y: number) => person({ x, y, z, color: COATS[i % COATS.length] });

export default function build(): CityScene {
  const rand = rng(94);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: M.asphalt, side: mat(0x8a7a66) }));

  // Land and bay.
  root.add(patch(19.0, 13.5, LAND, { z: -2.75, x: 0 }));
  root.add(patch(19.6, 5.6, waterMat(0x4fa3d1), { z: 7.0, h: 0.1 }));
  root.add(patch(19.0, 0.4, M.pavement, { z: 4.1, h: 0.14 }));
  // Marin headlands (left) and Presidio (right).
  const marin: [number, number][] = [[-9.8, 4.2], [-7.4, 4.2], [-7.1, 6.0], [-7.7, 7.5], [-7.5, 9.8], [-9.8, 9.8]];
  root.add(prism(marin, 0.45, HEADLAND));
  const presidio: [number, number][] = [[9.8, 4.2], [7.6, 4.2], [7.3, 6.2], [7.8, 7.8], [7.6, 9.8], [9.8, 9.8]];
  root.add(prism(presidio, 0.45, HEADLAND));
  root.add(cone(1.3, 0.8, HEADLAND, { x: -8.4, y: 0.4, z: 5.3, segments: 8 }));
  root.add(cone(1.1, 0.6, HEADLAND, { x: -8.6, y: 0.4, z: 8.6, segments: 8 }));
  root.add(scatter({ x: -8.6, z: 7.0, w: 1.8, d: 1.4 }, 3, rand, (x, z) => tree({ x, z, y: 0.45, kind: 'cone', s: 0.8 })));
  root.add(scatter({ x: 8.7, z: 6.0, w: 1.6, d: 2.8 }, 6, rand, (x, z) => tree({ x, z, y: 0.45, kind: 'cone', s: 0.85 })));
  root.add(scatter({ x: 8.7, z: 9.0, w: 1.6, d: 1.2 }, 2, rand, (x, z) => tree({ x, z, y: 0.45, kind: 'cone', s: 0.8 })));

  // Landmarks.
  root.add(goldenGateBridge(anim));
  // Alcatraz: enlarged and moved into the open water between the bridge towers (rock x -4.8..-0.8, z 4.4..7.6).
  const alc = alcatraz({ x: -2.8, z: 6.0 });
  alc.scale.setScalar(1.4);
  root.add(alc);
  root.add(ferryBuilding({ x: 3.5, z: 4.8 }));
  root.add(pier(0.8, 2.2));
  root.add(pier(6.2, 1.9));
  root.add(transamerica({ x: -2.4, z: -6.8 }));
  root.add(salesforceTower({ x: -5.0, z: -6.6 }));

  // Downtown cluster.
  [[-8.2, -8.0, 1.5, 1.5, [4.6, 1.6], 0xc4ced8], [-8.0, -4.2, 1.6, 1.1, [3.4, 1.2], 0x4a4f57], [-5.4, -3.2, 1.5, 1.5, [3.0, 1.4], 0xb5c1cd],
    [-2.8, -3.2, 1.3, 1.3, [2.6, 1.0], 0xd9d4ca], [-2.0, -9.0, 1.1, 1.0, [4.2, 1.2], 0xcbd4dc], [-3.4, -9.0, 1.2, 1.0, [3.6], 0xd5cfc3],
    [-8.2, -0.6, 1.4, 1.2, [2.4], 0xd6cdbd], [-5.6, 0.2, 1.8, 1.4, [2.0], 0xc7cfd7], [-3.2, 0.4, 1.3, 1.3, [1.8], 0xdcd2c0]].forEach(([x, z, w, d, s, c], i) =>
    root.add(downtownTower(x as number, z as number, w as number, d as number, s as number[], c as number, i)));
  root.add(building({ w: 1.5, d: 1.2, h: 1.4, x: -8.2, z: 1.8, wall: mat(0xe3c9b0), trim: M.white, roof: 'flat', shop: 0xc8433a }));
  root.add(building({ w: 1.3, d: 1.2, h: 1.2, x: -5.8, z: 2.1, wall: mat(0xbfd0d8), trim: M.white, roof: 'gable', roofH: 0.35, shop: 0x3d6fb6 }));
  root.add(crosswalk(-0.6, 3.4, 0.9, { ry: Math.PI / 2 }));
  root.add(crosswalk(-4.4, 3.4, 0.9, { ry: Math.PI / 2 }));
  root.add(patch(19.0, 0.18, mat(0xe9d3a3), { z: 4.45, h: 0.12 }));

  // Streets.
  const asphalt = mat(0x59606a, { roughness: 0.95, surface: 'road' });
  root.add(road(-9.5, 3.4, 9.5, 3.4, 0.9, { material: asphalt }));
  root.add(road(-0.6, -9.5, -0.6, 3.0, 0.9, { material: asphalt }));
  root.add(road(-9.5, -1.8, -0.6, -1.8, 0.8, { material: asphalt }));
  root.add(road(-9.5, -5.2, -0.6, -5.2, 0.5, { lines: false, material: asphalt }));
  root.add(road(2.6, -6.5, 9.5, -6.5, 0.5, { lines: false, material: asphalt }));
  root.add(row(-9.2, 2.85, 9.0, 2.85, 12, (x, z) => (x > 5.2 && x < 9.4 ? group() : lamp({ x, z }))));

  // Steep street with cable car rails (rises toward -z).
  const SX = 1.8;
  const Z0 = 3.0;
  const Z1 = -3.4;
  const rise = 1.1;
  const k = rise / (Z0 - Z1);
  const theta = Math.atan(k);
  const slopeLen = Math.hypot(Z0 - Z1, rise);
  const yAt = (z: number) => (Z0 - z) * k;
  root.add(profile([[-Z0, 0], [-Z1, 0], [-Z1, rise]], 1.1, mat(0xa69f94), { x: SX, ry: Math.PI / 2 }));
  const st = group({ x: SX, y: yAt((Z0 + Z1) / 2) + 0.01, z: (Z0 + Z1) / 2 });
  st.rotation.x = theta;
  st.add(box(0.9, 0.05, slopeLen, asphalt));
  for (const sx of [-0.14, 0.14]) st.add(box(0.025, 0.02, slopeLen, M.steel, { x: sx, y: 0.05 }));
  for (let s = -slopeLen / 2 + 0.2; s < slopeLen / 2; s += 0.45) st.add(box(0.4, 0.015, 0.05, M.wood, { y: 0.05, z: s }));
  root.add(st);
  // Row houses stepping up both sides of the street.
  const hz = [2.1, 0.7, -0.7, -2.1];
  hz.forEach((z, i) => {
    for (const [x, wallc] of [[0.5, PASTEL[i % 6]], [3.1, PASTEL[(i + 3) % 6]]] as const) {
      const y = yAt(z) + 0.05;
      const grp = group({ x, y: 0, z });
      // Retaining wall / garage podium stepping with the slope; gable ends face the street.
      grp.add(box(1.1, y, 0.95, mat(0xa69f94)));
      grp.add(box(0.3, 0.2, 0.02, M.dark, { y: y - 0.2 < 0 ? 0 : y - 0.2, z: 0.48, x: -0.3 }));
      grp.add(building({ w: 1.1, d: 0.9, h: 0.95, y, wall: mat(wallc), trim: M.white, roof: 'gable', roofMat: mat(0x8a6a58), roofH: 0.5, windows: 'grid', floorH: 0.42, shop: i % 2 ? 0xc8433a : 0x3d6fb6 }));
      root.add(grp);
    }
  });
  // Crest plaza closing the steep street: stone terrace with a lawn, trees and a lamp.
  const PZ = Z1 - 0.6;
  root.add(box(1.8, rise + 0.05, 1.2, mat(0xa69f94), { x: SX, z: PZ }));
  root.add(box(1.6, 0.05, 1.0, M.pavement, { x: SX, y: rise + 0.05, z: PZ }));
  root.add(box(0.9, 0.03, 0.6, M.grass, { x: SX, y: rise + 0.1, z: PZ - 0.1 }));
  root.add(tree({ x: SX - 0.4, z: PZ - 0.15, y: rise + 0.13, s: 0.5, kind: 'round' }));
  root.add(tree({ x: SX + 0.4, z: PZ - 0.15, y: rise + 0.13, s: 0.5, kind: 'cone' }));
  root.add(lamp({ x: SX, z: PZ + 0.4, y: rise + 0.1 }));
  // Cable car travelling up and down the slope.
  const cc = group();
  const inner = cableCar();
  cc.add(inner);
  cc.userData.dynamic = true;
  cc.rotation.x = theta;
  root.add(cc);
  const sMin = 0.5;
  const sMax = slopeLen - 0.5;
  anim.add((t) => {
    const span = sMax - sMin;
    const u = (t * 0.45) % (span * 2);
    const s = u < span ? sMin + u : sMin + span * 2 - u;
    const up = u < span;
    const zz = Z0 - s * Math.cos(theta);
    cc.position.set(SX, yAt(zz) + 0.1, zz);
    inner.rotation.y = up ? Math.PI : 0;
  });

  // Telegraph Hill: three cliff terraces with grass ledges, a ring road and a stone stair, topped by Coit Tower.
  const HX = 7.4;
  const HZ = -0.2;
  const hillGrass = mat(0x82a85a, { roughness: 1, flat: true });
  const ledge = mat(0x93b86a, { roughness: 1 });
  const terraces = [[1.85, 2.1, 0, ROCK], [1.45, 1.7, 0.5, hillGrass], [1.1, 1.3, 1.0, ROCK]] as const;
  for (const [rTop, rBot, y, m] of terraces) {
    root.add(cylinder(rTop, rBot, 0.5, m, { x: HX, z: HZ, y, segments: 14 }));
    root.add(cylinder(rTop, rTop, 0.02, ledge, { x: HX, z: HZ, y: y + 0.5, segments: 14 }));
    // Stair up the viewer-facing slope: solid steps so none hovers over the cliff.
    for (let i = 0; i < 5; i++) {
      const r = rBot - ((rBot - rTop) * (i + 0.5)) / 5;
      root.add(box(0.28, i * 0.1 + 0.11, 0.14, M.pavement, { x: HX + r * Math.SQRT1_2, z: HZ + r * Math.SQRT1_2, y, ry: Math.PI / 4 }));
    }
  }
  // Summit: ring road around a lawn and the stone plaza at the tower foot.
  root.add(cylinder(0.95, 0.95, 0.02, asphalt, { x: HX, z: HZ, y: 1.52, segments: 20 }));
  root.add(cylinder(0.72, 0.72, 0.03, ledge, { x: HX, z: HZ, y: 1.52, segments: 20 }));
  root.add(cylinder(0.45, 0.45, 0.04, M.pavement, { x: HX, z: HZ, y: 1.52, segments: 14 }));
  const coit = coitTower({ x: HX, y: 1.56, z: HZ });
  coit.scale.setScalar(1.3);
  root.add(coit);
  root.add(scatter({ x: HX, z: HZ, w: 2.6, d: 2.6 }, 8, rand, (x, z) => {
    const r = Math.hypot(x - HX, z - HZ);
    return r < 1.3 || r > 1.42 ? group() : tree({ x, z, y: 1.02, s: 0.5, kind: 'round' });
  }));
  // Trees ringing the middle ledge, kept off the stair (at 45 degrees).
  for (let i = 0; i < 8; i++) {
    const a = (i + 0.5) * (Math.PI / 4);
    root.add(tree({ x: HX + Math.cos(a) * 1.375, z: HZ + Math.sin(a) * 1.375, y: 1.02, s: 0.5, kind: i % 2 ? 'cone' : 'round' }));
  }

  // Alamo Square and the Painted Ladies.
  root.add(patch(5.4, 3.0, M.grass, { x: 6.2, z: -4.7, h: 0.08 }));
  root.add(patch(5.4, 0.18, mat(0xd8d2c4), { x: 6.2, z: -4.7, h: 0.1 }));
  root.add(patch(0.18, 3.0, mat(0xd8d2c4), { x: 6.2, z: -4.7, h: 0.1 }));
  root.add(row(3.9, -3.5, 8.5, -3.5, 5, (x, z) => tree({ x, z, y: 0.08, s: 0.75, kind: 'round' })));
  root.add(row(3.9, -5.9, 8.5, -5.9, 5, (x, z) => tree({ x, z, y: 0.08, s: 0.7, kind: 'cone' })));
  // Alamo Square: picnickers keep off the tree rows (z -3.5 / -5.9, x 3.9..8.5) and stand on the 0.08 lawn.
  const treeRows = (x: number, z: number) => (Math.abs(z + 3.5) < 0.4 || Math.abs(z + 5.9) < 0.4) && [3.9, 5.05, 6.2, 7.35, 8.5].some((tx) => Math.abs(x - tx) < 0.4);
  root.add(scatter({ x: 6.2, z: -4.7, w: 4.6, d: 2.4 }, 7, rand, (x, z, i) => sfPerson(x, z, i, 0.08), treeRows));
  // Cable-car stop at the foot of the steep street: a small waiting group on the paving, clear of the lamp at x 2.35 and the rails.
  ([[0.95, 2.78], [1.12, 2.8], [2.55, 2.78], [2.72, 2.8]] as const).forEach(([x, z], i) => root.add(sfPerson(x, z, i + 2, 0.04)));
  // Embarcadero promenade (pavement top 0.14, x < 0.45 clear of the pier): three walkers on a closed loop.
  const promenade: [number, number][] = [[-6.4, 4.18], [0.2, 4.18], [0.2, 4.02], [-6.4, 4.02]];
  for (let i = 0; i < 3; i++) root.add(anim.follow(sfPerson(0, 0, i * 2 + 1, 0.14), promenade, 0.3, i / 3, true));
  PASTEL.forEach((c, i) => {
    const v = victorian(3.5 + i * 1.0, -7.45, c, TRIMS[i]);
    v.scale.setScalar(1.15);
    root.add(v);
  });


  // Bay traffic. Lanes keep clear of Alcatraz (z 4.4..7.6, x < -0.8), the Ferry Building and the piers (z < 6.7).
  const sail = (c: number, len: number) => boat({ y: 0.1, color: c, len });
  root.add(anim.bob(anim.follow(sail(0xf4f4f0, 0.8), [[-6.8, 9.35], [6.8, 9.35]], 0.5, 0.1), 0.02));
  root.add(anim.bob(anim.follow(sail(0x3d6fb6, 0.6), [[6.8, 9.0], [-6.8, 9.0]], 0.4, 0.55), 0.02));
  root.add(anim.bob(anim.follow(sail(0xc8433a, 0.9), [[6.8, 7.3], [-0.2, 7.3], [-0.2, 8.4], [-6.5, 8.4]], 0.35, 0.3), 0.02));

  // City traffic: platoons of two share paint and welded geometry (tail 0.8 behind the lead, so it stays on the plinth at the wrap).
  const lanes: [number, [number, number][], number, number][] = [
    [0, [[-8.9, 3.2], [8.9, 3.2]], 1.3, 0],
    [2, [[-8.9, 3.2], [8.9, 3.2]], 1.3, 0.5],
    [1, [[8.9, 3.6], [-8.9, 3.6]], 1.3, 0.13],
    [3, [[8.9, 3.6], [-8.9, 3.6]], 1.3, 0.63],
    [4, [[-0.8, -8.9], [-0.8, 2.9]], 1.1, 0],
    [5, [[-0.8, -8.9], [-0.8, 2.9]], 1.1, 0.5],
    [1, [[-0.4, 2.9], [-0.4, -8.9]], 1.1, 0.15],
    [2, [[-0.4, 2.9], [-0.4, -8.9]], 1.1, 0.65],
    [2, [[-8.9, -1.8], [-0.8, -1.8]], 0.9, 0],
  ];
  for (const [lane, path, speed, offset] of lanes) root.add(anim.follow(convoy(lane, [0, 0.8], 1, 0.05), path, speed, offset));

  return { root, update: anim.update };
}
