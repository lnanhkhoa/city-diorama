import * as THREE from 'three';
import {
  Animator, M, archHole, area, beam, box, building, car, cone, createBase, crosswalk, cylinder, dome, gableRoof, group, hipRoof, lamp, mat,
  floodMat, patch, person, profile, rng, road, row, scatter, tree, tube, waterMat, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';

// Landmarks are floodlit at night (plain by day), as on the real monuments; the tower glows amber.
const IRON = floodMat(0x8b6b4b, 0xffb35c, 0.3, { roughness: 0.6 });
const IRONWORK = mat(0x24282d, { roughness: 0.5, metalness: 0.5 });
const ZINC = mat(0x6d7a86, { roughness: 0.55, metalness: 0.25 });
const ZINC_DARK = mat(0x56616b, { roughness: 0.55, metalness: 0.25 });
const CAFE_RED = 0xb3372f;
const CAFE_GREEN = 0x2f6b4a;
const CAFE_NAVY = 0x24406b;
const UMBRELLAS = [0xc8433a, 0x2f343b, 0x3d6fb6, 0xe0b43a];
// Winter coats: charcoal, trench beige, navy, burgundy, camel, cream, olive.
const COATS = [0x2b2f3a, 0xb8a98a, 0x24406b, 0x7a2e2e, 0xc08a4e, 0xd9d4c7, 0x5f6b4e];
// Rain-slick ground, as in the poster: low roughness picks up the sky environment.
const WET_COBBLE = mat(0x8d9199, { roughness: 0.4, metalness: 0.15 });
const WET_ROAD = mat(0x6c7179, { roughness: 0.35, metalness: 0.2, surface: 'road' });
const WET_PAVING = mat(0xc4c3bf, { roughness: 0.4, metalness: 0.1 });
const PUDDLE = waterMat(0x8fb7cf);
const DOME_SLATE = mat(0x4f5b69, { roughness: 0.6, flat: true });
const STAIR = mat(0xa9a59d);

/** Concave leg profile as [height, leg centre offset, post offset]. */
const LEG: [number, number, number][] = [[0, 2.05, 0.34], [0.8, 1.72, 0.28], [1.5, 1.38, 0.22], [2.0, 1.12, 0.18]];
/** Shaft corner members above the first platform as [height, corner offset]. */
const SHAFT: [number, number][] = [[2.0, 1.05], [3.0, 0.78], [3.9, 0.57], [5.0, 0.42], [6.0, 0.33], [7.1, 0.26], [8.2, 0.21]];
const EIFFEL_H = 10.8;

function legCentre(y: number): number {
  for (let i = 0; i < LEG.length - 1; i++) {
    const [y0, c0] = LEG[i];
    const [y1, c1] = LEG[i + 1];
    if (y <= y1) return c0 + ((c1 - c0) * (y - y0)) / (y1 - y0);
  }
  return LEG[LEG.length - 1][1];
}

function eiffelTower(p: Place): THREE.Group {
  const g = group(p);
  const iron = IRON;
  const dark = floodMat(0x6e5440, 0xffb35c, 0.25, { roughness: 0.6 });
  const faces = [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]] as const;

  // Four legs, each a pylon of four posts bending inward in three segments, X-braced on every face.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(box(1.05, 0.12, 1.05, M.concrete, { x: sx * LEG[0][1], z: sz * LEG[0][1] }));
      const pt = (n: number, ox: number, oz: number): [number, number, number] => {
        const [y, c, o] = LEG[n];
        return [sx * c + ox * o, y, sz * c + oz * o];
      };
      for (let k = 0; k < LEG.length - 1; k++) {
        const th = 0.12 - k * 0.015;
        for (const [ox, oz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) g.add(beam(pt(k, ox, oz), pt(k + 1, ox, oz), th, iron));
        for (const [[ax, az], [bx, bz]] of faces) {
          g.add(beam(pt(k, ax, az), pt(k + 1, bx, bz), 0.035, iron));
          g.add(beam(pt(k, bx, bz), pt(k + 1, ax, az), 0.035, iron));
          g.add(beam(pt(k + 1, ax, az), pt(k + 1, bx, bz), 0.05, iron));
        }
      }
    }
  }
  // Decorative arches between the legs under the first platform, hugging the sloped leg faces.
  const archR = 1.5;
  for (let i = 0; i < 4; i++) {
    for (const k of [1, 0.8]) {
      const pts: THREE.Vector3[] = [];
      for (let j = 0; j <= 12; j++) {
        const a = Math.PI - (j / 12) * Math.PI;
        const x = Math.cos(a) * archR * k;
        const y = 0.4 + Math.sin(a) * 1.3 * k;
        const zc = legCentre(y);
        pts.push(new THREE.Vector3(x, y, zc));
      }
      const arch = tube(pts, k === 1 ? 0.06 : 0.04, iron, { segments: 24 });
      arch.rotation.y = (i * Math.PI) / 2;
      g.add(arch);
    }
    const fr = group({ ry: (i * Math.PI) / 2 });
    fr.add(beam([-1.25, 1.85, legCentre(1.85)], [1.25, 1.85, legCentre(1.85)], 0.1, iron));
    g.add(fr);
  }
  // First platform: an open frame of edge girders, floor ribs and a railing; the lattice shows through.
  const frameDeck = (y: number, w: number, gird: number, rail: number) => {
    const h = w / 2;
    for (const s of [-1, 1]) {
      g.add(box(w, gird, 0.07, iron, { y, z: s * h }));
      g.add(box(0.07, gird, w, iron, { y, x: s * h }));
    }
    g.add(beam([-h, y, -h], [h, y + gird, h], 0.04, iron));
    g.add(beam([-h, y, h], [h, y + gird, -h], 0.04, iron));
    for (const o of [-0.5, 0.5]) {
      g.add(box(w, 0.03, 0.04, iron, { y: y + gird - 0.03, z: o * h }));
      g.add(box(0.04, 0.03, w, iron, { y: y + gird - 0.03, x: o * h }));
    }
    // Perimeter walkway only: the middle stays open so the ribs and the lattice below read through.
    for (const s of [-1, 1]) {
      g.add(box(w + 0.1, 0.035, 0.3, dark, { y: y + gird, z: s * (h - 0.11) }));
      g.add(box(0.3, 0.035, w - 0.4, dark, { y: y + gird, x: s * (h - 0.11) }));
    }
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const a = -h + (w * i) / n;
      for (const s of [-1, 1]) {
        g.add(box(0.025, rail, 0.025, dark, { x: a, y: y + gird + 0.035, z: s * (h + 0.04) }));
        g.add(box(0.025, rail, 0.025, dark, { x: s * (h + 0.04), y: y + gird + 0.035, z: a }));
      }
    }
    for (const s of [-1, 1]) {
      g.add(box(w + 0.1, 0.03, 0.03, dark, { y: y + gird + 0.035 + rail, z: s * (h + 0.04) }));
      g.add(box(0.03, 0.03, w + 0.1, dark, { y: y + gird + 0.035 + rail, x: s * (h + 0.04) }));
    }
  };
  frameDeck(2.0, 2.9, 0.22, 0.12);
  const deck = (y: number, w: number, t: number, rail: number) => {
    g.add(box(w, t, w, iron, { y }));
    g.add(box(w + 0.08, 0.04, w + 0.08, dark, { y: y + t }));
    g.add(box(w + 0.04, rail, w + 0.04, dark, { y: y + t + 0.04 }));
    g.add(box(w - 0.04, rail + 0.02, w - 0.04, iron, { y: y + t + 0.04 }));
    g.add(box(w + 0.08, 0.03, w + 0.08, dark, { y: y + t + 0.04 + rail }));
  };
  deck(3.9, 1.4, 0.14, 0.07);
  deck(8.2, 0.64, 0.1, 0.05);


  // Upper shaft: four converging corner members, horizontal rings, X-bracing per bay.
  const sh = (n: number, sx: number, sz: number): [number, number, number] => [sx * SHAFT[n][1], SHAFT[n][0], sz * SHAFT[n][1]];
  for (let n = 0; n < SHAFT.length - 1; n++) {
    const th = 0.14 - n * 0.016;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(beam(sh(n, sx, sz), sh(n + 1, sx, sz), th, iron));
    for (const [[ax, az], [bx, bz]] of faces) {
      g.add(beam(sh(n, ax, az), sh(n + 1, bx, bz), 0.03, iron));
      g.add(beam(sh(n, bx, bz), sh(n + 1, ax, az), 0.03, iron));
      g.add(beam(sh(n + 1, ax, az), sh(n + 1, bx, bz), 0.045, iron));
    }
  }
  // Top cabin, lantern and antenna.
  g.add(box(0.44, 0.34, 0.44, dark, { y: 8.3 }));
  g.add(box(0.5, 0.05, 0.5, iron, { y: 8.64 }));
  g.add(cone(0.15, 0.5, iron, { y: 8.69, segments: 8 }));
  g.add(cylinder(0.02, 0.035, EIFFEL_H - 9.19, M.steel, { y: 9.19, segments: 6 }));
  return g;
}

/** Row of dormers on a mansard slope. The group origin sits on the wall face at roof base; local +z is outward. */
function dormers(g: THREE.Group, len: number, baseY: number, rh: number, inset: number): void {
  const t = 0.3;
  const n = Math.max(1, Math.floor(len / 0.6));
  const step = len / n;
  const zf = -inset * t + 0.02;
  const yb = baseY + rh * t - 0.03;
  for (let i = 0; i < n; i++) {
    const a = -len / 2 + step * (i + 0.5);
    g.add(box(0.2, 0.2, 0.16, M.limestone, { x: a, y: yb, z: zf - 0.08 }));
    g.add(box(0.1, 0.12, 0.02, windowMaterial, { x: a, y: yb + 0.045, z: zf + 0.005 }));
    g.add(gableRoof(0.2, 0.27, 0.11, ZINC_DARK, { x: a, y: yb + 0.2, z: zf - 0.09, ry: Math.PI / 2 }));
  }
}

function louvre(): THREE.Group {
  const g = group();
  const wall = floodMat(0xe8dcc3, 0xffd28a, 0.3);
  const wing = (w: number, d: number, x: number, z: number) =>
    building({ w, d, h: 2.2, x, z, wall, roof: 'mansard', roofMat: M.slate, roofH: 0.7 });
  g.add(wing(8.6, 1.5, -5.2, -8.6));
  g.add(wing(1.5, 4.6, -8.9, -5.2));
  g.add(wing(1.5, 4.6, -1.5, -5.2));
  // Corner pavilions with steep hip roofs; the central Pavillon de l'Horloge carries a square dome and lantern.
  for (const x of [-8.9, -1.5]) {
    g.add(building({ w: 1.9, d: 1.9, h: 2.7, x, z: -8.6, wall, roof: 'hip', roofMat: M.slate, roofH: 1.0 }));
  }
  g.add(building({ w: 1.9, d: 1.9, h: 2.7, x: -5.2, z: -8.6, wall, roof: 'mansard', roofMat: M.slate, roofH: 0.55 }));
  // Flat shading keeps the four-sided dome faceted, as on the poster; a smooth 4-segment dome renders round.
  g.add(dome(0.78, DOME_SLATE, { x: -5.2, y: 3.25, z: -8.6, ry: Math.PI / 4, squash: 1.1, segments: 4 }));
  g.add(box(0.24, 0.26, 0.24, M.slate, { x: -5.2, y: 4.05, z: -8.6 }));
  g.add(cone(0.1, 0.3, M.slate, { x: -5.2, y: 4.31, z: -8.6, segments: 4 }));
  // Ground-floor arcade along the courtyard: a stone screen of round arches over a dark gallery.
  const arcade = (len: number, x: number, z: number, ry: number) => {
    const n = Math.floor(len / 0.45);
    const step = len / n;
    const holes = Array.from({ length: n }, (_, i) => archHole(-len / 2 + step * (i + 0.5), 0.28, 0.45, 6));
    const ag = group({ x, z, ry });
    ag.add(box(len, 0.72, 0.02, M.dark, { z: 0.045 }));
    ag.add(profile([[-len / 2, 0], [len / 2, 0], [len / 2, 0.8], [-len / 2, 0.8]], 0.08, wall, { z: 0.1, holes }));
    g.add(ag);
  };
  arcade(1.8, -7.05, -7.85, 0);
  arcade(1.8, -3.35, -7.85, 0);
  arcade(4.6, -8.15, -5.25, Math.PI / 2);
  arcade(4.6, -2.25, -5.25, -Math.PI / 2);
  // Cour Napoléon with the glass pyramid and triangular pools with stone coping.
  g.add(patch(6.0, 4.4, WET_PAVING, { x: -5.2, z: -4.8 }));
  g.add(box(2.1, 0.08, 2.1, M.concrete, { x: -5.2, y: 0.03, z: -4.6 }));
  g.add(hipRoof(1.8, 1.8, 1.25, mat(0xa9c7dc, { roughness: 0.1, metalness: 0.6 }), { x: -5.2, y: 0.11, z: -4.6 }));
  const pyrFrame = mat(0x4a5560, { roughness: 0.4, metalness: 0.6 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) g.add(beam([-5.2 + sx * 0.9, 0.11, -4.6 + sz * 0.9], [-5.2, 1.36, -4.6], 0.025, pyrFrame));
  for (const [x, z, r] of [[-7.1, -4.6, 0], [-3.3, -4.6, Math.PI], [-5.2, -2.7, Math.PI / 2]] as const) {
    g.add(area([[-0.05, -0.76], [0.88, 0], [-0.05, 0.76]], M.concrete, { x, z, ry: r, y: 0.035 }));
    g.add(area([[0, -0.7], [0.8, 0], [0, 0.7]], waterMat(0x8fb7cf), { x, z, ry: r, y: 0.05 }));
  }
  // Dormers on the slate mansards facing the courtyard.
  const slopeDormers = (len: number, x: number, z: number, ry: number) => {
    const dg = group({ x, z, ry });
    dormers(dg, len, 2.2, 0.7, 0.33);
    g.add(dg);
  };
  slopeDormers(5.4, -5.2, -7.86, 0);
  slopeDormers(3.0, -8.14, -5.2, Math.PI / 2);
  slopeDormers(3.0, -2.26, -5.2, -Math.PI / 2);
  // Pavilion string courses and pediments over the entrances.
  for (const [x, z] of [[-8.9, -8.6], [-1.5, -8.6], [-5.2, -8.6]] as const) {
    g.add(box(2.0, 0.07, 2.0, M.concrete, { x, y: 1.35, z }));
    g.add(profile([[-0.5, 0], [0.5, 0], [0, 0.28]], 0.1, wall, { x, y: 2.0, z: z + 0.98 }));
  }
  return g;
}

function lancet(w: number, sh: number): [number, number][] {
  const pts: [number, number][] = [[-w / 2, 0], [w / 2, 0]];
  const n = 6;
  const lim = Math.PI / 3;
  for (let i = 0; i <= n; i++) pts.push([-w / 2 + w * Math.cos((i / n) * lim), sh + w * Math.sin((i / n) * lim)]);
  for (let i = n - 1; i >= 0; i--) pts.push([w / 2 - w * Math.cos((i / n) * lim), sh + w * Math.sin((i / n) * lim)]);
  return pts;
}

function notreDame(p: Place): THREE.Group {
  const g = group(p);
  const glowStone = (hex: number) => floodMat(hex, 0xffc277, 0.35);
  const stone = glowStone(0xd8c9a8);
  const stoneDark = glowStone(0xc4b48f);
  const carved = glowStone(0xb7a780);
  const lead = mat(0x8c969c, { roughness: 0.5, metalness: 0.3 });
  const zF = 2.7;
  const towerH = 3.7;

  // West facade: two flat-topped square towers around a central block.
  for (const x of [-0.925, 0.925]) g.add(box(0.95, towerH, 1.0, stone, { x, z: 2.2 }));
  g.add(box(0.9, 2.75, 0.8, stone, { z: 2.3 }));
  g.add(box(2.4, 0.08, 0.5, mat(0xc9c2b4), { z: 2.95 }));
  for (const x of [-1.35, -0.45, 0.45, 1.35]) g.add(box(0.1, towerH, 0.12, stoneDark, { x, z: zF + 0.05 }));
  // Horizontal tiers: Gallery of Kings, rose-level string, open arcade gallery.
  g.add(box(2.84, 0.2, 0.08, stoneDark, { y: 1.12, z: zF + 0.02 }));
  for (let i = 0; i < 15; i++) g.add(box(0.05, 0.13, 0.04, carved, { x: -1.26 + i * 0.18, y: 1.155, z: zF + 0.07 }));
  g.add(box(2.84, 0.06, 0.07, stoneDark, { y: 2.3, z: zF + 0.02 }));
  g.add(box(0.9, 0.24, 0.07, stoneDark, { y: 2.4, z: zF + 0.01 }));
  for (let i = 0; i < 9; i++) g.add(box(0.03, 0.2, 0.04, M.dark, { x: -0.36 + i * 0.09, y: 2.42, z: zF + 0.055 }));
  g.add(box(0.96, 0.07, 0.1, stoneDark, { y: 2.7, z: zF + 0.02 }));
  // Tower crowns: cornice plus open parapet.
  for (const x of [-0.925, 0.925]) {
    // Cornice top sits just above the tower top so the two never z-fight.
    g.add(box(1.06, 0.1, 1.1, stoneDark, { x, y: towerH - 0.08, z: 2.2 }));
    for (const s of [-1, 1]) {
      g.add(box(1.06, 0.14, 0.05, stone, { x, y: towerH, z: 2.2 + s * 0.52 }));
      g.add(box(0.05, 0.14, 1.1, stone, { x: x + s * 0.5, y: towerH, z: 2.2 }));
    }
    // Belfry lancets (pairs) on the front and outer faces.
    const sgn = Math.sign(x);
    for (const dx of [-0.17, 0.17]) g.add(profile(lancet(0.13, 0.45), 0.06, M.dark, { x: x + dx, y: 2.55, z: zF + 0.01 }));
    for (const dz of [-0.2, 0.2]) g.add(profile(lancet(0.13, 0.45), 0.06, M.dark, { x: x + sgn * 0.475 + sgn * 0.01, y: 2.55, z: 2.2 + dz, ry: sgn * Math.PI / 2 }));
  }
  // Three recessed pointed portals, each with a lighter archivolt surround.
  g.add(profile(lancet(0.52, 0.55), 0.1, stoneDark, { z: zF + 0.03 }));
  g.add(profile(lancet(0.38, 0.5), 0.1, M.dark, { z: zF + 0.045 }));
  for (const x of [-0.925, 0.925]) {
    g.add(profile(lancet(0.4, 0.4), 0.1, stoneDark, { x, z: zF + 0.03 }));
    g.add(profile(lancet(0.28, 0.36), 0.1, M.dark, { x, z: zF + 0.045 }));
  }
  // Rose window, recessed in a square frame.
  g.add(box(0.64, 0.64, 0.07, stoneDark, { y: 1.5, z: zF + 0.025 }));
  g.add(box(0.54, 0.54, 0.08, M.dark, { y: 1.55, z: zF + 0.03 }));
  const ring = cylinder(0.26, 0.26, 0.05, stoneDark, { segments: 24 });
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 1.82, zF + 0.06);
  g.add(ring);
  const rose = cylinder(0.2, 0.2, 0.05, windowMaterial, { segments: 24 });
  rose.rotation.x = Math.PI / 2;
  rose.position.set(0, 1.82, zF + 0.075);
  g.add(rose);
  for (let k = 0; k < 4; k++) {
    const spoke = box(0.42, 0.025, 0.03, stoneDark, { y: 1.82 - 0.0125, z: zF + 0.1 });
    spoke.position.set(0, 1.82, zF + 0.1);
    spoke.rotation.z = (k * Math.PI) / 4;
    g.add(spoke);
  }

  // Nave, aisles, hexagonal apse.
  g.add(box(1.3, 2.3, 4.9, stone, { z: -0.75 }));
  g.add(gableRoof(4.9, 1.45, 0.8, M.slate, { y: 2.3, z: -0.75, ry: Math.PI / 2 }));
  g.add(cylinder(0.75, 0.75, 2.3, stone, { z: -3.2, segments: 6 }));
  g.add(cone(0.78, 0.85, M.slate, { y: 2.3, z: -3.2, segments: 6 }));
  for (const s of [-1, 1]) {
    for (const [zc, len] of [[0.9, 1.6], [-1.95, 2.1]] as const) {
      g.add(box(0.4, 1.25, len, stone, { x: s * 0.85, z: zc }));
      g.add(profile([[-0.22, 0], [0.24, 0], [-0.22, 0.32]], len, M.slate, { x: s * 0.85, y: 1.25, z: zc, ry: s > 0 ? 0 : Math.PI }));
    }
    // Clerestory lancets.
    for (const zz of [1.3, 0.6, -1.4, -2.1, -2.8]) {
      g.add(profile(lancet(0.13, 0.32), 0.05, M.dark, { x: s * 0.655, y: 1.7, z: zz, ry: s * Math.PI / 2 }));
    }
  }
  // Transept with gable ends in stone and a rose window each side.
  g.add(box(2.7, 2.2, 1.0, stone, { z: -0.4 }));
  g.add(gableRoof(2.8, 1.1, 0.7, M.slate, { y: 2.2, z: -0.4 }));
  for (const s of [-1, 1]) {
    g.add(profile([[-0.55, 0], [0.55, 0], [0, 0.7]], 0.06, stone, { x: s * 1.41, y: 2.2, z: -0.4, ry: Math.PI / 2 }));
    const ringT = cylinder(0.3, 0.3, 0.05, stoneDark, { segments: 24 });
    ringT.rotation.z = Math.PI / 2;
    ringT.position.set(s * 1.38, 1.35, -0.4);
    g.add(ringT);
    const roseT = cylinder(0.22, 0.22, 0.05, windowMaterial, { segments: 24 });
    roseT.rotation.z = Math.PI / 2;
    roseT.position.set(s * 1.4, 1.35, -0.4);
    g.add(roseT);
    for (let k = 0; k < 2; k++) {
      const spoke = box(0.03, 0.46, 0.03, stoneDark);
      spoke.position.set(s * 1.43, 1.35, -0.4);
      spoke.rotation.x = (k * Math.PI) / 2 + Math.PI / 4;
      g.add(spoke);
    }
    g.add(profile(lancet(0.16, 0.3), 0.05, M.dark, { x: s * 1.36, y: 0.35, z: -0.4, ry: s * Math.PI / 2 }));
  }
  // Flying buttresses: outer piers with pinnacles, a sloped strut and an arc under it to the nave wall.
  for (const s of [-1, 1]) {
    for (const zz of [1.3, 0.55, -1.4, -2.1, -2.8]) {
      g.add(box(0.16, 1.75, 0.16, stone, { x: s * 1.4, z: zz }));
      g.add(cone(0.1, 0.28, stoneDark, { x: s * 1.4, y: 1.75, z: zz, segments: 4, ry: Math.PI / 4 }));
      g.add(beam([s * 1.38, 1.7, zz], [s * 0.66, 2.2, zz], 0.08, stone));
      g.add(tube([
        new THREE.Vector3(s * 1.38, 1.5, zz), new THREE.Vector3(s * 1.15, 1.78, zz),
        new THREE.Vector3(s * 0.9, 1.94, zz), new THREE.Vector3(s * 0.68, 2.04, zz),
      ], 0.035, stone, { segments: 12 }));
    }
  }
  // Slender lead-clad flèche: octagonal base, tapering spire with collars and gablets.
  const sp = { z: -0.4 };
  g.add(cylinder(0.2, 0.22, 0.5, lead, { y: 2.95, ...sp, segments: 8 }));
  for (const [dx, dz] of [[0.2, 0.2], [-0.2, 0.2], [0.2, -0.2], [-0.2, -0.2]] as const) {
    g.add(cone(0.05, 0.3, lead, { x: dx, y: 3.45, z: -0.4 + dz, segments: 4 }));
  }
  g.add(cone(0.13, 2.0, lead, { y: 3.45, ...sp, segments: 8 }));
  for (const [y, r] of [[3.75, 0.115], [4.2, 0.092], [4.65, 0.07]] as const) g.add(cylinder(r, r, 0.03, stoneDark, { y, ...sp, segments: 8 }));
  // Lattice on the spire: eight ridge members and X-bracing in each face between the collars.
  const spR = (y: number) => 0.13 * (1 - (y - 3.45) / 2.0) + 0.012;
  const spPt = (k: number, y: number): [number, number, number] => {
    const a = (k * Math.PI) / 4;
    return [Math.sin(a) * spR(y), y, -0.4 + Math.cos(a) * spR(y)];
  };
  const levels = [3.45, 3.75, 4.2, 4.65, 5.1];
  for (let k = 0; k < 8; k++) {
    g.add(beam(spPt(k, 3.45), spPt(k, 5.1), 0.014, lead));
    for (let l = 0; l < levels.length - 1; l++) {
      const k2 = (k + 1) % 8;
      g.add(beam(spPt(k, levels[l]), spPt(k2, levels[l + 1]), 0.01, stoneDark));
      g.add(beam(spPt(k2, levels[l]), spPt(k, levels[l + 1]), 0.01, stoneDark));
    }
  }
  g.add(box(0.02, 0.2, 0.02, lead, { y: 5.45, ...sp }));
  g.add(box(0.1, 0.02, 0.02, lead, { y: 5.55, ...sp }));
  return g;
}

function sacreCoeur(p: Place): THREE.Group {
  const g = group(p);
  const white = floodMat(0xf3efe7, 0xffe2b0, 0.4, { roughness: 0.5 });
  // Montmartre hill: three terraces with a central lawn between paired side stairs, outer lawns beyond them.
  const hill = mat(0xd7d2c8);
  // The basilica sits on the top terrace.
  g.add(box(4.4, 0.9, 4.4, hill, { z: -0.3 }));
  g.add(box(4.8, 0.6, 4.85, hill, { z: -0.075 }));
  g.add(box(5.2, 0.3, 5.3, hill, { z: 0.15 }));
  const lawns: [y: number, z: number, outerW: number, outerX: number][] = [[0.9, 1.7, 0.8, 1.8], [0.6, 2.15, 1.0, 1.9], [0.3, 2.6, 1.2, 2.0]];
  for (const [y, z, outerW, outerX] of lawns) {
    g.add(patch(1.4, 0.4, M.grass, { y, z }));
    for (const s of [-1, 1]) g.add(patch(outerW, 0.4, M.grass, { x: s * outerX, y, z }));
  }
  for (const s of [-1, 1]) {
    for (let i = 0; i < 9; i++) g.add(box(0.6, 0.1 * (i + 1), 0.1, STAIR, { x: s * 1.05, z: 2.75 - i * 0.1 }));
    for (const dx of [0.77, 1.33]) g.add(beam([s * dx, 0.1, 2.8], [s * dx, 1.0, 1.9], 0.06, white));
  }
  // Balustrade round the top terrace, open where the two stairs arrive.
  g.add(box(1.4, 0.12, 0.05, white, { y: 0.9, z: 1.87 }));
  for (const s of [-1, 1]) {
    g.add(box(0.8, 0.12, 0.05, white, { x: s * 1.8, y: 0.9, z: 1.87 }));
    g.add(box(0.05, 0.12, 4.2, white, { x: s * 2.17, y: 0.9, z: -0.3 }));
  }
  const b = group({ y: 0.9, z: -0.4 });
  b.add(box(2.6, 1.6, 2.4, white));
  // Portico: three round arches over a dark loggia, under a cornice.
  b.add(box(1.4, 1.0, 0.4, white, { z: 1.35 }));
  b.add(box(1.3, 0.62, 0.02, M.dark, { z: 1.56 }));
  const porch = [-0.45, 0, 0.45].map((x) => archHole(x, 0.32, 0.45, 8));
  b.add(profile([[-0.7, 0], [0.7, 0], [0.7, 1.0], [-0.7, 1.0]], 0.18, white, { z: 1.66, holes: porch }));
  b.add(box(1.5, 0.06, 0.66, white, { y: 1.0, z: 1.45 }));
  // Central drum and tall dome.
  b.add(cylinder(0.75, 0.75, 1.1, white, { y: 1.6 }));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(box(0.09, 0.34, 0.03, M.dark, { x: Math.sin(a) * 0.76, y: 1.95, z: Math.cos(a) * 0.76, ry: a }));
  }
  b.add(cylinder(0.82, 0.82, 0.06, white, { y: 2.64 }));
  b.add(dome(0.78, white, { y: 2.7, squash: 1.45 }));
  b.add(cylinder(0.14, 0.16, 0.45, white, { y: 3.8, segments: 10 }));
  b.add(dome(0.16, white, { y: 4.25, squash: 1.6, segments: 10 }));
  b.add(cone(0.035, 0.22, white, { y: 4.49, segments: 6 }));
  // Four smaller domes.
  for (const [x, z] of [[-1.0, 0.9], [1.0, 0.9], [-1.0, -0.9], [1.0, -0.9]] as const) {
    b.add(cylinder(0.3, 0.3, 0.5, white, { x, y: 1.6, z, segments: 14 }));
    b.add(dome(0.32, white, { x, y: 2.1, z, squash: 1.4, segments: 14 }));
    b.add(cone(0.05, 0.22, white, { x, y: 2.53, z, segments: 6 }));
  }
  // Bell tower behind.
  b.add(box(0.7, 2.8, 0.7, white, { z: -1.6 }));
  b.add(dome(0.38, white, { y: 2.8, z: -1.6, squash: 1.4, segments: 12 }));
  g.add(b);
  return g;
}

function arcDeTriomphe(p: Place): THREE.Group {
  const g = group(p);
  const stone = floodMat(0xe3d6bb, 0xffc277, 0.4);
  const band = floodMat(0xd2c3a3, 0xffc277, 0.4);
  const w = 2.6;
  const d = 1.4;
  const pierW = 0.78;
  const spring = 1.1;
  const archR = 0.475;
  const hPier = 2.0;
  g.add(box(w + 0.16, 0.1, d + 0.16, band));
  // Piers, each pierced by a transverse arch along X.
  for (const s of [-1, 1]) {
    g.add(profile([[-d / 2, 0.1], [d / 2, 0.1], [d / 2, hPier], [-d / 2, hPier]], pierW, stone, {
      holes: [archHole(0, 0.5, 0.75, 8).map(([x, y]) => [x, Math.max(y, 0.1)] as [number, number])],
      ry: Math.PI / 2,
      x: s * (w / 2 - pierW / 2),
    }));
    // Relief panels (sculpture groups) on the front and back of each pier.
    for (const zz of [-1, 1]) {
      const px = s * (w / 2 - pierW / 2);
      g.add(box(0.56, 1.45, 0.05, band, { x: px, y: 0.3, z: zz * (d / 2 + 0.02) }));
      g.add(box(0.44, 1.2, 0.06, stone, { x: px, y: 0.42, z: zz * (d / 2 + 0.03) }));
      g.add(box(0.3, 0.55, 0.07, band, { x: px, y: 0.75, z: zz * (d / 2 + 0.04) }));
    }
  }
  // Spandrel over the great arch: the intrados is a semicircle between the piers.
  const pts: [number, number][] = [[-w / 2 + pierW - 0.05, hPier], [-archR - 0.1, spring]];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI - (i / 12) * Math.PI;
    pts.push([Math.cos(a) * archR, spring + Math.sin(a) * archR]);
  }
  pts.push([archR + 0.1, spring], [w / 2 - pierW + 0.05, hPier]);
  g.add(profile(pts, d, stone));
  // Archivolt rings on both faces.
  for (const zz of [-1, 1]) {
    const ring: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI - (i / 10) * Math.PI;
      ring.push(new THREE.Vector3(Math.cos(a) * (archR + 0.04), spring + Math.sin(a) * (archR + 0.04), zz * (d / 2 + 0.02)));
    }
    g.add(tube(ring, 0.03, band, { segments: 20 }));
  }
  // Coffered vault suggestion: ribs and dark soffit inside the great arch and each transverse passage.
  const rib = floodMat(0xc4b48f, 0xffc277, 0.3);
  for (let k = -3; k <= 3; k++) {
    const rr = archR - 0.015;
    const pts2: THREE.Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI - (i / 10) * Math.PI;
      pts2.push(new THREE.Vector3(Math.cos(a) * rr, spring + Math.sin(a) * rr, k * 0.2));
    }
    g.add(tube(pts2, 0.018, rib, { segments: 20 }));
  }
  g.add(box(archR * 2 - 0.02, 0.012, d - 0.04, M.pavement, { y: 0.1 }));
  for (const s of [-1, 1]) {
    const cx = s * (w / 2 - pierW / 2);
    for (let k = -1; k <= 1; k++) {
      const pts3: THREE.Vector3[] = [];
      for (let i = 0; i <= 8; i++) {
        const a = Math.PI - (i / 8) * Math.PI;
        pts3.push(new THREE.Vector3(cx + k * 0.22, 0.75 + Math.sin(a) * 0.235, Math.cos(a) * 0.235));
      }
      g.add(tube(pts3, 0.014, rib, { segments: 14 }));
    }
  }
  // Entablature, attic storey with shield band, crowning cornice.
  g.add(box(w + 0.1, 0.16, d + 0.1, band, { y: hPier }));
  const aY = hPier + 0.16;
  g.add(box(w + 0.02, 0.55, d + 0.02, stone, { y: aY }));
  const shield = mat(0xa88f62, { roughness: 0.5, metalness: 0.25 });
  for (let i = 0; i < 9; i++) {
    const sx = -w / 2 + 0.2 + i * ((w - 0.4) / 8);
    for (const zz of [-1, 1]) {
      const s = cylinder(0.075, 0.075, 0.03, shield, { x: sx, y: aY + 0.2, z: zz * (d / 2 + 0.02), segments: 12 });
      s.rotation.x = Math.PI / 2;
      g.add(s);
    }
  }
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const s = cylinder(0.075, 0.075, 0.03, shield, { x: sx * (w / 2 + 0.02), y: aY + 0.2, z: -0.4 + i * 0.4, segments: 12 });
    s.rotation.z = Math.PI / 2;
    g.add(s);
  }
  g.add(box(w + 0.16, 0.1, d + 0.16, band, { y: aY + 0.55 }));
  g.add(box(w - 0.1, 0.08, d - 0.1, stone, { y: aY + 0.65 }));
  return g;
}

function haussmann(x: number, z: number, w: number, d: number, h: number, ry: number, shop: number, tables = false): THREE.Group {
  const g = group({ x, z, ry });
  const rh = 0.65;
  g.add(building({ w, d, h, wall: M.limestone, roof: 'mansard', roofMat: ZINC, roofH: rh, shop }));

  // Continuous wrought-iron balcony bands under the 2nd-floor and top-floor windows.
  const floorH = 0.55;
  const startY = 0.62;
  const floors = Math.max(1, Math.floor((h - startY) / floorH));
  const bandFloors = [0, floors - 1].filter((f, i, a) => a.indexOf(f) === i);
  for (const f of bandFloors) {
    const yb = startY + f * floorH + (floorH * 0.5) / 2 - 0.085;
    g.add(box(w * 0.94, 0.035, 0.13, M.limestone, { y: yb, z: d / 2 + 0.065 }));
    g.add(box(w * 0.94, 0.11, 0.02, IRONWORK, { y: yb + 0.035, z: d / 2 + 0.12 }));
    for (const s of [-1, 1]) {
      g.add(box(0.13, 0.035, d * 0.94, M.limestone, { y: yb, x: s * (w / 2 + 0.065) }));
      g.add(box(0.02, 0.11, d * 0.94, IRONWORK, { y: yb + 0.035, x: s * (w / 2 + 0.12) }));
    }
  }

  // Zinc mansard: dormers on the slope, plus chimney stacks.
  const W = w + 0.08;
  const D = d + 0.08;
  const inset = 0.22 * Math.min(W, D);
  const front = group({ z: D / 2 });
  dormers(front, w, h, rh, inset);
  g.add(front);
  for (const s of [-1, 1]) {
    const side = group({ x: s * (W / 2), ry: s * Math.PI / 2 });
    dormers(side, d, h, rh, inset);
    g.add(side);
  }
  const brick = mat(0xa0634a);
  const top = h + rh;
  for (const s of [-1, 1]) {
    const sx = s * (W / 2 - inset - 0.12);
    g.add(box(0.2, 0.3, 0.12, brick, { x: sx, y: top, z: -d * 0.1 }));
    for (const dx of [-0.05, 0.05]) g.add(cylinder(0.025, 0.025, 0.08, M.dark, { x: sx + dx, y: top + 0.3, z: -d * 0.1, segments: 6 }));
  }

  // Café terrace: bistro tables and chairs under the shop awning.
  if (tables) {
    for (const dx of [-0.25, 0.25]) {
      const tx = dx * w * 0.9;
      g.add(cylinder(0.01, 0.01, 0.1, IRONWORK, { x: tx, z: d / 2 + 0.42, segments: 5 }));
      g.add(cylinder(0.065, 0.065, 0.012, IRONWORK, { x: tx, y: 0.1, z: d / 2 + 0.42, segments: 10 }));
      for (const dz of [-0.11, 0.11]) g.add(box(0.05, 0.08, 0.05, M.red, { x: tx + dz, y: 0, z: d / 2 + 0.42 }));
    }
  }
  return g;
}

export default function build(): CityScene {
  const rand = rng(75);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: WET_COBBLE, side: mat(0x69707b) }));

  // Streets.
  root.add(road(-10, 2.1, 10, 2.1, 1.5, { lines: false, material: WET_ROAD }));
  root.add(road(0.2, -10, 0.2, 10, 1.3, { lines: false, material: WET_ROAD }));
  root.add(road(5.6, 2.8, 5.6, 10, 1.1, { lines: false, material: WET_ROAD }));

  // Champ de Mars around the tower.
  root.add(patch(8.6, 6.6, WET_PAVING, { x: -5.4, z: 6.4 }));
  root.add(patch(1.6, 5.4, M.grassDark, { x: -9.0, y: 0.01, z: 6.5 }));
  root.add(eiffelTower({ x: -5.2, z: 6.4 }));
  // Shallow puddles on the Champ de Mars and the Cour Napoléon (paving tops at 0.04), kept clear of the tower legs.
  const puddles: [x: number, z: number, rx: number, rz: number][] = [
    [-6.9, 8.9, 0.7, 0.35], [-2.6, 5.3, 0.55, 0.4], [-5.2, 3.9, 0.6, 0.3], [-3.6, 9.0, 0.5, 0.3], [-7.6, 5.4, 0.45, 0.3],
    [-7.0, -6.2, 0.6, 0.3], [-3.4, -6.1, 0.55, 0.3], [-7.3, -3.2, 0.45, 0.28],
  ];
  puddles.forEach(([x, z, rx, rz], k) => {
    const outline = Array.from({ length: 8 }, (_, i): [number, number] => {
      const a = (i / 8) * Math.PI * 2;
      const wob = 1 + 0.2 * Math.sin(i * 2.3 + k);
      return [Math.cos(a) * rx * wob, Math.sin(a) * rz * wob];
    });
    root.add(area(outline, PUDDLE, { x, z, y: 0.03, h: 0.02 }));
  });
  root.add(row(-9.0, 4.2, -9.0, 9.2, 5, (x, z) => tree({ x, z, s: 0.9 })));

  root.add(louvre());
  root.add(notreDame({ x: 2.8, z: -2.8 }));
  root.add(sacreCoeur({ x: 7.1, z: -6.6 }));

  // Zebra crossings at the main crossing and either side of the Étoile.
  root.add(crosswalk(1.4, 2.1, 1.5, { ry: Math.PI / 2 }));
  root.add(crosswalk(-1.0, 2.1, 1.5, { ry: Math.PI / 2 }));
  root.add(crosswalk(4.4, 2.1, 1.5, { ry: Math.PI / 2 }));
  root.add(crosswalk(0.2, 0.7, 1.3));
  root.add(crosswalk(0.2, 3.6, 1.3));
  root.add(crosswalk(5.6, 4.2, 1.1));
  root.add(crosswalk(5.6, 9.3, 1.1));
  // Étoile roundabout with the arch.
  root.add(cylinder(2.4, 2.4, 0.03, WET_ROAD, { x: 7.2, z: 6.8, segments: 32 }));
  root.add(arcDeTriomphe({ x: 7.2, z: 6.8, ry: Math.PI / 4 }));

  // Haussmann blocks.
  root.add(haussmann(2.6, 4.6, 2.6, 1.6, 2.4, 0, CAFE_RED, true));
  root.add(haussmann(2.6, 8.2, 2.6, 2.4, 2.6, 0, CAFE_NAVY));
  root.add(haussmann(8.4, -0.8, 2.6, 2.0, 2.5, 0, CAFE_GREEN, true));
  root.add(haussmann(6.0, -1.2, 1.4, 2.6, 2.2, 0, CAFE_RED, true));
  root.add(haussmann(9.0, 3.6, 1.6, 1.2, 2.1, Math.PI / 2, CAFE_NAVY));
  root.add(haussmann(-2.0, 0.2, 2.2, 1.5, 2.3, 0, CAFE_GREEN, true));
  root.add(haussmann(-5.6, 0.2, 2.8, 1.5, 1.9, 0, CAFE_RED));

  // Street life: lamps, trees, and Parisians in winter coats under umbrellas.
  root.add(row(-9.5, 1.2, 9.5, 1.2, 12, (x, z) => lamp({ x, z })));
  root.add(row(-0.8, -9.5, -0.8, 9.5, 10, (x, z) => lamp({ x, z })));
  const parisian = (x: number, z: number, i: number, dry = false) =>
    person({ x, y: 0.04, z, color: COATS[i % COATS.length], umbrella: dry ? undefined : UMBRELLAS[(i * 3 + 1) % UMBRELLAS.length] });
  // Standing groups keep off the tower legs, the pyramid and its pools.
  const underLeg = (x: number, z: number) => Math.abs(Math.abs(x + 5.2) - 2.05) < 0.75 && Math.abs(Math.abs(z - 6.4) - 2.05) < 0.75;
  const onPyramid = (x: number, z: number) =>
    (Math.abs(x + 5.2) < 1.3 && Math.abs(z + 4.6) < 1.3) || Math.hypot(x + 7.1, z + 4.6) < 0.9 || Math.hypot(x + 3.3, z + 4.6) < 0.9 || Math.hypot(x + 5.2, z + 2.9) < 0.9;
  root.add(scatter({ x: -5.3, z: 6.4, w: 7.8, d: 6.0 }, 22, rand, parisian, underLeg));
  root.add(scatter({ x: -5.2, z: -4.8, w: 5.6, d: 3.8 }, 12, rand, parisian, onPyramid));
  root.add(scatter({ x: 7.2, z: 9.0, w: 4.4, d: 0.6 }, 6, rand, (x, z, i) => parisian(x, z, i, i % 2 === 0)));
  // Walkers: a loop round the Champ de Mars, a pass under the tower, and the Cour Napoléon's south side.
  const champ: [number, number][] = [[-8.9, 3.5], [-1.5, 3.5], [-1.5, 9.3], [-8.9, 9.3]];
  for (let i = 0; i < 4; i++) root.add(anim.follow(parisian(0, 0, i), champ, 0.28, i / 4, true));
  const arch: [number, number][] = [[-5.0, 3.3], [-5.0, 9.5], [-6.0, 9.5], [-6.0, 3.3]];
  for (let i = 0; i < 2; i++) root.add(anim.follow(parisian(0, 0, i + 4), arch, 0.25, i / 2, true));
  const cour: [number, number][] = [[-7.6, -6.6], [-2.8, -6.6], [-2.8, -6.15], [-7.6, -6.15]];
  for (let i = 0; i < 3; i++) root.add(anim.follow(parisian(0, 0, i + 1, i === 1), cour, 0.24, i / 3, true));
  root.add(row(3.8, 0.9, 9.2, 0.9, 6, (x, z) => tree({ x, z, s: 0.75 })));

  // Traffic.
  const lanes: [number, number][][] = [
    [[-9.6, 1.75], [9.6, 1.75]],
    [[9.6, 2.45], [-9.6, 2.45]],
  ];
  lanes.forEach((path, li) => {
    for (let i = 0; i < 4; i++) root.add(anim.follow(car({ y: 0.05 }), path, 1.4, i / 4 + li * 0.13));
  });
  for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: 0.05 }), [[0.0, -9.6], [0.0, 9.6]], 1.1, i / 3));
  for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: 0.05 }), [[0.45, 9.6], [0.45, -9.6]], 1.1, i / 3 + 0.15));

  return { root, update: anim.update };
}
