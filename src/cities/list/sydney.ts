import * as THREE from 'three';
import {
  Animator, M, archHole, area, beam, boat, box, building, car, cone, createBase, crosswalk, cylinder, dome, floodMat, group, hipRoof, lamp, lampMaterial, lathe, mat,
  mergeStatic, patch, person, prism, profile, rng, road, row, scatter, tree, tube, waterMat, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';

type P2 = [number, number];
type Mat = THREE.Material;

// North is +z: the CBD fills the back-left quarter, the Royal Botanic Garden the
// left corner, the harbour runs across the middle and the North Shore holds the
// front corner. East is -x, so the bridge (west of the Opera House) sits at +x.

const WATER = waterMat(0x1f7fbf);
const SEAWALL = mat(0xd3bf98);
const PAVING = mat(0xe6d7b8);
const STREET = mat(0x7d8087, { roughness: 0.95, surface: 'road' });
const PATH = mat(0xe8dcbc);
const LAWN = M.grass;
const SANDSTONE = mat(0xd9b17c);
const SANDSTONE_WARM = mat(0xcf9a62);
const BRICK = mat(0xb4694a);
const CREAM = mat(0xeadfc6);
const SLATE = mat(0x67646a, { roughness: 0.7 });
// Summer tees and shirts: white, sky blue, coral, yellow, navy, teal. Parasols in the same family.
const SUMMER = [0xf4f1ea, 0x6fb4e3, 0xf0745f, 0xf2c94c, 0x1f3a6b, 0x2fa59a];
const PARASOLS = [0xf0745f, 0xf2c94c, 0x6fb4e3, 0xf4f1ea];
function aussie(x: number, y: number, z: number, i: number, shade = false): THREE.Group {
  return person({ x, y, z, color: SUMMER[i % SUMMER.length], umbrella: shade ? PARASOLS[i % PARASOLS.length] : undefined });
}
const TERRA = mat(0xb9573c);
const TIMBER = mat(0xa98b63);
const GOLD = mat(0xe0b040, { roughness: 0.35, metalness: 0.6 });
// Aviation beacon: a plain pale lens by day, glowing red at night only.
const BEACON = floodMat(0xd9d4cc, 0xff2211, 2.5);

function addMesh(g: THREE.Group, geo: THREE.BufferGeometry, m: THREE.Material, p: Place = {}): void {
  const o = new THREE.Mesh(geo, m);
  o.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  o.rotation.y = p.ry ?? 0;
  o.castShadow = true;
  o.receiveShadow = true;
  g.add(o);
}

/** Resample a shoreline through control points (centripetal Catmull-Rom) at ~`perUnit` points per unit. */
function smooth(ctrl: P2[], perUnit = 3): P2[] {
  const curve = new THREE.CatmullRomCurve3(ctrl.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal');
  const n = Math.max(2, Math.ceil(curve.getLength() * perUnit));
  return curve.getSpacedPoints(n).map((v) => [v.x, v.z] as P2);
}

/** Low sandstone seawall following a shoreline polyline. */
function seawall(pts: P2[]): THREE.Group {
  const g = group();
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1];
    const [bx, bz] = pts[i];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 1e-3) continue;
    g.add(box(0.1, 0.1, len + 0.06, SEAWALL, { x: (ax + bx) / 2, z: (az + bz) / 2, ry: Math.atan2(bx - ax, bz - az) }));
  }
  return g;
}

function distToSegment(px: number, pz: number, [ax, az]: P2, [bx, bz]: P2): number {
  const dx = bx - ax;
  const dz = bz - az;
  const k = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - ax - dx * k, pz - az - dz * k);
}

// ---------------------------------------------------------------------------
// Opera House
// ---------------------------------------------------------------------------

const RIB = mat(0xd8ccb2, { roughness: 0.5 });
const SHELL_W = mat(0xf6f3ec, { roughness: 0.5 });
const BRONZE = mat(0x7a5d43, { roughness: 0.3, metalness: 0.4 });
for (const m of [SHELL_W, RIB, BRONZE]) m.side = THREE.DoubleSide;
const PODIUM = mat(0xe0cfae);
const PODIUM_DARK = mat(0xbf9a6c);
const HALL_BASE = mat(0xa3805a);

/**
 * One Opera House shell: a smooth doubly-curved vault. Its open end (s = 0)
 * sits at the local origin facing +z; height and width both fall smoothly to
 * a point at s = 1 (z = -L). Cross-sections are rounded pointed arches;
 * symmetric chevron bands of cream tile suggest the rib pattern. The bronze
 * glazing is set back under the lip, so the white vault reads first.
 */
function shell(hw: number, H: number, L: number, p: Place): THREE.Group {
  const g = group(p);
  const S = 28;
  const K = 28;
  const spine = (s: number) => H * Math.cos(s * Math.PI * 0.5) ** 0.85;
  const span = (s: number) => hw * (1 - s ** 1.3) ** 0.6;
  const arch = (u: number) => (1 - Math.abs(u) ** 1.1) ** 0.7;
  const pos: number[] = [];
  for (let j = 0; j <= S; j++) {
    const s = j / S;
    for (let k = 0; k <= K; k++) {
      const u = (k / K) * 2 - 1;
      pos.push(u * span(s), spine(s) * arch(u), -s * L);
    }
  }
  const iw: number[] = [];
  const ir: number[] = [];
  for (let j = 0; j < S; j++) {
    for (let k = 0; k < K; k++) {
      const a = j * (K + 1) + k;
      const b = a + K + 1;
      (Math.floor((j + Math.abs(k - K / 2 + 0.5)) * 0.5) % 4 === 0 ? ir : iw).push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const attr = new THREE.Float32BufferAttribute(pos, 3);
  for (const [idx, m] of [[iw, SHELL_W], [ir, RIB]] as const) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', attr);
    geo.setIndex(idx);
    geo.computeVertexNormals();
    addMesh(g, geo, m);
  }
  // Rolled rim along the mouth gives the thin shell a crisp edge.
  g.add(tube(Array.from({ length: 15 }, (_, k) => {
    const u = (k / 14) * 2 - 1;
    return new THREE.Vector3(u * hw, H * arch(u), 0);
  }), 0.03, RIB, { segments: 28 }));
  // Glazed wall filling the section a little way inside the mouth, divided by
  // bronze mullions and a transom; it lights up at night.
  const s0 = 0.16;
  const outline: THREE.Vector2[] = [new THREE.Vector2(-span(s0), 0)];
  for (let k = 0; k <= K; k++) {
    const u = (k / K) * 2 - 1;
    outline.push(new THREE.Vector2(u * span(s0) * 0.98, spine(s0) * arch(u) * 0.97));
  }
  outline.push(new THREE.Vector2(span(s0), 0));
  addMesh(g, new THREE.ShapeGeometry(new THREE.Shape(outline)), windowMaterial, { y: 0.01, z: -s0 * L });
  const gz = -s0 * L;
  for (let i = -2; i <= 2; i++) {
    const u = i * 0.36;
    g.add(beam([u * span(s0) * 0.98, 0.01, gz], [u * span(s0) * 0.98, 0.01 + spine(s0) * arch(u) * 0.97, gz], 0.025, BRONZE));
  }
  const yt = 0.45 * spine(s0);
  const ut = (1 - (yt / (0.97 * spine(s0))) ** (1 / 0.7)) ** (1 / 1.1);
  g.add(beam([-ut * span(s0) * 0.98, 0.01 + yt, gz], [ut * span(s0) * 0.98, 0.01 + yt, gz], 0.025, BRONZE));
  return g;
}

/** Podium outline: square land end at -z, rounded harbour tip at +z. */
function podiumOutline(inset: number): P2[] {
  const hw = 2.1 - inset;
  const z0 = -4.0 + inset;
  const zt = 2.0;
  const rz = 1.2 - inset;
  const pts: P2[] = [[-hw, z0], [hw, z0], [hw, zt]];
  for (let i = 1; i < 12; i++) {
    const a = (i / 12) * Math.PI;
    pts.push([hw * Math.cos(a), zt + rz * Math.sin(a)]);
  }
  pts.push([-hw, zt]);
  return pts;
}

/** Shells open toward the tip (+z); the Monumental Steps climb from the land end (-z). */
function operaHouse(p: Place): THREE.Group {
  const g = group(p);
  // Stepped podium: dark sandstone base, glazed foyer band under the terrace lip.
  g.add(prism(podiumOutline(0), 0.14, PODIUM_DARK));
  g.add(prism(podiumOutline(0.07), 0.12, windowMaterial, { y: 0.14 }));
  g.add(prism(podiumOutline(-0.04), 0.06, PODIUM, { y: 0.26 }));
  for (let i = 0; i < 5; i++) g.add(box(2.8, 0.064 * (i + 1), 0.13, PODIUM, { z: -4.54 + i * 0.12 }));
  for (const sx of [-1.48, 1.48]) g.add(box(0.16, 0.36, 0.7, PODIUM_DARK, { x: sx, z: -4.3 }));
  const Y = 0.32;
  const BASE_H = 0.3;
  // Each hall: shells facing +z, rising from the steps to the tallest pair at
  // the harbour end, each peak clearing the back slope of the shell in front;
  // one small shell faces the steps. The larger Concert Hall sits on the city
  // side (+x), the smaller hall on the open-harbour side.
  const halls = [
    { x: 0.92, hw: [0.6, 0.75, 0.88, 0.95], H: [1.75, 2.2, 2.7, 3.0], L: [1.5, 2.0, 2.5, 2.6], z: [-1.9, -0.9, 0.3, 1.6], back: [[-2.7, 1.4, 0.55, 1.4]] },
    { x: -0.92, hw: [0.55, 0.68, 0.78], H: [1.4, 1.9, 2.4], L: [1.4, 1.9, 2.2], z: [-1.6, -0.5, 0.8], back: [[-2.5, 1.2, 0.5, 1.2]] },
  ];
  for (const h of halls) {
    // Each hall stands on its own stepped brown base, as the halls rise above the broadwalk.
    const z0 = Math.min(...h.back.map((b) => b[0])) - 0.15;
    const z1 = Math.max(...h.z) + 0.3;
    const w = 2 * Math.max(...h.hw) + 0.15;
    for (let i = 0; i < 3; i++) g.add(box(w - i * 0.16, BASE_H / 3, z1 - z0 - i * 0.16, HALL_BASE, { x: h.x, y: Y + (i * BASE_H) / 3, z: (z0 + z1) / 2 }));
    h.z.forEach((z, i) => g.add(shell(h.hw[i], h.H[i], h.L[i], { x: h.x, y: Y + BASE_H, z })));
    for (const [z, H, hw, L] of h.back) g.add(shell(hw, H, L, { x: h.x, y: Y + BASE_H, z, ry: Math.PI }));
  }
  // Crowd on the steps and the broadwalk at the tip.
  for (let i = 0; i < 6; i++) g.add(aussie(-1.2 + i * 0.48, Y, -3.7 + (i % 2) * 0.2, i));
  for (let i = 0; i < 4; i++) g.add(aussie(-1.0 + i * 0.7, Y, 2.6 + (i % 2) * 0.15, i + 3, i % 2 === 0));
  return g;
}

// ---------------------------------------------------------------------------
// Harbour Bridge
// ---------------------------------------------------------------------------

const BRIDGE_STEEL = mat(0x58606a, { roughness: 0.55, metalness: 0.45 });
const GRANITE = mat(0xcbb792);
const GRANITE_DARK = mat(0xb39d78);
const DECK = mat(0x4a4f57, { roughness: 0.9 });
const BALLAST = mat(0x5e5248, { roughness: 0.95 });
/** Bridge deck underside and its surface (roadway, rail head). */
const DECK_Y = 0.85;
const ROAD_Y = DECK_Y + 0.1;
const RAIL_Y = ROAD_Y + 0.045;

/** Granite pylon: tapered tower pierced by an arch at its foot, with a stepped top. */
function pylon(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  g.add(box(0.1, 0.05, 0.1, lampMaterial, { y: 2.94 }));
  // Profile in (x, y), extruded along the bridge so the arch shows on the end faces.
  g.add(profile([[-0.36, 0], [0.36, 0], [0.3, 2.3], [-0.3, 2.3]], 1.0, GRANITE, { holes: [archHole(0, 0.3, 0.55, 8)] }));
  for (const y of [0.95, 1.65]) g.add(box(0.76 - y * 0.05, 0.04, 1.04, GRANITE_DARK, { y }));
  g.add(box(0.7, 0.1, 1.08, GRANITE_DARK, { y: 2.3 }));
  g.add(box(0.52, 0.34, 0.88, GRANITE, { y: 2.4 }));
  g.add(box(0.58, 0.06, 0.94, GRANITE_DARK, { y: 2.74 }));
  g.add(box(0.36, 0.14, 0.52, GRANITE, { y: 2.8 }));
  return g;
}

/**
 * Through-arch bridge along z. The deck carries a two-lane roadway (local -x)
 * and a rail track (local +x), and continues south as a steel viaduct over the
 * Rocks to the plinth edge.
 */
function harbourBridge(x: number): THREE.Group {
  const g = group({ x });
  const C = 2.9;
  const HS = 5.0;
  const TX = 1.08;
  const Z0 = -9.75;
  const Z1 = 9.75;
  const L = Z1 - Z0;
  const ZM = (Z0 + Z1) / 2;
  // Arch depth tapers from deep at the bearings to shallow at the crown.
  const k = (z: number) => ((z - C) / HS) ** 2;
  const bot = (z: number) => 0.4 + 3.0 * (1 - k(z));
  const top = (z: number) => bot(z) + 0.32 + 0.55 * k(z);
  const N = 22;
  const zs = Array.from({ length: N + 1 }, (_, i) => C - HS + (2 * HS * i) / N);

  // Deck: road, divider, rail track, parapets.
  g.add(box(2.0, 0.1, L, DECK, { y: DECK_Y, z: ZM }));
  g.add(box(2.08, 0.07, L, BRIDGE_STEEL, { y: DECK_Y - 0.07, z: ZM }));
  g.add(box(0.04, 0.008, L, M.roadLine, { x: -0.45, y: ROAD_Y, z: ZM }));
  g.add(box(0.05, 0.08, L, M.steel, { x: 0.4, y: ROAD_Y, z: ZM }));
  g.add(box(0.4, 0.02, L, BALLAST, { x: 0.68, y: ROAD_Y, z: ZM }));
  for (const rx of [0.6, 0.76]) g.add(box(0.025, 0.025, L, M.steel, { x: rx, y: ROAD_Y + 0.02, z: ZM }));
  for (const sx of [-0.98, 0.98]) g.add(box(0.04, 0.12, L, M.steel, { x: sx, y: ROAD_Y, z: ZM }));

  for (const sx of [-1, 1]) {
    const rx = sx * TX;
    g.add(tube(zs.map((z) => new THREE.Vector3(rx, bot(z), z)), 0.055, BRIDGE_STEEL, { segments: 56 }));
    g.add(tube(zs.map((z) => new THREE.Vector3(rx, top(z), z)), 0.055, BRIDGE_STEEL, { segments: 56 }));
    // Web: verticals plus Warren diagonals between the chords.
    for (let i = 0; i <= N; i++) g.add(beam([rx, bot(zs[i]), zs[i]], [rx, top(zs[i]), zs[i]], 0.03, BRIDGE_STEEL));
    for (let i = 0; i < N; i++) {
      const up = i % 2 === 0;
      g.add(beam([rx, (up ? bot : top)(zs[i]), zs[i]], [rx, (up ? top : bot)(zs[i + 1]), zs[i + 1]], 0.028, BRIDGE_STEEL));
    }
    // Hangers from the lower chord down to the deck.
    for (let z = -1.5; z <= 7.3; z += 0.42) {
      if (bot(z) > ROAD_Y + 0.25) g.add(beam([rx, ROAD_Y, z], [rx, bot(z), z], 0.022, BRIDGE_STEEL));
    }
  }
  // Wind bracing: cross members and diagonals between the top chords, plus
  // lower-chord struts where they clear the trains.
  for (let i = 1; i < N; i++) {
    const z = zs[i];
    g.add(beam([-TX, top(z), z], [TX, top(z), z], 0.03, BRIDGE_STEEL));
    if (i % 2 === 1) g.add(beam([-TX, top(z), z], [TX, top(zs[i + 1]), zs[i + 1]], 0.022, BRIDGE_STEEL));
    if (i % 2 === 0 && bot(z) > ROAD_Y + 1.0) g.add(beam([-TX, bot(z), z], [TX, bot(z), z], 0.025, BRIDGE_STEEL));
  }
  // Pylon pairs flank the deck at each end of the arch.
  for (const z of [-2.5, 8.3]) for (const sx of [-1.42, 1.42]) g.add(pylon(sx, z));
  // Deck lamps along both parapets and obstruction lights along the arch crown.
  for (let z = Z0 + 0.4; z < Z1 - 0.3; z += 0.8) {
    for (const sx of [-0.9, 0.9]) {
      g.add(cylinder(0.012, 0.016, 0.2, M.steel, { x: sx, y: ROAD_Y, z, segments: 4 }));
      g.add(box(0.06, 0.03, 0.06, lampMaterial, { x: sx, y: ROAD_Y + 0.2, z }));
    }
  }
  for (const z of [C - 3, C - 1.5, C, C + 1.5, C + 3]) for (const sx of [-TX, TX]) g.add(box(0.06, 0.06, 0.06, lampMaterial, { x: sx, y: top(z) + 0.05, z }));
  // North abutment down to the plinth edge.
  g.add(box(2.0, DECK_Y - 0.07, 0.9, GRANITE, { z: 9.3 }));
  // South approach viaduct: steel bents and lattice girders over the Rocks.
  const VZ0 = Z0;
  const VZ1 = -3.0;
  for (let z = VZ0 + 0.35; z < VZ1; z += 1.3) {
    for (const sx of [-0.8, 0.8]) g.add(box(0.1, DECK_Y - 0.07, 0.1, BRIDGE_STEEL, { x: sx, z }));
    g.add(box(1.9, 0.08, 0.12, BRIDGE_STEEL, { y: DECK_Y - 0.22, z }));
  }
  for (const sx of [-1.02, 1.02]) {
    g.add(box(0.04, 0.05, VZ1 - VZ0, BRIDGE_STEEL, { x: sx, y: DECK_Y - 0.3, z: (VZ0 + VZ1) / 2 }));
    for (let z = VZ0, i = 0; z < VZ1 - 0.2; z += 0.4, i++) {
      const lo = DECK_Y - 0.27;
      const hi = DECK_Y - 0.06;
      g.add(beam([sx, i % 2 ? hi : lo, z], [sx, i % 2 ? lo : hi, z + 0.4], 0.025, BRIDGE_STEEL));
    }
  }
  return g;
}

// ---------------------------------------------------------------------------
// CBD
// ---------------------------------------------------------------------------

interface Facade {
  body: THREE.MeshStandardMaterial;
  fin: THREE.MeshStandardMaterial;
  /** Punched masonry grid (deep piers) or glass curtain wall (thin mullions). */
  curtain: boolean;
}

const punched = (c: number, fin = c): Facade => ({ body: mat(c), fin: mat(fin), curtain: false });
const curtain = (c: number): Facade => ({ body: mat(c, { roughness: 0.18, metalness: 0.55 }), fin: mat(0xc9d2d8, { roughness: 0.5 }), curtain: true });

// Warm, weathered tones after the reference print rather than toy white.
const F_GREY = punched(0xa9a69f);
const F_CREAM = punched(0xe2d4b6);
const F_BEIGE = punched(0xcdb48a);
const F_BROWN = punched(0x7e6550, 0x5f4a3a);
const F_WHITE = punched(0xe6e3dc);
const F_BLUE = curtain(0x5b88ad);
const F_TEAL = curtain(0x6f9ea3);
const F_DARK = curtain(0x44586b);
const F_PALE = curtain(0xa9bfcc);
const LEDGE = mat(0xd9d9d4);

/**
 * Office tower. Each window band and each pier is one box wrapping the block,
 * so it shows on two opposite faces: a full facade grid for a few dozen boxes.
 * `top`: 0 roof plant, 1 setback crown, 2 roof plant with masts, 3 glass pyramid, 4 stepped Art-Deco, 5 wedge.
 */
function cbdTower(x: number, z: number, w: number, d: number, h: number, f: Facade, top = 0): THREE.Group {
  const g = group({ x, z });
  const fh = 0.27;
  g.add(box(w, h, d, f.body));
  g.add(box(w + 0.05, 0.34, d + 0.05, M.glassDark));
  const floors = Math.floor((h - 0.5) / fh);
  const winH = f.curtain ? fh * 0.62 : fh * 0.5;
  for (let i = 0; i < floors; i++) g.add(box(w + 0.02, winH, d + 0.02, windowMaterial, { y: 0.44 + i * fh + (fh - winH) / 2 }));
  const gridH = floors * fh + 0.08;
  const t = f.curtain ? 0.02 : 0.04;
  const pitch = f.curtain ? 0.24 : 0.16;
  const nx = Math.max(2, Math.round(w / pitch));
  const nz = Math.max(2, Math.round(d / pitch));
  // Interior piers only: an end pier would be a plate over the whole side face.
  for (let i = 1; i < nx; i++) g.add(box(t, gridH, d + 0.04, f.fin, { x: -w / 2 + (i * w) / nx, y: 0.4 }));
  for (let j = 1; j < nz; j++) g.add(box(w + 0.04, gridH, t, f.fin, { z: -d / 2 + (j * d) / nz, y: 0.4 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(t * 1.8, gridH, t * 1.8, f.fin, { x: (sx * w) / 2, z: (sz * d) / 2, y: 0.4 }));
  g.add(box(w + 0.04, 0.08, d + 0.04, f.fin, { y: h }));
  if (top === 1) {
    g.add(box(w * 0.72, 0.5, d * 0.72, f.body, { y: h + 0.08 }));
    g.add(box(w * 0.72 + 0.02, 0.18, d * 0.72 + 0.02, windowMaterial, { y: h + 0.22 }));
    g.add(box(w * 0.74, 0.05, d * 0.74, f.fin, { y: h + 0.58 }));
  } else if (top === 3) {
    // Glass pyramid crown with a thin spire.
    g.add(box(w * 0.8, 0.3, d * 0.8, f.body, { y: h + 0.08 }));
    g.add(hipRoof(w * 0.82, d * 0.82, 0.75, f.fin, { y: h + 0.38 }));
    g.add(cylinder(0.01, 0.022, 0.55, M.steel, { y: h + 1.1, segments: 4 }));
  } else if (top === 4) {
    // Art-Deco stepped crown topped by a flagpole.
    g.add(box(w * 0.82, 0.4, d * 0.82, f.body, { y: h + 0.08 }));
    g.add(box(w * 0.56, 0.4, d * 0.56, f.body, { y: h + 0.48 }));
    g.add(box(w * 0.3, 0.3, d * 0.3, f.fin, { y: h + 0.88 }));
    g.add(cylinder(0.008, 0.012, 0.6, M.steel, { y: h + 1.18, segments: 4 }));
  } else if (top === 5) {
    // Slanted wedge roof, rising toward +x.
    g.add(profile([[-w / 2, 0], [w / 2, 0], [w / 2, 0.75]], d, f.body, { y: h + 0.08 }));
    g.add(box(0.16, 0.1, 0.16, M.steel, { y: h + 0.08, x: -w * 0.3, z: d * 0.2 }));
  } else {
    g.add(box(w * 0.45, 0.22, d * 0.4, f.body, { y: h + 0.08, x: -w * 0.12 }));
    g.add(box(0.16, 0.1, 0.16, M.steel, { y: h + 0.08, x: w * 0.26, z: d * 0.22 }));
    if (top === 2) for (const s of [-1, 1]) g.add(cylinder(0.012, 0.025, 0.7, M.steel, { x: s * w * 0.18, z: -d * 0.1, y: h + 0.3, segments: 4 }));
  }
  return g;
}

/** Australia Square: round tower with vertical ribs and a deep crown band. */
function roundTower(x: number, z: number, r: number, h: number): THREE.Group {
  const g = group({ x, z });
  const wall = mat(0xe6e3dc);
  g.add(cylinder(r, r, h, wall, { segments: 24 }));
  g.add(cylinder(r + 0.04, r + 0.04, 0.34, M.glassDark, { segments: 24 }));
  const fh = 0.27;
  const floors = Math.floor((h - 0.85) / fh);
  for (let i = 0; i < floors; i++) g.add(cylinder(r + 0.012, r + 0.012, fh * 0.5, windowMaterial, { y: 0.44 + i * fh, segments: 24, open: true }));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    g.add(box(0.05, h - 0.9, 0.05, wall, { x: Math.sin(a) * (r + 0.02), z: Math.cos(a) * (r + 0.02), y: 0.4, ry: a }));
  }
  g.add(cylinder(r + 0.05, r + 0.05, 0.42, wall, { y: h - 0.42, segments: 24 }));
  g.add(cylinder(r * 0.55, r * 0.55, 0.26, M.concrete, { y: h, segments: 12 }));
  return g;
}

/** Sydney Tower on its Westfield podium: bronze shaft, guy cables, banded gold turret, spike. */
function sydneyTower(p: Place): THREE.Group {
  const g = group(p);
  g.add(building({ w: 1.8, d: 1.4, h: 0.9, wall: mat(0xdcd6ca), roof: 'flat', windows: 'bands', floorH: 0.4, plain: true, shop: 0xc8433a }));
  g.add(box(1.86, 0.06, 1.46, LEDGE, { y: 0.9 }));
  const shaft = mat(0x8c7558, { roughness: 0.5, metalness: 0.35 });
  g.add(cylinder(0.3, 0.34, 0.25, M.concrete, { y: 0.92, segments: 12 }));
  g.add(cylinder(0.11, 0.15, 7.6, shaft, { y: 1.0, segments: 10 }));
  for (const y of [3.4, 5.8]) g.add(cylinder(0.16, 0.16, 0.06, GOLD, { y, segments: 10 }));
  const cable = mat(0x4f565e, { roughness: 0.4, metalness: 0.5 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    g.add(beam([Math.cos(a) * 0.75, 0.95, Math.sin(a) * 0.6], [Math.cos(a) * 0.12, 7.9, Math.sin(a) * 0.12], 0.02, cable));
  }
  // Turret: a flared gold basket with two glazed observation rings; it stands
  // clear above every office tower, as in the skyline.
  const T0 = 8.35;
  g.add(lathe([
    [0.11, 0], [0.31, 0.11], [0.49, 0.29], [0.6, 0.44], [0.6, 0.53], [0.56, 0.55], [0.56, 0.64], [0.63, 0.66], [0.63, 0.75],
    [0.56, 0.77], [0.56, 0.86], [0.63, 0.88], [0.63, 0.97], [0.56, 0.99], [0.52, 1.08], [0.36, 1.17], [0.18, 1.21],
  ], GOLD, { y: T0, segments: 18 }));
  for (const y of [0.55, 0.77]) g.add(cylinder(0.565, 0.565, 0.09, windowMaterial, { y: T0 + y, segments: 18, open: true }));
  g.add(cylinder(0.15, 0.19, 0.32, mat(0xf1ead8), { y: T0 + 1.19, segments: 10 }));
  g.add(cylinder(0.022, 0.065, 1.9, M.steel, { y: T0 + 1.51, segments: 6 }));
  g.add(cylinder(0.05, 0.05, 0.1, BEACON, { y: T0 + 3.37, segments: 8 }));
  return g;
}

// ---------------------------------------------------------------------------
// Heritage: the Rocks, the sandstone clock hall, Walsh Bay
// ---------------------------------------------------------------------------

function clockFace(g: THREE.Group, x: number, y: number, z: number, ry: number): void {
  const f = group({ x, y, z, ry });
  const disc = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20);
  disc.rotateX(Math.PI / 2);
  addMesh(f, disc, M.white);
  f.add(box(0.025, 0.17, 0.025, M.dark, { y: -0.01, z: 0.02 }));
  const hand = box(0.025, 0.13, 0.025, M.dark, { y: -0.01, z: 0.02 });
  hand.rotation.z = -1.2;
  f.add(hand);
  g.add(f);
}

/** Sandstone courtyard hall with corner pavilions and a clock tower (after the GPO). */
function clockHall(p: Place): THREE.Group {
  const g = group(p);
  const W = 2.8;
  const D = 2.6;
  const H = 1.3;
  const wing = 0.72;
  const opts = { wall: SANDSTONE_WARM, trim: CREAM, roofMat: SLATE, roofH: 0.3, windows: 'grid' as const, floorH: 0.42 };
  for (const sz of [-1, 1]) g.add(building({ ...opts, w: W, d: wing, h: H, z: sz * (D / 2 - wing / 2), roof: 'mansard' }));
  for (const sx of [-1, 1]) g.add(building({ ...opts, w: wing, d: D - 2 * wing + 0.1, h: H, x: sx * (W / 2 - wing / 2), roof: 'mansard', plain: true }));
  g.add(box(W - 2 * wing, 0.04, D - 2 * wing, PAVING, { y: 0.02 }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(building({ ...opts, w: 0.86, d: 0.86, h: H + 0.3, x: sx * (W / 2 - 0.43), z: sz * (D / 2 - 0.43), roof: 'hip', roofH: 0.45, plain: true }));
  }
  // Clock tower on the north front.
  const tx = -0.3;
  const tz = D / 2 - 0.15;
  g.add(box(0.62, 2.7, 0.62, SANDSTONE_WARM, { x: tx, z: tz }));
  for (const y of [1.25, 1.8]) g.add(box(0.7, 0.06, 0.7, CREAM, { x: tx, z: tz, y }));
  clockFace(g, tx, 2.08, tz + 0.32, 0);
  clockFace(g, tx + 0.32, 2.08, tz, Math.PI / 2);
  // Cream louvred belfry: dark slits on every face, sandstone corner piers.
  g.add(box(0.64, 0.26, 0.64, CREAM, { x: tx, z: tz, y: 2.3 }));
  for (const o of [-0.09, 0.09]) for (const s of [-1, 1]) {
    g.add(box(0.06, 0.18, 0.02, M.dark, { x: tx + o, z: tz + s * 0.32, y: 2.34 }));
    g.add(box(0.02, 0.18, 0.06, M.dark, { x: tx + s * 0.32, z: tz + o, y: 2.34 }));
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.13, 0.26, 0.13, SANDSTONE_WARM, { x: tx + sx * 0.26, z: tz + sz * 0.26, y: 2.3 }));
  g.add(box(0.74, 0.08, 0.74, CREAM, { x: tx, z: tz, y: 2.56 }));
  g.add(box(0.42, 0.28, 0.42, SANDSTONE_WARM, { x: tx, z: tz, y: 2.64 }));
  g.add(dome(0.25, M.copper, { x: tx, z: tz, y: 2.92, squash: 1.3, segments: 12 }));
  g.add(cylinder(0.012, 0.02, 0.3, GOLD, { x: tx, z: tz, y: 3.24, segments: 4 }));
  return g;
}

function rocksHouse(x: number, z: number, w: number, d: number, h: number, wall: Mat, roof: 'hip' | 'gable' | 'mansard' | 'flat' = 'hip', roofMat: Mat = SLATE, ry = 0): THREE.Group {
  return building({ x, z, w, d, h, ry, wall, trim: CREAM, roof, roofMat, roofH: Math.min(w, d) * 0.35, windows: 'grid', floorH: 0.42 });
}

/** Luna Park's grinning face gate (Milsons Point): twin striped towers, a lit face, a ferris wheel stub behind. */
function lunaPark(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  const stripe = [mat(0xd93a3a), mat(0xf2ead3), mat(0x2f6fbf)];
  g.add(box(1.7, 0.12, 0.5, PAVING));
  for (const sx of [-0.7, 0.7]) {
    for (let i = 0; i < 6; i++) g.add(cylinder(0.13 - i * 0.008, 0.13 - i * 0.008, 0.16, stripe[i % 3], { x: sx, y: 0.12 + i * 0.16, segments: 8 }));
    g.add(cone(0.15, 0.3, stripe[0], { x: sx, y: 1.08, segments: 8 }));
  }
  // The face: pale gate with eyes and a wide lit grin between the towers.
  g.add(box(1.2, 0.7, 0.16, mat(0xf7e4b0), { y: 0.12 }));
  for (const sx of [-0.28, 0.28]) g.add(box(0.2, 0.2, 0.04, mat(0x2f6fbf), { x: sx, y: 0.55, z: 0.09 }));
  g.add(box(0.7, 0.12, 0.04, lampMaterial, { y: 0.24, z: 0.09 }));
  g.add(box(1.3, 0.08, 0.2, stripe[0], { y: 0.82 }));
  for (let i = 0; i < 6; i++) g.add(box(0.06, 0.06, 0.06, lampMaterial, { x: -0.55 + i * 0.22, y: 0.9, z: 0.1 }));
  // Ferris wheel behind the gate: a ring on an A-frame.
  const ring = Array.from({ length: 17 }, (_, i) => new THREE.Vector3(Math.cos((i / 16) * Math.PI * 2) * 0.42, 0.95 + Math.sin((i / 16) * Math.PI * 2) * 0.42, -0.35));
  g.add(tube(ring, 0.014, stripe[2], { segments: 24 }));
  for (const sx of [-0.2, 0.2]) g.add(beam([sx, 0.12, -0.35], [0, 0.95, -0.35], 0.02, stripe[1]));
  return g;
}

/** Fort Denison: squat sandstone island fort with a round Martello tower and a lantern. */
function fortDenison(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  g.add(cylinder(0.52, 0.56, 0.2, SEAWALL, { y: 0.04, segments: 14 }));
  g.add(cylinder(0.4, 0.46, 0.34, SANDSTONE, { y: 0.24, segments: 14 }));
  g.add(cylinder(0.43, 0.43, 0.05, SANDSTONE_WARM, { y: 0.58, segments: 14 }));
  g.add(cylinder(0.26, 0.3, 0.3, SANDSTONE_WARM, { y: 0.63, segments: 12 }));
  g.add(cone(0.32, 0.16, SLATE, { y: 0.93, segments: 12 }));
  g.add(cylinder(0.04, 0.04, 0.12, lampMaterial, { y: 1.09, segments: 6 }));
  return g;
}

/** Overseas Passenger Terminal: long low glazed shed under a deep roof. */
function terminal(p: Place): THREE.Group {
  const g = group(p);
  g.add(box(3.0, 0.5, 0.6, mat(0xe3e6e8)));
  g.add(box(2.9, 0.2, 0.62, windowMaterial, { y: 0.16 }));
  g.add(box(3.2, 0.06, 0.82, mat(0x9aa7af), { y: 0.5 }));
  for (let i = 0; i < 4; i++) g.add(box(0.5, 0.18, 0.4, mat(0xc4ccd1), { x: -1.1 + i * 0.75, y: 0.56 }));
  return g;
}

// ---------------------------------------------------------------------------
// Circular Quay
// ---------------------------------------------------------------------------

const STATION = mat(0x8e9397);
const STATION_DARK = mat(0x5d636b);
const SILVER = mat(0xc9ced3, { roughness: 0.4, metalness: 0.4 });
const TRAIN_STRIPE = mat(0xe8b53a);

/** Train of `n` cars along local z, centred on the origin. */
function train(n: number, len: number): THREE.Group {
  const g = group();
  const pitch = len + 0.04;
  for (let i = 0; i < n; i++) {
    const z = (i - (n - 1) / 2) * pitch;
    g.add(box(0.24, 0.2, len, SILVER, { y: 0.02, z }));
    g.add(box(0.245, 0.06, len * 0.9, windowMaterial, { y: 0.12, z }));
    g.add(box(0.245, 0.03, len * 0.94, TRAIN_STRIPE, { y: 0.06, z }));
    g.add(box(0.2, 0.03, len * 0.96, STATION_DARK, { y: 0.22, z }));
  }
  return g;
}

/** Finger wharf with a canopy, reaching north from the quay into the cove. */
function wharf(x: number, z: number): THREE.Group {
  const g = group({ x, z });
  g.add(box(0.32, 0.08, 1.4, TIMBER, { y: 0.02, z: 0.7 }));
  for (const sz of [0.25, 0.75, 1.25]) for (const sx of [-0.13, 0.13]) g.add(box(0.03, 0.34, 0.03, STATION_DARK, { x: sx, y: 0.1, z: sz }));
  g.add(box(0.4, 0.04, 1.2, mat(0x8fa39a, { roughness: 0.5 }), { y: 0.42, z: 0.75 }));
  g.add(box(0.18, 0.22, 0.6, windowMaterial, { y: 0.1, z: 0.45 }));
  return g;
}

/** Circular Quay station: glazed concourse under a rail viaduct, with a train at the platform. */
function quayStation(x1: number, x2: number, z: number): THREE.Group {
  const len = x2 - x1;
  const g = group({ x: (x1 + x2) / 2, z });
  const D = 0.7;
  g.add(box(len - 0.1, 0.42, D - 0.18, windowMaterial));
  for (let x = -len / 2 + 0.1; x <= len / 2 - 0.05; x += 0.45) for (const s of [-1, 1]) g.add(box(0.07, 0.48, 0.07, STATION, { x, z: s * (D / 2 - 0.05) }));
  g.add(box(len, 0.08, D + 0.04, STATION_DARK, { y: 0.42 }));
  g.add(box(len, 0.08, D, STATION, { y: 0.5 }));
  g.add(box(len, 0.02, 0.36, BALLAST, { y: 0.58, z: 0.08 }));
  for (const sz of [-1, 1]) g.add(box(len, 0.1, 0.04, STATION, { y: 0.58, z: sz * (D / 2 - 0.02) }));
  const t = train(4, 0.8);
  t.position.set(0, 0.6, 0.08);
  t.rotation.y = Math.PI / 2;
  g.add(t);
  // Platform canopy on slim posts.
  for (let x = -len / 2 + 0.3; x < len / 2; x += 0.9) g.add(box(0.04, 0.34, 0.04, STATION_DARK, { x, y: 0.58, z: -0.24 }));
  g.add(box(len - 0.2, 0.03, 0.34, mat(0x9fb0a8, { roughness: 0.5 }), { y: 0.92, z: -0.12 }));
  return g;
}

// ---------------------------------------------------------------------------
// Boats
// ---------------------------------------------------------------------------

const FERRY_GREEN = mat(0x2e6b4a, { roughness: 0.5 });
const FERRY_CREAM = mat(0xf2ead3, { roughness: 0.6 });
const FERRY_GOLD = mat(0xe2b23c, { roughness: 0.5 });

/** First Fleet-style ferry: green hull, cream cabin with a gold roof, along local z. */
function ferry(p: Place & { len?: number } = {}): THREE.Group {
  const g = group(p);
  const l = p.len ?? 0.8;
  g.add(profile([[-l / 2, 0.07], [l / 2, 0.07], [l / 2 - 0.07, -0.02], [-l / 2 + 0.07, -0.02]], 0.28, FERRY_GREEN, { ry: Math.PI / 2 }));
  g.add(box(0.29, 0.025, l * 0.96, FERRY_CREAM, { y: 0.07 }));
  g.add(box(0.24, 0.12, l * 0.7, FERRY_CREAM, { y: 0.095 }));
  g.add(box(0.245, 0.05, l * 0.66, windowMaterial, { y: 0.13 }));
  g.add(box(0.27, 0.02, l * 0.74, FERRY_GOLD, { y: 0.215 }));
  g.add(box(0.15, 0.07, 0.15, FERRY_CREAM, { y: 0.235 }));
  g.add(box(0.155, 0.03, 0.155, windowMaterial, { y: 0.26 }));
  mergeStatic(g);
  return g;
}

function sailboat(p: Place): THREE.Group {
  const g = group(p);
  g.add(boat({ len: 0.5, color: 0xf4f4f0 }));
  g.add(cylinder(0.008, 0.008, 0.56, M.dark, { y: 0.06, segments: 3 }));
  g.add(profile([[-0.18, 0], [0.16, 0], [-0.17, 0.48]], 0.01, M.white, { y: 0.12, ry: Math.PI / 2 }));
  return g;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const BRIDGE_X = 4.0;

// Shorelines (control points, smoothed). The plinth edges close the harbour.
const NORTH_SHORE = smooth([[1.4, 9.8], [1.9, 8.4], [2.8, 7.5], [4.2, 7.3], [5.6, 7.5], [7.2, 7.9], [8.6, 7.6], [9.8, 7.2]]);
const SOUTH_SHORE = smooth([[9.8, -5.0], [7.6, -5.0], [6.3, -4.4], [6.0, -2.4], [5.3, -1.4], [3.6, -1.1], [1.8, -0.6], [0.3, -0.2], [-0.5, -0.8], [-0.65, -1.9]]);
const QUAY: P2[] = [[-0.65, -1.9], [-3.6, -1.9], [-3.6, 2.8]];
const OPERA_EAST = smooth([[-3.6, 2.8], [-3.5, 3.4], [-3.4, 3.9]]);
const FARM_COVE = smooth([[-3.4, 6.8], [-3.7, 7.3], [-4.3, 7.7], [-4.7, 8.5], [-4.9, 9.8]]);

// The garden holds the left corner; the CBD runs from the back edge right up
// to the garden road, with Sydney Tower at its front-left as in the reference.
const GARDEN_ROAD_Z = 4.7;
const GARDEN: P2[] = [[-9.8, 5.05], [-4.85, 5.05], [-4.85, 7.0], [-5.0, 8.2], [-5.25, 9.8], [-9.8, 9.8]];
const GARDEN_PATHS: P2[][] = [
  [[-9.5, 9.5], [-7.8, 7.8], [-6.2, 7.3], [-5.3, 5.2]],
  [[-9.6, 6.3], [-7.8, 7.8]],
  [[-8.6, 5.15], [-7.6, 6.4], [-6.2, 7.3]],
];
const POND = { x: -6.7, z: 8.8, rx: 0.6, rz: 0.4 };

const CBD: [number, number, number, number, number, Facade, number][] = [
  // Back blocks: the tallest towers.
  [-9.0, -9.0, 1.1, 1.1, 6.4, F_GREY, 2],
  [-7.25, -9.05, 1.0, 1.0, 7.2, F_PALE, 3],
  [-9.05, -7.6, 0.9, 0.9, 4.2, F_BEIGE, 4],
  [-7.3, -7.6, 1.0, 0.9, 5.2, F_DARK, 3],
  [-4.9, -9.0, 1.2, 1.2, 7.0, F_DARK, 2],
  [-3.15, -9.0, 1.1, 1.1, 5.6, F_CREAM, 5],
  [-4.9, -7.6, 1.0, 0.9, 4.0, F_BLUE, 0],
  [-3.15, -7.6, 1.0, 0.9, 3.2, F_GREY, 4],
  // Middle blocks.
  [-9.0, -5.1, 1.0, 1.3, 5.8, F_CREAM, 1],
  [-7.25, -5.1, 1.1, 1.3, 4.4, F_TEAL, 0],
  [-3.1, -5.1, 1.0, 1.4, 4.8, F_BLUE, 1],
  [-9.05, -2.4, 1.0, 1.1, 6.2, F_BLUE, 5],
  [-7.25, -2.5, 1.0, 1.1, 5.0, F_GREY, 1],
  [-5.1, -2.5, 1.0, 1.1, 5.4, F_BLUE, 3],
  [-5.1, -0.4, 1.0, 1.0, 3.8, F_WHITE, 4],
  [-6.9, 0.5, 0.9, 1.0, 3.6, F_BEIGE, 5],
  // Front blocks on the garden road.
  [-8.6, 3.15, 1.2, 1.2, 6.6, F_GREY, 2],
  [-6.95, 3.2, 1.0, 1.1, 5.4, F_BROWN, 2],
  [-5.25, 3.2, 0.8, 1.2, 4.4, F_WHITE, 3],
];

export default function build(): CityScene {
  const rand = rng(33);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: mat(0xd6d3cb, { roughness: 0.9 }), side: mat(0xd8b98a) }));

  // Harbour: one polygon bounded by the plinth edges and the shorelines. The
  // straight run under the Opera House podium is hidden by the podium.
  const outline: P2[] = [[-4.9, 9.8], ...NORTH_SHORE, ...SOUTH_SHORE, ...QUAY, ...OPERA_EAST, ...FARM_COVE];
  const water = outline.filter((p, i) => i === 0 || Math.hypot(p[0] - outline[i - 1][0], p[1] - outline[i - 1][1]) > 1e-4);
  if (Math.hypot(water[0][0] - water[water.length - 1][0], water[0][1] - water[water.length - 1][1]) < 1e-4) water.pop();
  root.add(area(water, WATER, { h: 0.05 }));
  for (const line of [NORTH_SHORE, SOUTH_SHORE, QUAY, OPERA_EAST, FARM_COVE]) root.add(seawall(line));

  // Royal Botanic Garden: lawns, winding paths, a pond, dense tree clumps.
  root.add(area(GARDEN, LAWN, { h: 0.06 }));
  for (const path of GARDEN_PATHS) {
    for (let i = 1; i < path.length; i++) {
      const r = road(path[i - 1][0], path[i - 1][1], path[i][0], path[i][1], 0.26, { lines: false, material: PATH });
      r.position.y = 0.025;
      root.add(r);
    }
    for (const [x, z] of path) root.add(cylinder(0.13, 0.13, 0.06, PATH, { x, z, y: 0.02, segments: 10 }));
  }
  const pond: P2[] = Array.from({ length: 18 }, (_, i) => {
    const a = (i / 18) * Math.PI * 2;
    return [POND.x + Math.cos(a) * POND.rx, POND.z + Math.sin(a) * POND.rz];
  });
  root.add(area(pond.map(([x, z]) => [POND.x + (x - POND.x) * 1.15, POND.z + (z - POND.z) * 1.2] as P2), PATH, { h: 0.07 }));
  root.add(area(pond, WATER, { h: 0.08 }));
  const segs = GARDEN_PATHS.flatMap((p) => p.slice(1).map((b, i) => [p[i], b] as const));
  let planted = 0;
  for (let i = 0; i < 140 && planted < 34; i++) {
    const x = -9.5 + rand() * 4.5;
    const z = 5.75 + rand() * 3.8;
    if (x > -4.95 - Math.max(0, z - 7.2) * 0.12) continue;
    // Keep trees off the paths and out of the pond.
    if (segs.some(([a, b]) => distToSegment(x, z, a, b) < 0.32)) continue;
    if (((x - POND.x) / (POND.rx + 0.32)) ** 2 + ((z - POND.z) / (POND.rz + 0.32)) ** 2 < 1) continue;
    root.add(tree({ x, z, s: 0.75 + rand() * 0.45, kind: rand() < 0.12 ? 'cone' : 'round' }));
    planted++;
  }
  for (const [x, z] of [[-5.15, 8.6], [-5.3, 9.35], [-4.95, 7.6]] as P2[]) root.add(tree({ x, z, s: 1.0, kind: 'cone' }));
  for (let i = 0; i < 10; i++) {
    const [a, b] = segs[i % segs.length];
    const k = rand();
    root.add(aussie(a[0] + (b[0] - a[0]) * k + 0.08, 0.075, a[1] + (b[1] - a[1]) * k, i));
  }

  // Opera House on Bennelong Point; forecourt between garden and Circular Quay.
  root.add(patch(1.2, 5.0, PAVING, { x: -4.15, z: 4.9, h: 0.055 }));
  for (const [x, z] of [[-4.6, 3.0], [-4.6, 3.7], [-4.6, 6.9], [-4.65, 7.5]] as P2[]) root.add(tree({ x, z, s: 0.8, kind: 'palm' }));
  const nearPalm = (x: number, z: number) => [[-4.6, 3.7], [-4.6, 6.9]].some(([px, pz]) => Math.hypot(x - px, z - pz) < 0.45);
  root.add(scatter({ x: -4.6, z: 5.3, w: 0.2, d: 2.6 }, 6, rand, (x, z, i) => aussie(x, 0.055, z, i + 1), nearPalm));
  const opera = operaHouse({ x: -0.4, z: 5.3, ry: Math.PI / 2 });
  opera.scale.setScalar(0.88);
  root.add(opera);

  // Circular Quay: promenade, finger wharves, station viaduct, Opera Quays.
  root.add(patch(4.0, 0.7, PAVING, { x: -2.4, z: -2.25, h: 0.05 }));
  for (const x of [-3.2, -2.45, -1.7, -0.95]) root.add(wharf(x, -1.9));
  root.add(ferry({ x: -2.83, y: 0.04, z: -1.05 }));
  root.add(ferry({ x: -1.33, y: 0.04, z: -0.95 }));
  root.add(quayStation(-4.4, -0.8, -3.0));
  root.add(building({ x: -4.2, z: 0.3, w: 0.6, d: 2.8, h: 1.0, wall: CREAM, trim: mat(0xcfc6b4), roof: 'flat', windows: 'bands', floorH: 0.32 }));
  root.add(row(-4.2, -2.45, -1.0, -2.45, 5, (x, z) => lamp({ x, z, y: 0.05 })));
  root.add(scatter({ x: -2.4, z: -2.05, w: 3.4, d: 0.1 }, 7, rand, (x, z, i) => aussie(x, 0.05, z, i)));
  // Promenade strollers: slow loops along the quay, clear of the lamp row and the wharf decks.
  const quayWalk: P2[] = [[-3.9, -2.3], [-0.9, -2.3], [-0.9, -2.22], [-3.9, -2.22]];
  for (let i = 0; i < 3; i++) root.add(anim.follow(aussie(0, 0.05, 0, i + 2), quayWalk, 0.22, i / 3, true));

  // CBD streets.
  root.add(road(-9.8, GARDEN_ROAD_Z, -4.85, GARDEN_ROAD_Z, 0.6, { lines: false, material: STREET }));
  root.add(road(-6.0, -9.8, -6.0, GARDEN_ROAD_Z - 0.3, 0.6, { lines: false, material: STREET }));
  root.add(road(-9.8, 1.6, -4.55, 1.6, 0.5, { lines: false, material: STREET }));
  root.add(road(-9.8, -3.6, -2.0, -3.6, 0.6, { lines: false, material: STREET }));
  root.add(road(-9.8, -6.6, 2.9, -6.6, 0.6, { lines: false, material: STREET }));
  root.add(road(-2.0, -9.8, -2.0, -3.3, 0.6, { lines: false, material: STREET }));
  root.add(crosswalk(-6.0, 4.05, 0.6));
  root.add(crosswalk(-7.2, GARDEN_ROAD_Z, 0.6, { ry: Math.PI / 2 }));
  root.add(crosswalk(-2.0, -6.0, 0.6));
  root.add(row(-9.4, 4.28, -6.5, 4.28, 4, (x, z) => lamp({ x, z })));
  for (const x of [-9.2, -7.9, -7.0, -5.9]) root.add(tree({ x, z: 5.35, s: 0.6 }));

  // CBD towers, Sydney Tower and Australia Square.
  for (const [x, z, w, d, h, f, top] of CBD) root.add(cbdTower(x, z, w, d, h, f, top));
  root.add(sydneyTower({ x: -8.3, z: 0.4 }));
  root.add(roundTower(-4.75, -5.1, 0.72, 6.4));
  root.add(building({ x: -5.1, z: 0.75, w: 1.0, d: 0.8, h: 1.3, wall: mat(0xcdb48e), trim: CREAM, roof: 'flat', shop: 0x3d6fb6 }));

  // The Rocks: sandstone terraces and stores between the quay and the bridge.
  root.add(rocksHouse(0.3, -2.6, 1.1, 1.3, 1.0, SANDSTONE));
  root.add(rocksHouse(1.5, -1.65, 1.2, 0.7, 0.75, SANDSTONE, 'gable', TERRA));
  root.add(rocksHouse(1.5, -2.95, 1.0, 0.8, 1.2, BRICK, 'gable'));
  root.add(rocksHouse(-1.0, -5.3, 1.2, 1.6, 1.3, BRICK, 'mansard'));
  root.add(rocksHouse(0.4, -4.95, 1.2, 1.0, 1.0, SANDSTONE));
  root.add(rocksHouse(1.8, -5.15, 1.4, 1.4, 1.4, SANDSTONE, 'flat'));
  root.add(rocksHouse(0.45, -5.95, 1.0, 0.6, 0.8, CREAM, 'hip', TERRA));
  root.add(road(-1.7, -4.0, 2.9, -4.0, 0.4, { lines: false, material: M.cobble }));
  root.add(scatter({ x: 0.6, z: -4.0, w: 3.6, d: 0.25 }, 4, rand, (x, z, i) => aussie(x, 0.05, z, i + 3)));
  root.add(scatter({ x: 1.0, z: -1.0, w: 1.6, d: 0.3 }, 3, rand, (x, z, i) => aussie(x, 0, z, i + 5)));

  // Observatory park and the sandstone clock hall at the back.
  root.add(patch(1.5, 2.4, LAWN, { x: -0.9, z: -8.35, h: 0.06 }));
  const trees: P2[] = [];
  root.add(scatter({ x: -0.9, z: -8.35, w: 1.1, d: 2.0 }, 5, rand, (x, z) => (trees.push([x, z]), tree({ x, z, s: 0.85 }))));
  root.add(scatter({ x: -0.9, z: -8.35, w: 1.1, d: 2.0 }, 3, rand, (x, z, i) => aussie(x, 0.06, z, i + 1), (x, z) => trees.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.35)));
  root.add(clockHall({ x: 1.4, z: -8.3 }));

  // Harbour Bridge with its approach viaduct; lawns under and beside it.
  root.add(area([[3, -9.7], [6.2, -9.7], [6.2, -3.5], [6.1, -3.4], [6.05, -2.4], [5.3, -1.45], [3.6, -1.15], [2.8, -0.95], [2.8, -3.4], [3, -3.4]], LAWN, { h: 0.06 }));
  root.add(row(5.6, -9.3, 5.6, -3.8, 5, (x, z) => tree({ x, z, s: 0.75 })));
  for (const [x, z, s] of [[5.65, -1.8, 0.7], [2.4, -1.35, 0.7], [4.0, -1.5, 0.55]]) root.add(tree({ x, z, s }));
  root.add(harbourBridge(BRIDGE_X));

  // Walsh Bay warehouses (gabled and hipped, not four flat boxes) and the Overseas Passenger Terminal.
  root.add(rocksHouse(7.1, -8.8, 1.5, 1.4, 1.2, BRICK, 'gable', SLATE, Math.PI / 2));
  root.add(rocksHouse(8.85, -8.8, 1.4, 1.4, 1.0, SANDSTONE, 'hip', TERRA));
  root.add(rocksHouse(7.1, -7.15, 1.5, 1.1, 0.9, SANDSTONE, 'gable', TERRA));
  root.add(rocksHouse(8.85, -7.15, 1.4, 1.1, 1.1, BRICK, 'gable', SLATE, Math.PI / 2));
  root.add(terminal({ x: 8.0, z: -5.9 }));
  root.add(patch(3.4, 0.5, PAVING, { x: 8.0, z: -5.3, h: 0.05 }));
  root.add(scatter({ x: 8.0, z: -5.3, w: 3.0, d: 0.3 }, 6, rand, (x, z, i) => aussie(x, 0.05, z, i + 2, i % 3 === 0)));
  const liner = boat({ len: 1.5, color: 0xf4f4f0 });
  liner.position.set(8.0, 0.04, -4.72);
  liner.rotation.y = Math.PI / 2;
  root.add(liner);

  // North Shore (Kirribilli / Milsons Point): a Luna Park face between low
  // apartment blocks and varied-roof houses, a ferry wharf, and Fort Denison
  // out in the harbour.
  root.add(area([...NORTH_SHORE, [9.8, 9.8]], LAWN, { h: 0.06 }));
  root.add(lunaPark(4.9, 8.65));
  root.add(building({ x: 3.2, z: 9.1, w: 0.8, d: 0.8, h: 1.0, wall: CREAM, trim: mat(0xcfc6b4), roof: 'flat', windows: 'bands', floorH: 0.32 }));
  root.add(building({ x: 6.3, z: 9.0, w: 0.9, d: 0.7, h: 1.3, wall: mat(0xc9b08a), trim: CREAM, roof: 'flat', windows: 'grid', floorH: 0.34, shop: 0xc8433a }));
  root.add(rocksHouse(7.55, 8.95, 1.3, 0.7, 0.8, SANDSTONE, 'gable', TERRA));
  root.add(rocksHouse(8.95, 8.95, 1.1, 0.7, 0.95, BRICK, 'mansard'));
  root.add(rocksHouse(8.95, 9.55, 0.9, 0.4, 0.6, CREAM, 'hip', TERRA));
  root.add(row(1.9, 9.35, 2.5, 9.4, 2, (x, z) => tree({ x, z, s: 0.7 })));
  root.add(row(6.2, 8.15, 9.4, 8.15, 4, (x, z) => tree({ x, z, s: 0.7 })));
  root.add(scatter({ x: 6.9, z: 9.5, w: 1.4, d: 0.1 }, 3, rand, (x, z, i) => aussie(x, 0.06, z, i + 4)));
  root.add(box(0.14, 0.05, 1.3, TIMBER, { x: 7.6, z: 7.2, y: 0.03 }));
  for (const [x, z] of [[7.33, 6.85], [7.87, 7.0], [7.33, 7.35]] as P2[]) root.add(sailboat({ x, y: 0.04, z, ry: 0 }));
  // Kirribilli ferry wharf: the finger wharf turned to reach south into the harbour, with a ferry alongside.
  const kirribilli = wharf(5.2, 7.6);
  kirribilli.rotation.y = Math.PI;
  kirribilli.scale.z = 0.6;
  root.add(kirribilli);
  root.add(ferry({ x: 5.62, y: 0.04, z: 7.0 }));
  root.add(fortDenison(0.3, 8.2));

  // Water traffic: ferries between the quay and the harbour, cruise boats past the bridge.
  const ferryLoop: P2[] = [[-2.2, 1.0], [-0.6, 2.4], [2.8, 2.5], [6.4, 1.3], [8.9, 1.9], [9.0, 3.0], [6.5, 2.6], [2.8, 3.0], [-0.8, 2.95], [-2.6, 2.2]];
  for (let i = 0; i < 2; i++) root.add(anim.follow(ferry({ y: 0.04 }), ferryLoop, 0.55, i / 2, true));
  for (let i = 0; i < 2; i++) root.add(anim.follow(boat({ y: 0.04, len: 0.85, color: 0xf4f4f0 }), ferryLoop, 0.55, i / 2 + 0.25, true));
  const cruiseLoop: P2[] = [[5.4, 4.2], [8.6, 3.8], [9.0, 5.4], [7.6, 6.0], [4.8, 6.2], [3.4, 5.2]];
  root.add(anim.follow(boat({ y: 0.04, len: 0.9, color: 0xf4f4f0 }), cruiseLoop, 0.45, 0, true));
  root.add(anim.follow(boat({ y: 0.04, len: 0.6, color: 0xe0b43a }), cruiseLoop, 0.45, 0.5, true));
  for (const [x, z] of [[0.8, 8.6], [-2.6, 8.9], [6.4, 4.9], [1.4, 1.0]] as P2[]) {
    root.add(anim.bob(sailboat({ x, y: 0.04, z, ry: rand() * 6 }), 0.015, 1.3));
  }

  // Bridge traffic: cars on the roadway, a train shuttling across.
  const lane = (o: number) => BRIDGE_X + o;
  for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: ROAD_Y }), [[lane(-0.7), -9.5], [lane(-0.7), 9.5]], 1.2, i / 3));
  for (let i = 0; i < 2; i++) root.add(anim.follow(car({ y: ROAD_Y }), [[lane(-0.2), 9.5], [lane(-0.2), -9.5]], 1.2, i / 2 + 0.17));
  const tr = train(3, 0.8);
  mergeStatic(tr);
  tr.position.set(lane(0.68), RAIL_Y, 0);
  tr.userData.dynamic = true;
  const ease = (k: number) => 0.5 - 0.5 * Math.cos(Math.PI * k);
  anim.add((t) => {
    // 34 s cycle: dwell, eased run north, dwell, eased run south.
    const u = t % 34;
    const s = u < 4 ? 0 : u < 17 ? ease((u - 4) / 13) : u < 21 ? 1 : 1 - ease((u - 21) / 13);
    tr.position.z = -8.3 + 16.6 * s;
  });
  root.add(tr);

  // CBD traffic.
  const [southLane, northLane] = [GARDEN_ROAD_Z - 0.15, GARDEN_ROAD_Z + 0.15];
  for (let i = 0; i < 2; i++) root.add(anim.follow(car({ y: 0.05 }), [[-9.5, southLane], [-6.15, southLane], [-6.15, -9.5]], 1.0, i / 2));
  for (let i = 0; i < 2; i++) root.add(anim.follow(car({ y: 0.05 }), [[-5.85, -9.5], [-5.85, northLane], [-9.5, northLane]], 1.0, i / 2 + 0.25));
  root.add(anim.follow(car({ y: 0.05, taxi: true }), [[-9.5, -3.75], [-2.2, -3.75]], 1.0, 0));

  return { root, update: anim.update };
}
