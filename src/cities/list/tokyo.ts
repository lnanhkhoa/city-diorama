import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  Animator, M, beam, bench, boat, box, building, car, cone, createBase, crosswalk, cylinder, floodMat, group, lamp, lampMaterial, lathe, mat, mergeStatic,
  patch, person, prism, profile, rng, road, row, scatter, sphere, tower, tree, tube, waterMat, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';

const VERMILION = mat(0xd9442b, { roughness: 0.6 });
/** Senso-ji timber (gate, hall, pagoda, shrine): plain vermilion by day, floodlit at night like the real temple. */
const TEMPLE_RED = floodMat(0xd9442b, 0xff6a3a, 0.9, { roughness: 0.6 });
const TEMPLE_ROOF = mat(0x4b5057, { roughness: 0.7 });
// Towers are floodlit at night: Tokyo Tower in orange/warm white, Skytree in blue-white.
const TOWER_ORANGE = floodMat(0xea5a2c, 0xff7a2a, 1.1, { roughness: 0.5 });
const TOWER_WHITE = floodMat(0xf7f4ee, 0xffc890, 0.7, { roughness: 0.5 });
// Skytree's own "Skytree white" has a faint blue-grey cast; pure white vanished against the pale sky by day.
const SKY_WHITE = floodMat(0xd5e0e8, 0x78c8ff, 0.85, { roughness: 0.45 });
/** Red chochin paper lanterns (Kaminarimon, Nakamise, hall): plain by day, lit at night. */
const LANTERN = floodMat(0xe0382a, 0xff4a22, 2.6, { roughness: 0.4 });
const AWNINGS = [0xc8433a, 0x2f6fb6, 0xe0b43a, 0x3f9a6a, 0x8a4fb0, 0xf08a3a];

/** Pre-merge a multi-mesh mover so it costs one draw call per material. */
function pm<T extends THREE.Object3D>(o: T): T {
  mergeStatic(o);
  return o;
}
const NEON = [0xff4f8b, 0x2fd0ff, 0xffd23f, 0x7cff6b, 0xff7a2f, 0xb56cff];
/** Office-crowd coats: charcoal, navy, black, white shirt, beige trench, plus muted pastels. */
const COATS = [0x2b2f38, 0x1f2f55, 0xf0eee8, 0x1a1a1e, 0xc8b08a, 0x6b7078, 0xb8a9c9, 0x9fb7cf, 0x232a3d, 0x9fb8a8, 0xe0b4b4];
/** Clear vinyl, black, navy and a pastel umbrella. */
const BROLLIES = [0xdfe9ef, 0x23262c, 0x1f2f55, 0xb8a9c9];
function tokyoite(x: number, z: number, i: number, ry?: number, wet = false) {
  const col = COATS[(i * 5 + 2) % COATS.length];
  return person({ x, y: 0.04, z, ry, color: col, umbrella: wet ? BROLLIES[i % BROLLIES.length] : undefined });
}
const WALLS = [0xe8e2dc, 0xcfd6dd, 0xd9c9c0, 0xb8c4cf, 0xe6d9d0, 0xdcdad2, 0xc3ccd6];
const ROAD = mat(0x464b53, { roughness: 0.95 });

type Mat = THREE.Material;

/**
 * Billboard facing +z: the ad colour lit by the sun by day and glowing at night (no pastel day glow),
 * with a white headline, a sub-line and a dark logo block printed on it.
 */
function adBoard(w: number, h: number, c: number, p: Place = {}): THREE.Group {
  const g = group(p);
  g.add(box(w, h, 0.04, floodMat(c, c, 1.2, { roughness: 0.4 }), { z: -0.02 }));
  g.add(box(w * 0.7, h * 0.14, 0.01, M.white, { x: -w * 0.08, y: h * 0.62, z: 0.005 }));
  g.add(box(w * 0.45, h * 0.07, 0.01, M.white, { x: -w * 0.2, y: h * 0.42, z: 0.005 }));
  g.add(box(Math.min(w, h) * 0.22, Math.min(w, h) * 0.22, 0.01, M.dark, { x: w * 0.3, y: h * 0.12, z: 0.005 }));
  return g;
}

/**
 * Japanese temple roof: concave slopes (flat at the eave, steep at the ridge), a hip at each end and
 * eaves that sweep up and out toward the corners, with a soffit and fascia so it has thickness.
 * Ridge runs along X (`ridge` long, default `w - d`; 0 gives a pyramid). `y` is the mid-eave underside.
 */
function templeRoof(w: number, d: number, h: number, material: Mat, p: Place & { ridge?: number; kick?: number; t?: number } = {}): THREE.Mesh {
  const rl = p.ridge ?? Math.max(0, w - d);
  const kick = p.kick ?? h * 0.15;
  const t = p.t ?? Math.min(w, d) * 0.03;
  const S = 8;
  const V = 6;
  // Eave perimeter, counter-clockwise from above; `e` is 0 mid-edge and 1 at a corner.
  const ring: [number, number, number][] = [];
  const corners: [number, number][] = [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2], [-w / 2, -d / 2]];
  for (let c = 0; c < 4; c++) {
    const [ax, az] = corners[c];
    const [bx, bz] = corners[(c + 1) % 4];
    for (let s = 0; s < S; s++) {
      const u = s / S;
      ring.push([ax + (bx - ax) * u, az + (bz - az) * u, Math.abs(2 * u - 1) ** 3]);
    }
  }
  const n = ring.length;
  const at = (i: number, v: number, dy: number): [number, number, number] => {
    const [x, z, e] = ring[i % n];
    const flare = 1 + 0.05 * e * (1 - v);
    const qx = (x / (w / 2)) * (rl / 2);
    return [x * flare + (qx - x * flare) * v, h * v ** 1.6 + kick * e * (1 - v) ** 2 + dy, z * flare * (1 - v)];
  };
  const pos: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < V; j++) {
      const a = at(i, j / V, 0), b = at(i + 1, j / V, 0), c = at(i + 1, (j + 1) / V, 0), dd = at(i, (j + 1) / V, 0);
      tri(a, b, c);
      tri(a, c, dd);
    }
    // Soffit under the overhang (the rest is hidden by the walls), then the fascia joining it to the eave.
    for (const [v0, v1] of [[0, 0.15], [0.15, 0.3]]) {
      const a = at(i, v0, -t), b = at(i + 1, v0, -t), c = at(i + 1, v1, -t), dd = at(i, v1, -t);
      tri(a, c, b);
      tri(a, dd, c);
    }
    const t0 = at(i, 0, 0), t1 = at(i + 1, 0, 0), u0 = at(i, 0, -t), u1 = at(i + 1, 0, -t);
    tri(t0, u0, u1);
    tri(t0, u1, t1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.translate(0, t, 0);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  m.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  m.rotation.y = p.ry ?? 0;
  return m;
}

/** Lattice mast: `n` legs, rings at each level (radius `r`), X-bracing between rings. */
function lattice(g: THREE.Group, n: number, off: number, levels: { y: number; r: number }[], t: number, mats: Mat[]) {
  const pt = (r: number, y: number, i: number): [number, number, number] => {
    const a = off + (i * Math.PI * 2) / n;
    return [r * Math.cos(a), y, r * Math.sin(a)];
  };
  for (let k = 0; k < levels.length - 1; k++) {
    const a = levels[k];
    const b = levels[k + 1];
    const m = mats[k % mats.length];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      g.add(beam(pt(a.r, a.y, i), pt(b.r, b.y, i), t * 1.5, m));
      g.add(beam(pt(a.r, a.y, i), pt(a.r, a.y, j), t, m));
      g.add(beam(pt(a.r, a.y, i), pt(b.r, b.y, j), t * 0.7, m));
      g.add(beam(pt(a.r, a.y, j), pt(b.r, b.y, i), t * 0.7, m));
    }
  }
  const top = levels[levels.length - 1];
  for (let i = 0; i < n; i++) g.add(beam(pt(top.r, top.y, i), pt(top.r, top.y, (i + 1) % n), t, mats[0]));
}

/** Skytree: triangular 3-leg lattice base morphing to a circular shaft, two observation decks, mast. */
function skytree(p: Place): THREE.Group {
  const g = group(p);
  // Base: three braced legs converging (triangle plan, foot ~1:6 of the height), ring frames at each level.
  lattice(g, 3, Math.PI / 2, [{ y: 0, r: 1.65 }, { y: 1.2, r: 1.2 }, { y: 2.4, r: 0.82 }, { y: 3.5, r: 0.52 }], 0.06, [SKY_WHITE]);
  for (let i = 0; i < 3; i++) {
    const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
    g.add(box(0.3, 0.12, 0.3, M.concrete, { x: 1.65 * Math.cos(a), y: 0, z: 1.65 * Math.sin(a) }));
  }
  // Lattice walls between the legs read the triangle plan from the default view.
  lattice(g, 3, Math.PI / 2 + Math.PI / 3, [{ y: 0.6, r: 0.75 }, { y: 2.0, r: 0.58 }, { y: 3.5, r: 0.46 }], 0.035, [SKY_WHITE]);
  // Transition: hexagonal frame then round, braced shaft.
  lattice(g, 6, 0, [{ y: 3.5, r: 0.46 }, { y: 4.15, r: 0.42 }, { y: 4.8, r: 0.38 }, { y: 5.45, r: 0.35 }, { y: 6.1, r: 0.32 }, { y: 6.75, r: 0.3 }], 0.04, [SKY_WHITE]);
  g.add(cylinder(0.17, 0.3, 3.4, SKY_WHITE, { y: 3.5, segments: 14 }));
  g.add(cylinder(0.14, 0.17, 1.4, SKY_WHITE, { y: 6.9, segments: 14 }));
  // Tembo Deck (~55% height): struts, underside bowl, glazed ring, roof lip.
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    g.add(beam([0.2 * Math.cos(a), 6.0, 0.2 * Math.sin(a)], [0.58 * Math.cos(a), 6.95, 0.58 * Math.sin(a)], 0.04, SKY_WHITE));
  }
  g.add(cylinder(0.64, 0.3, 0.25, SKY_WHITE, { y: 6.9, segments: 24 }));
  g.add(cylinder(0.66, 0.66, 0.18, windowMaterial, { y: 7.15, segments: 24 }));
  g.add(cylinder(0.7, 0.66, 0.08, SKY_WHITE, { y: 7.33, segments: 24 }));
  g.add(cylinder(0.5, 0.7, 0.14, SKY_WHITE, { y: 7.41, segments: 24 }));
  g.add(cylinder(0.64, 0.64, 0.07, M.steel, { y: 7.55, segments: 24 }));
  g.add(cylinder(0.14, 0.2, 0.3, SKY_WHITE, { y: 7.6, segments: 14 }));
  g.add(cylinder(0.11, 0.14, 1.2, SKY_WHITE, { y: 7.9, segments: 12 }));
  // Tembo Galleria (~75%): smaller ring.
  g.add(cylinder(0.44, 0.2, 0.16, SKY_WHITE, { y: 9.0, segments: 20 }));
  g.add(cylinder(0.45, 0.45, 0.13, windowMaterial, { y: 9.16, segments: 20 }));
  g.add(cylinder(0.5, 0.45, 0.06, SKY_WHITE, { y: 9.29, segments: 20 }));
  g.add(cylinder(0.1, 0.12, 0.7, SKY_WHITE, { y: 9.35, segments: 10 }));
  // Gain tower and antenna mast.
  g.add(cylinder(0.065, 0.1, 1.2, SKY_WHITE, { y: 10.05, segments: 10 }));
  g.add(cylinder(0.012, 0.06, 1.7, mat(0xdfe6ea), { y: 11.2, segments: 8 }));
  g.add(sphere(0.03, lampMaterial, { y: 12.9, segments: 6 }));
  return g;
}

/**
 * Tokyo Tower: 4-leg lattice in orange/white bands whose legs flare out at the foot, linked by an arch on
 * each face over the low FootTown building; main deck at ~43%, top deck at ~75%, banded antenna.
 */
function tokyoTower(p: Place): THREE.Group {
  const g = group(p);
  const lv = [
    { y: 0, r: 1.75 }, { y: 0.45, r: 1.42 }, { y: 1.0, r: 1.18 }, { y: 2.0, r: 0.93 }, { y: 3.0, r: 0.72 }, { y: 3.95, r: 0.56 },
  ];
  lattice(g, 4, Math.PI / 4, lv, 0.05, [TOWER_ORANGE, TOWER_WHITE]);
  lattice(g, 4, Math.PI / 4, [{ y: 4.35, r: 0.5 }, { y: 5.2, r: 0.38 }, { y: 6.1, r: 0.27 }, { y: 6.9, r: 0.18 }], 0.04, [TOWER_WHITE, TOWER_ORANGE]);
  // Leg radius at height y, following the lattice levels.
  const legR = (y: number) => {
    let k = 0;
    while (k < lv.length - 2 && y > lv[k + 1].y) k++;
    return lv[k].r + ((lv[k + 1].r - lv[k].r) * (y - lv[k].y)) / (lv[k + 1].y - lv[k].y);
  };
  for (let i = 0; i < 4; i++) {
    const a0 = Math.PI / 4 + (i * Math.PI) / 2;
    const a1 = a0 + Math.PI / 2;
    g.add(box(0.3, 0.14, 0.3, M.concrete, { x: 1.75 * Math.cos(a0), z: 1.75 * Math.sin(a0) }));
    // Arch in the face between two legs, springing from the feet.
    const pts: THREE.Vector3[] = [];
    for (let s = 0; s <= 10; s++) {
      const u = s / 10;
      const y = 0.88 * Math.sin(Math.PI * u);
      const r = legR(y);
      pts.push(new THREE.Vector3(r * Math.cos(a0) * (1 - u) + r * Math.cos(a1) * u, y, r * Math.sin(a0) * (1 - u) + r * Math.sin(a1) * u));
    }
    g.add(tube(pts, 0.04, TOWER_ORANGE, { segments: 20 }));
  }
  // FootTown: the low glazed building between the legs.
  g.add(building({ w: 1.6, d: 1.6, h: 0.62, wall: mat(0xe9e6df), windows: 'bands', floorH: 0.28, roof: 'flat', plain: true }));
  g.add(box(0.9, 0.05, 0.3, TOWER_ORANGE, { y: 0.3, z: 0.95 }));
  // Main deck: two tiers with a glazed band.
  g.add(box(1.45, 0.12, 1.45, TOWER_ORANGE, { y: 3.9 }));
  g.add(box(1.36, 0.18, 1.36, windowMaterial, { y: 4.02 }));
  g.add(box(1.5, 0.07, 1.5, TOWER_WHITE, { y: 4.2 }));
  g.add(box(0.8, 0.14, 0.8, TOWER_ORANGE, { y: 4.27 }));
  // Top deck.
  g.add(box(0.62, 0.1, 0.62, TOWER_ORANGE, { y: 6.82 }));
  g.add(box(0.54, 0.12, 0.54, windowMaterial, { y: 6.92 }));
  g.add(box(0.66, 0.06, 0.66, TOWER_WHITE, { y: 7.04 }));
  // Antenna mast, banded.
  g.add(cylinder(0.07, 0.11, 1.1, TOWER_ORANGE, { y: 7.1, segments: 8 }));
  g.add(cylinder(0.04, 0.07, 0.7, TOWER_WHITE, { y: 8.2, segments: 8 }));
  g.add(cylinder(0.012, 0.04, 0.6, TOWER_ORANGE, { y: 8.9, segments: 6 }));
  g.add(sphere(0.03, lampMaterial, { y: 9.5, segments: 6 }));
  return g;
}

/**
 * Mt Fuji: concave cone (flared foot, steep summit) cut by radial erosion gullies, with the Hoei shoulder on
 * the flank, a shallow crater inside a ragged rim, snow that runs further down the gullies, and a forest skirt
 * with a ragged tree line. Rock, snow and forest are shells over one radius field, so they never cross.
 */
function fuji(p: Place): THREE.Group {
  const g = group(p);
  const R = 2.3;
  const H = 4.3;
  const top = 0.42;
  const S = 64;
  // Half straight cone, half steep flare toward the foot: the summit keeps a slope instead of going vertical.
  const radiusAt = (y: number) => top + (R - top) * (0.45 * (1 - y / H) + 0.55 * (1 - y / H) ** 3.5);
  // Periodic ridge noise around the cone; positive values are gullies.
  const gully = (a: number) => 0.5 * Math.sin(7 * a + 0.3) + 0.3 * Math.sin(13 * a + 1.7) + 0.2 * Math.sin(17 * a + 4.1);
  // Hoei crater shoulder, on the flank left of the default view.
  const HOEI = Math.PI / 4 - 0.9;
  const rAt = (a: number, y: number) => {
    const u = y / H;
    const da = Math.atan2(Math.sin(a - HOEI), Math.cos(a - HOEI));
    return radiusAt(y) * (1 - (0.03 + 0.1 * u) * Math.max(0, gully(a))) + 0.16 * Math.exp(-(da * da) / 0.06 - (u - 0.42) ** 2 / 0.008);
  };
  const rimY = (a: number) => H + 0.04 * Math.sin(9 * a) + 0.02 * Math.sin(4 * a + 1);
  /** Flat-shaded band of `rows` quads up the mountain; `at` gives `[radius, y]` for row `j` at angle `a`. */
  const shell = (rows: number, at: (a: number, j: number) => [number, number], material: Mat) => {
    const pos: number[] = [];
    const v = (i: number, j: number) => {
      const a = (i / S) * Math.PI * 2;
      const [r, y] = at(a, j);
      return [r * Math.sin(a), y, r * Math.cos(a)];
    };
    for (let i = 0; i < S; i++) {
      for (let j = 0; j < rows; j++) pos.push(...v(i, j), ...v(i + 1, j), ...v(i + 1, j + 1), ...v(i, j), ...v(i + 1, j + 1), ...v(i, j + 1));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  // Rock up to the rim, closed by a crater floor (hidden under the snow).
  const N = 18;
  g.add(shell(N + 1, (a, j) => {
    if (j > N) return [0, H - 0.12];
    if (j === N) return [top, rimY(a)];
    const y = (H * j) / N;
    return [rAt(a, y), y];
  }, mat(0x7189ad, { flat: true })));
  // Forest skirt with a ragged tree line.
  const treeLine = (a: number) => 0.75 + 0.15 * (1 + Math.sin(3 * a + 1)) + 0.12 * Math.sin(11 * a);
  g.add(shell(3, (a, j) => {
    const y = (treeLine(a) * j) / 3;
    return [rAt(a, y) + 0.025, y];
  }, mat(0x54735a, { flat: true })));
  // Snow: its lower edge drops down the gullies in streaks; over the rim it dips into the crater.
  const M = 10;
  const snowLine = (a: number) => H * (0.6 + 0.03 * Math.sin(5 * a + 2) - 0.2 * Math.max(0, gully(a)) ** 2);
  g.add(shell(M + 2, (a, j) => {
    if (j === M + 2) return [0, H - 0.1];
    if (j === M + 1) return [top - 0.1, rimY(a) - 0.01];
    if (j === M) return [top + 0.035, rimY(a) + 0.015];
    const y = snowLine(a) + ((H - snowLine(a)) * j) / M;
    return [rAt(a, y) + 0.035, y];
  }, mat(0xf6f9fc, { flat: true, roughness: 0.8 })));
  return g;
}

/** Five-tier pagoda: shrinking vermilion storeys, each with a flared upturned eave, sorin spire. */
function pagoda(p: Place): THREE.Group {
  const g = group(p);
  const stone = mat(0xd8cdb5);
  g.add(box(2.0, 0.1, 2.0, stone));
  g.add(box(1.5, 0.12, 1.5, stone, { y: 0.1 }));
  let y = 0.22;
  for (let i = 0; i < 5; i++) {
    const w = 0.95 - i * 0.1;
    const eave = (w + 0.62) / 2;
    g.add(box(w, 0.5, w, TEMPLE_RED, { y }));
    g.add(box(w * 0.36, 0.26, w + 0.02, M.dark, { y: y + 0.1 }));
    g.add(box(w + 0.02, 0.26, w * 0.36, M.dark, { y: y + 0.1 }));
    for (const s of [-1, 1]) for (const t of [-1, 1]) g.add(box(0.07, 0.5, 0.07, M.gold, { x: s * w / 2, y, z: t * w / 2 }));
    // Bracket block under the eave, then a concave roof whose corners sweep up.
    g.add(box(w + 0.2, 0.06, w + 0.2, M.dark, { y: y + 0.5 }));
    g.add(templeRoof(eave * 2.15, eave * 2.15, 0.36, TEMPLE_ROOF, { y: y + 0.55, ridge: 0, kick: 0.1, t: 0.05 }));
    y += 0.9;
  }
  // Sorin: mast with stacked rings, a water flame and a finial.
  g.add(cylinder(0.03, 0.05, 1.3, M.gold, { y: y - 0.2, segments: 6 }));
  for (let i = 0; i < 6; i++) g.add(cylinder(0.12 - i * 0.015, 0.12 - i * 0.015, 0.035, M.gold, { y: y + i * 0.14, segments: 8 }));
  g.add(cone(0.08, 0.2, M.gold, { y: y + 0.9, segments: 6 }));
  return g;
}

/**
 * Senso-ji main hall (Hondo), front on +z: stone podium with steps, a veranda of posts on all four sides,
 * a skirt roof (mokoshi) and the great concave roof, taller than the walls under it.
 */
function mainHall(p: Place): THREE.Group {
  const g = group(p);
  const stone = mat(0xd8cdb5);
  g.add(box(3.6, 0.18, 2.1, stone));
  g.add(box(1.2, 0.09, 0.3, stone, { z: 1.2 }));
  g.add(box(2.6, 0.92, 1.3, TEMPLE_RED, { y: 0.18 }));
  // Veranda posts on all four sides under a dark tie beam.
  for (let i = 0; i < 9; i++) for (const sz of [-1, 1]) g.add(cylinder(0.045, 0.05, 0.92, TEMPLE_RED, { x: -1.6 + i * 0.4, y: 0.18, z: sz * 0.9, segments: 6 }));
  for (let i = 1; i < 4; i++) for (const sx of [-1, 1]) g.add(cylinder(0.045, 0.05, 0.92, TEMPLE_RED, { x: sx * 1.6, y: 0.18, z: -0.9 + i * 0.45, segments: 6 }));
  for (const sz of [-1, 1]) g.add(box(3.24, 0.08, 0.06, M.dark, { y: 1.02, z: sz * 0.9 }));
  for (const sx of [-1, 1]) g.add(box(0.06, 0.08, 1.84, M.dark, { x: sx * 1.6, y: 1.02 }));
  g.add(box(3.3, 0.1, 1.9, M.dark, { y: 1.1 }));
  // Gilded doors behind the front posts and the great red lantern hanging under the front eave.
  g.add(box(1.1, 0.7, 0.02, M.gold, { y: 0.2, z: 0.66 }));
  g.add(cylinder(0.02, 0.02, 0.16, M.dark, { y: 1.0, z: 1.0, segments: 4 }));
  g.add(cylinder(0.1, 0.13, 0.04, M.dark, { y: 0.96, z: 1.0, segments: 10 }));
  g.add(lathe([[0.13, 0], [0.18, 0.08], [0.2, 0.2], [0.18, 0.32], [0.13, 0.4]], LANTERN, { y: 0.56, z: 1.0, segments: 12 }));
  g.add(cylinder(0.13, 0.1, 0.04, M.dark, { y: 0.52, z: 1.0, segments: 10 }));
  // Lit windows on the sides and back.
  for (const sx of [-1, 1]) g.add(box(0.02, 0.4, 0.6, windowMaterial, { x: sx * 1.31, y: 0.4 }));
  for (const sx of [-1, 1]) g.add(box(0.6, 0.35, 0.02, windowMaterial, { x: sx * 0.7, y: 0.42, z: -0.66 }));
  // Skirt roof; the upper storey rises out of it and carries the great roof.
  g.add(templeRoof(3.9, 2.3, 0.34, TEMPLE_ROOF, { y: 1.2, kick: 0.14 }));
  g.add(box(2.3, 0.53, 1.2, TEMPLE_RED, { y: 1.25 }));
  for (let i = 0; i < 6; i++) g.add(box(0.05, 0.53, 1.22, M.dark, { x: -1.0 + i * 0.4, y: 1.25 }));
  g.add(box(2.6, 0.08, 1.4, M.dark, { y: 1.74 }));
  g.add(templeRoof(3.5, 2.2, 1.2, TEMPLE_ROOF, { y: 1.8, ridge: 1.7, kick: 0.22 }));
  // Ridge cap with gold shachi at its ends.
  g.add(box(1.8, 0.1, 0.14, M.dark, { y: 2.94 }));
  for (const sx of [-1, 1]) g.add(cone(0.08, 0.26, M.gold, { x: sx * 0.88, y: 2.98, segments: 5 }));
  return g;
}

/** Kanji for the Kaminarimon lantern, as `[x, y, w, h]` strokes (y from the glyph's foot). */
const RAI: [number, number, number, number][] = [
  [0, 0.2, 0.2, 0.025], [0, 0.15, 0.025, 0.05],
  [-0.08, 0, 0.025, 0.12], [0.08, 0, 0.025, 0.12], [0, 0, 0.025, 0.12], [0, 0, 0.18, 0.025], [0, 0.055, 0.18, 0.02], [0, 0.11, 0.18, 0.025],
];
const MON: [number, number, number, number][] = [
  [-0.08, 0, 0.03, 0.22], [0.08, 0, 0.03, 0.22],
  [-0.045, 0.19, 0.06, 0.02], [-0.045, 0.13, 0.06, 0.02], [0.045, 0.19, 0.06, 0.02], [0.045, 0.13, 0.06, 0.02],
];

/** Kaminarimon, passage along z: four pillars, Fujin/Raijin niches, the giant chochin lantern and one sweeping irimoya roof. */
function kaminarimon(p: Place): THREE.Group {
  const g = group(p);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    g.add(box(0.4, 0.1, 0.4, M.concrete, { x: sx * 1.0, z: sz * 0.4 }));
    g.add(cylinder(0.13, 0.15, 1.05, TEMPLE_RED, { x: sx * 1.0, y: 0.1, z: sz * 0.4, segments: 8 }));
  }
  // Tie beams (nuki) just under the bracket course, clear of the lantern.
  for (const sz of [-1, 1]) g.add(box(2.4, 0.1, 0.1, TEMPLE_RED, { y: 1.0, z: sz * 0.4 }));
  for (const sx of [-1, 1]) g.add(box(0.1, 0.1, 0.9, TEMPLE_RED, { x: sx * 1.0, y: 1.0 }));
  // Bracket course and frieze carrying the roof.
  g.add(box(2.9, 0.16, 1.3, M.dark, { y: 1.15 }));
  g.add(box(2.5, 0.4, 1.0, TEMPLE_RED, { y: 1.31 }));
  for (let i = 0; i < 5; i++) g.add(box(0.1, 0.3, 1.04, M.dark, { x: -1.0 + i * 0.5, y: 1.36 }));
  g.add(templeRoof(3.6, 2.1, 0.8, TEMPLE_ROOF, { y: 1.71, ridge: 1.6, kick: 0.2 }));
  // Ridge cap with gold shachi at its ends.
  g.add(box(1.7, 0.09, 0.12, M.dark, { y: 2.48 }));
  for (const sx of [-1, 1]) g.add(cone(0.08, 0.24, M.gold, { x: sx * 0.82, y: 2.52, segments: 5 }));
  // The giant red lantern (chochin) in the passage: hook, black caps and rings, 雷門 on both faces.
  g.add(cylinder(0.06, 0.06, 0.12, M.dark, { y: 1.04, segments: 6 }));
  g.add(cylinder(0.2, 0.3, 0.08, M.dark, { y: 1.0, segments: 14 }));
  g.add(lathe([[0.28, 0], [0.4, 0.12], [0.44, 0.36], [0.4, 0.6], [0.28, 0.72]], LANTERN, { y: 0.3, segments: 18 }));
  g.add(cylinder(0.28, 0.2, 0.06, M.dark, { y: 0.25, segments: 14 }));
  for (const [y, r] of [[0.47, 0.425], [0.65, 0.448], [0.83, 0.418]]) g.add(cylinder(r, r, 0.02, M.dark, { y, segments: 18 }));
  for (const sz of [-1, 1]) {
    for (const [glyph, y0] of [[RAI, 0.67], [MON, 0.38]] as const) {
      for (const [x, y, w, h] of glyph) g.add(box(w, h, 0.03, M.dark, { x: sz * x, y: y0 + y, z: sz * 0.435 }));
    }
  }
  // Fujin and Raijin flank the passage on the street face (+z), just outside the pillar line so the eave does not
  // hide them from the default camera, each in front of a dark niche panel.
  for (const [sx, kind] of [[-1, 'wind'], [1, 'thunder']] as const) {
    g.add(box(0.36, 0.9, 0.05, M.dark, { x: sx * 0.68, y: 0.1, z: 0.44 }));
    g.add(guardian({ x: sx * 0.68, y: 0.1, z: 0.58 }, kind));
  }
  return g;
}

/**
 * Gate guardian facing +z, ~0.8 tall: Fujin (green, the wind bag arched over his head) or Raijin (red, horned,
 * a ring of drums behind him). Wide stance on a rock, gold loincloth, arms raised.
 */
function guardian(p: Place, kind: 'wind' | 'thunder'): THREE.Group {
  const g = group(p);
  const skin = mat(kind === 'wind' ? 0x3d8f5a : 0xc8452a);
  g.add(box(0.26, 0.1, 0.18, M.stone));
  for (const sx of [-1, 1]) {
    g.add(beam([sx * 0.04, 0.1, 0], [sx * 0.08, 0.24, 0.02], 0.045, skin));
    g.add(beam([sx * 0.07, 0.42, 0], [sx * 0.13, 0.5, 0.03], 0.035, skin));
    g.add(beam([sx * 0.13, 0.5, 0.03], [sx * 0.12, 0.6, 0.04], 0.032, skin));
  }
  g.add(cylinder(0.06, 0.09, 0.1, M.gold, { y: 0.2, segments: 6 }));
  g.add(cylinder(0.055, 0.07, 0.14, skin, { y: 0.3, segments: 6 }));
  g.add(sphere(0.05, skin, { y: 0.43, segments: 8 }));
  if (kind === 'wind') {
    g.add(sphere(0.045, M.dark, { y: 0.47, z: -0.015, segments: 6 }));
    const bag = [[-0.12, 0.6, 0.04], [-0.1, 0.72, -0.02], [0, 0.77, -0.04], [0.1, 0.72, -0.02], [0.12, 0.6, 0.04]];
    g.add(tube(bag.map(([x, y, z]) => new THREE.Vector3(x, y, z)), 0.03, M.white, { segments: 16 }));
  } else {
    for (const sx of [-1, 1]) g.add(cone(0.012, 0.05, M.gold, { x: sx * 0.025, y: 0.51, segments: 4 }));
    const ring: THREE.Vector3[] = [];
    for (let k = 0; k <= 8; k++) {
      const a = Math.PI * (-0.1 + (1.2 * k) / 8);
      ring.push(new THREE.Vector3(0.14 * Math.cos(a), 0.5 + 0.14 * Math.sin(a), -0.05));
    }
    g.add(tube(ring, 0.008, M.gold, { segments: 16 }));
    for (const pt of ring.filter((_, k) => k % 2 === 0)) {
      const drum = cylinder(0.025, 0.025, 0.03, VERMILION, { x: pt.x, y: pt.y, z: pt.z - 0.015, segments: 8 });
      drum.rotation.x = Math.PI / 2;
      g.add(drum);
    }
  }
  return g;
}

const SILVER = mat(0xdde1e6, { roughness: 0.45, metalness: 0.25 });
/** Seven-segment-style digits for the 109 crown, `[x, y, w, h]` strokes in a 0.22 x 0.4 cell. */
const DIGITS: Record<string, [number, number, number, number][]> = {
  '1': [[0.03, 0, 0.06, 0.4], [-0.03, 0.32, 0.06, 0.06]],
  '0': [[-0.08, 0, 0.06, 0.4], [0.08, 0, 0.06, 0.4], [0, 0, 0.22, 0.06], [0, 0.34, 0.22, 0.06]],
  '9': [[-0.08, 0.17, 0.06, 0.23], [0.08, 0, 0.06, 0.4], [0, 0.34, 0.22, 0.06], [0, 0.17, 0.22, 0.06], [0, 0, 0.22, 0.06]],
};

/** Open cylinder segment (curved banner) centred on angle `a` (same angle convention as `ry`). */
function arcPanel(r: number, h: number, a: number, span: number, material: Mat, y: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r, r, h, 16, 1, true, a - span / 2, span);
  geo.translate(0, y + h / 2, 0);
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  return m;
}

/**
 * SHIBUYA109: ribbed silver drum with glass bands and wrapped banners, a white crown reading "109" toward
 * each angle in `faces` (radians, `ry` convention), an entrance canopy toward `faces[0]`, wedge annex behind.
 */
function shibuya109(p: Place, faces: number[]): THREE.Group {
  const g = group(p);
  const r = 0.88;
  const h = 3.3;
  g.add(prism([[0.2, -0.85], [1.05, -0.85], [1.05, 0.55], [0.55, 0.75]], 2.6, SILVER));
  for (let i = 0; i < 4; i++) g.add(box(0.02, 0.1, 1.2, windowMaterial, { x: 1.06, y: 0.55 + i * 0.5, z: -0.15 }));
  g.add(cylinder(r, r, h, SILVER, { segments: 32 }));
  for (let y = 0.55; y < h - 0.2; y += 0.34) g.add(cylinder(r + 0.015, r + 0.015, 0.12, windowMaterial, { y, segments: 32 }));
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    g.add(box(0.05, h - 0.1, 0.07, SILVER, { x: Math.sin(a) * (r + 0.02), z: Math.cos(a) * (r + 0.02), ry: a }));
  }
  // Banners wrap the drum, in the same lit-at-night materials as `adBoard()`.
  for (const [c, bh, face, span, y] of [[0xff7a2f, 0.8, faces[0], 0.9, 1.6], [0xb56cff, 0.5, faces[1] ?? faces[0], 1.0, 0.85]]) {
    g.add(arcPanel(r + 0.075, bh, face, span, floodMat(c, c, 1.2, { roughness: 0.4 }), y));
  }
  // Crown band with the logo, silver cap above.
  g.add(cylinder(r + 0.06, r + 0.06, 0.62, M.white, { y: h, segments: 32 }));
  g.add(cylinder(r + 0.1, r + 0.1, 0.06, SILVER, { y: h + 0.62, segments: 32 }));
  for (const face of faces) {
    [...'109'].forEach((ch, k) => {
      const dg = group({ ry: face + (k - 1) * 0.27 });
      for (const [x, y, w, sh] of DIGITS[ch]) dg.add(box(w, sh, 0.03, M.dark, { x, y: h + 0.11 + y, z: r + 0.06 }));
      g.add(dg);
    });
  }
  const door = group({ ry: faces[0] });
  door.add(box(0.9, 0.05, 0.4, M.dark, { y: 0.55, z: r + 0.15 }));
  door.add(box(0.7, 0.5, 0.04, windowMaterial, { z: r + 0.01 }));
  g.add(door);
  return g;
}

/** Hachiko: the bronze Akita sitting up on a stone plinth, facing +z. */
function hachiko(p: Place): THREE.Group {
  const g = group(p);
  const bronze = M.iron;
  g.add(box(0.3, 0.26, 0.36, M.stone));
  const y = 0.26;
  g.add(box(0.13, 0.08, 0.15, bronze, { y, z: -0.04 }));
  g.add(box(0.1, 0.15, 0.08, bronze, { y: y + 0.04, z: 0.03 }));
  for (const sx of [-1, 1]) g.add(box(0.03, 0.1, 0.03, bronze, { x: sx * 0.03, y, z: 0.07 }));
  g.add(box(0.085, 0.075, 0.09, bronze, { y: y + 0.17, z: 0.05 }));
  g.add(box(0.05, 0.04, 0.05, bronze, { y: y + 0.18, z: 0.11 }));
  for (const sx of [-1, 1]) g.add(cone(0.02, 0.05, bronze, { x: sx * 0.028, y: y + 0.245, z: 0.04, segments: 4 }));
  g.add(sphere(0.03, bronze, { y: y + 0.07, z: -0.11, segments: 6 }));
  return g;
}

/** Asahi Super Dry Hall: black granite body flaring like a beer glass, the gold Flamme d'Or lying on its roof. */
function superDryHall(p: Place): THREE.Group {
  const g = group(p);
  g.add(box(0.9, 0.32, 0.9, windowMaterial));
  g.add(profile([[-0.42, 0.3], [0.42, 0.3], [0.58, 1.5], [-0.58, 1.5]], 1.0, M.dark));
  const flame = lathe([[0, 0], [0.14, 0.05], [0.2, 0.16], [0.19, 0.3], [0.13, 0.55], [0.07, 0.85], [0.02, 1.1], [0, 1.15]], M.gold, { segments: 12 });
  // Lay it along -x with the tail sweeping slightly up.
  flame.rotation.z = Math.PI / 2 - 0.22;
  flame.position.set(0.32, 1.62, 0);
  g.add(flame);
  return g;
}

/**
 * Nakamise shop, front on +z: walls in a vermilion frame, an open front with a counter of goods, a signboard
 * with lettering, a noren, a red lantern at the corner and its own small tiled roof.
 */
function stall(p: Place, i: number): THREE.Group {
  const g = group(p);
  g.add(box(0.58, 0.36, 0.42, M.white));
  for (const sx of [-1, 1]) g.add(box(0.04, 0.36, 0.04, VERMILION, { x: sx * 0.27, z: 0.2 }));
  g.add(box(0.46, 0.24, 0.02, M.dark, { y: 0.05, z: 0.205 }));
  g.add(box(0.5, 0.08, 0.08, M.wood, { z: 0.25 }));
  const goods = [VERMILION, M.gold, M.white, LANTERN];
  for (let k = 0; k < 4; k++) g.add(box(0.08, 0.05, 0.06, goods[(k + i) % 4], { x: -0.18 + k * 0.12, y: 0.08, z: 0.25 }));
  for (let k = 0; k < 3; k++) g.add(box(0.13, 0.07, 0.01, i % 2 ? M.dark : VERMILION, { x: -0.15 + k * 0.15, y: 0.2, z: 0.218 }));
  g.add(box(0.5, 0.07, 0.02, i % 2 ? VERMILION : M.white, { y: 0.29, z: 0.215 }));
  g.add(box(0.3, 0.025, 0.01, i % 2 ? M.white : M.dark, { y: 0.312, z: 0.228 }));
  g.add(templeRoof(0.64, 0.56, 0.16, TEMPLE_ROOF, { y: 0.4, ridge: 0.2, kick: 0.03, t: 0.02 }));
  g.add(cylinder(0.05, 0.05, 0.11, LANTERN, { x: 0.24, y: 0.16, z: 0.3, segments: 8 }));
  return g;
}

/** Length of the Shinkansen set from nose tip to nose tip. */
const TRAIN_LEN = 3.49;

/**
 * Shinkansen set: duckbill nose at local origin (+z), five cars toward -z and a second nose at the far end
 * (z = -TRAIN_LEN), so it can reverse at a terminus like the real trains. Pre-merged.
 */
function shinkansen(): THREE.Group {
  const g = group({ y: 1.24 });
  const white = mat(0xf3f5f7, { roughness: 0.35 });
  const blue = mat(0x2a63b8, { roughness: 0.4 });
  for (const [z, ry] of [[0, 0], [-TRAIN_LEN, Math.PI]]) {
    // Wide rear of the nose, then a narrower pointed bill with a drooping duckbill profile.
    const nose = group({ z, ry });
    nose.add(profile([[0.12, 0.06], [0.12, 0.3], [0.45, 0.32], [0.45, 0.06]], 0.3, white, { ry: Math.PI / 2 }));
    nose.add(profile([[0.0, 0.1], [0.04, 0.17], [0.22, 0.28], [0.34, 0.31], [0.34, 0.06], [0.12, 0.06]], 0.17, white, { ry: Math.PI / 2 }));
    nose.add(box(0.31, 0.035, 0.28, blue, { y: 0.1, z: -0.3 }));
    nose.add(box(0.08, 0.05, 0.1, windowMaterial, { y: 0.24, z: -0.2 }));
    g.add(nose);
  }
  for (let k = 0; k < 5; k++) {
    const c = group({ z: -0.45 - 0.26 - k * 0.52 });
    c.add(box(0.3, 0.26, 0.5, white, { y: 0.06 }));
    c.add(box(0.31, 0.04, 0.5, blue, { y: 0.1 }));
    c.add(box(0.31, 0.05, 0.4, windowMaterial, { y: 0.2 }));
    g.add(c);
  }
  mergeStatic(g);
  return g;
}

/**
 * Run `train` (facing +x) back and forth along track `z` between a platform with its tip at `xa` and one with its
 * tip at `xb`: it dwells `dwell` s at each, then accelerates out, cruises and brakes in over `run` s. `phase`
 * (fraction of the round trip) offsets one train from the other.
 */
function shuttle(anim: Animator, train: THREE.Object3D, z: number, xa: number, xb: number, dwell: number, run: number, phase: number): THREE.Object3D {
  train.userData.dynamic = true;
  train.rotation.y = Math.PI / 2;
  const T = 2 * (dwell + run);
  // Constant acceleration over the first quarter, cruise, constant braking over the last quarter (C1-continuous).
  const ease = (u: number) => (u < 0.25 ? (8 / 3) * u * u : u > 0.75 ? 1 - (8 / 3) * (1 - u) * (1 - u) : 1 / 6 + (4 / 3) * (u - 0.25));
  anim.add((t) => {
    const u = (((t / T + phase) % 1) + 1) % 1 * T;
    let k: number;
    if (u < dwell) k = 0;
    else if (u < dwell + run) k = ease((u - dwell) / run);
    else if (u < 2 * dwell + run) k = 1;
    else k = 1 - ease((u - 2 * dwell - run) / run);
    train.position.set(xa + (xb - xa) * k, train.position.y, z);
  });
  train.position.set(xa, train.position.y, z);
  return train;
}

/**
 * Shibuya/Shinjuku block with a shopfront, rooftop plant, ad boards and a tategaki blade sign. `i % 4` picks the
 * facade: tiled walls with a window grid, red-brown brick with white trim, an apartment front with a balcony per
 * floor, or a dark glass curtain wall with window bands.
 */
function midrise(x: number, z: number, w: number, d: number, h: number, i: number, rand: () => number): THREE.Group {
  const g = group({ x, z });
  const kind = i % 4;
  const wall = kind === 1 ? mat(0x9a5a48) : kind === 3 ? M.glassDark : mat(WALLS[i % WALLS.length]);
  const trim = kind === 1 ? M.white : kind === 3 ? M.steel : mat(WALLS[(i + 3) % WALLS.length]);
  g.add(building({ w, d, h, wall, trim, roof: 'flat', windows: kind === 3 ? 'bands' : 'grid', floorH: 0.5, shop: AWNINGS[i % AWNINGS.length] }));
  if (kind === 2) {
    // A slab and a white rail per upper floor, clear of the blade sign at the corner.
    for (let y = 1.1; y < h - 0.2; y += 0.5) {
      g.add(box(w - 0.6, 0.04, 0.16, trim, { y, z: d / 2 + 0.08 }));
      g.add(box(w - 0.6, 0.1, 0.015, M.white, { y: y + 0.04, z: d / 2 + 0.155 }));
    }
  }
  // Roof variety: setback volume, water tank, or billboard frame.
  if (i % 3 === 1 && w > 1.5) g.add(building({ w: w * 0.6, d: d * 0.6, h: 0.7, y: h, wall, roof: 'flat', windows: 'grid', floorH: 0.35, plain: true }));
  if (i % 4 === 2) {
    for (const s of [-1, 1]) g.add(box(0.04, 0.22, 0.04, M.dark, { x: w * 0.2 + s * 0.12, y: h + 0.1, z: -d * 0.2 }));
    g.add(cylinder(0.18, 0.18, 0.3, M.wood, { x: w * 0.2, y: h + 0.32, z: -d * 0.2, segments: 8 }));
    g.add(cone(0.2, 0.14, M.dark, { x: w * 0.2, y: h + 0.62, z: -d * 0.2, segments: 8 }));
  }
  // Rooftop plant: AC units, a vent stack and, on some, an antenna mast.
  const units = 2 + Math.floor(rand() * 3);
  for (let k = 0; k < units; k++) g.add(box(0.15, 0.1, 0.15, M.steel, { x: (rand() - 0.5) * (w - 0.4), y: h, z: (rand() - 0.5) * (d - 0.4) }));
  g.add(cylinder(0.03, 0.03, 0.22, M.steel, { x: -w * 0.35, y: h, z: d * 0.3, segments: 6 }));
  if (i % 3 === 0) g.add(beam([w * 0.32, h, -d * 0.32], [w * 0.32, h + 0.6, -d * 0.32], 0.025, M.dark));
  // Ad boards on the street and side faces.
  const c = NEON[Math.floor(rand() * NEON.length)];
  const sw = Math.min(w - 0.1, 0.45 + rand() * 0.35);
  const sh = 0.5 + rand() * Math.min(0.9, h * 0.3);
  const sy = 0.9 + rand() * Math.max(0.05, h - sh - 1.1);
  // The apartment front keeps its balconies; its street board goes on the side wall only.
  if (kind !== 2) g.add(adBoard(sw, sh, c, { x: (rand() - 0.5) * Math.max(0, w - sw - 0.5), y: sy, z: d / 2 + 0.05 }));
  g.add(adBoard(Math.min(d - 0.1, sw), sh, NEON[Math.floor(rand() * NEON.length)], { x: w / 2 + 0.05, y: 0.9 + rand() * Math.max(0.05, h - sh - 1.1), z: (rand() - 0.5) * Math.max(0, d - sw - 0.2), ry: Math.PI / 2 }));
  // Tategaki: tall vertical blade sign projecting from the corner, banded like stacked kanji.
  const th = Math.min(h * 0.7, 1.1 + rand() * 0.9);
  const tx = (rand() > 0.5 ? 1 : -1) * (w / 2 - 0.14);
  const tc = NEON[Math.floor(rand() * NEON.length)];
  const ty = Math.max(0.6, h * 0.3);
  g.add(box(0.24, th, 0.16, mat(0xf4f0e8), { x: tx, y: ty, z: d / 2 + 0.11 }));
  const bands = Math.max(2, Math.floor(th / 0.28));
  for (let b = 0; b < bands; b++) g.add(box(0.18, 0.15, 0.02, b % 2 ? M.dark : floodMat(tc, tc, 1.2, { roughness: 0.4 }), { x: tx, y: ty + 0.06 + b * (th - 0.2) / bands, z: d / 2 + 0.2 }));
  // Rooftop billboard on a frame.
  if (i % 2 === 0 && w > 1.2) {
    const bc = NEON[(i * 5) % NEON.length];
    for (const s of [-1, 1]) g.add(box(0.05, 0.34, 0.05, M.dark, { x: s * w * 0.3, y: h + 0.03, z: d / 2 - 0.2 }));
    g.add(adBoard(w * 0.85, 0.6, bc, { y: h + 0.34, z: d / 2 - 0.16 }));
  }
  return g;
}

/** Scramble signal cycle in seconds: avenue green, cross-street green, then all-red while pedestrians cross every way. */
const CYCLE = { avenue: [0, 6], street: [6, 12], walk: [12, 20], T: 20 } as const;

/**
 * One signalised lane of queueing cars along a straight path that wraps at the plinth edge. Each car accelerates
 * to `vmax` but brakes for the car ahead (keeping `GAP`) and, when its light no longer lets it clear the crossing
 * before the green ends, for the stop line at `stopS` (car-centre distance along the path). Only cars near the
 * line queue; the rest keep driving. `cars[0]` starts on the stop line, the others `spacing` behind each other.
 * `yAt` lifts cars over ramps and pitches them (lanes along z only).
 */
function signalLane(anim: Animator, cars: THREE.Object3D[], from: [number, number], to: [number, number], stopS: number, spacing: number, green: readonly [number, number], vmax: number, yAt: (x: number, z: number) => number = () => 0.05): THREE.Object3D[] {
  const L = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const dx = (to[0] - from[0]) / L;
  const dz = (to[1] - from[1]) / L;
  const GAP = 0.62;
  const ACCEL = 1.6;
  const BRAKE = 2.4;
  // Distance a car on the line must cover to leave the crossing, and the time that takes from rest.
  const CLEAR = 3.75;
  const clearTime = (CLEAR + (vmax * vmax) / (2 * ACCEL)) / vmax + 0.3;
  const s = cars.map((_, i) => (((stopS - i * spacing) % L) + L) % L);
  const v = cars.map(() => 0);
  const place = () => cars.forEach((o, i) => {
    const x = from[0] + dx * s[i];
    const z = from[1] + dz * s[i];
    const y = yAt(x, z);
    o.position.set(x, y, z);
    o.rotation.y = Math.atan2(dx, dz);
    o.rotation.x = -Math.atan(((yAt(x + dx * 0.1, z + dz * 0.1) - y) / 0.1) * dz);
  });
  for (const o of cars) o.userData.dynamic = true;
  place();
  anim.add((t, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    if (dt <= 0) return;
    const u = t % CYCLE.T;
    const open = u >= green[0] && u <= green[1] - clearTime;
    cars.forEach((_, i) => {
      const ahead = s[(i - 1 + cars.length) % cars.length];
      let free = cars.length > 1 ? ((ahead - s[i] + L) % L) - GAP : Infinity;
      // Distance to the stop line; a car a hair past it (float drift while parked on it) still counts as on it.
      let toLine = (stopS - s[i] + L) % L;
      if (toLine > L - 0.01) toLine = 0;
      // Cars within the braking look-ahead of a closed line stop on it; cars already past it carry on.
      if (!open && toLine < 4) free = Math.min(free, toLine);
      free = Math.max(0, free);
      const vCap = Math.min(vmax, Math.sqrt(2 * BRAKE * free));
      v[i] = Math.min(v[i] + ACCEL * dt, vCap);
      s[i] = (s[i] + Math.min(v[i] * dt, free)) % L;
    });
    place();
  });
  return cars;
}

/**
 * The Shibuya scramble crowd: `n` pedestrians as instanced legs, coats, heads and hair (4 draw calls for all of
 * them). They wait on the four corners; in the all-red walk phase each crosses to another corner (diagonally,
 * across the street or across the avenue) and walks back the next cycle.
 */
function scrambleCrowd(anim: Animator, rand: () => number, n: number): THREE.Group {
  const g = group();
  g.userData.dynamic = true;
  const bake = (meshes: THREE.Mesh[]) => mergeGeometries(meshes.map((m) => {
    m.updateMatrix();
    return m.geometry.clone().applyMatrix4(m.matrix);
  }))!;
  const parts = [
    new THREE.InstancedMesh(bake([-1, 1].map((sx) => cylinder(0.011, 0.013, 0.085, M.dark, { x: sx * 0.015, segments: 4, ry: Math.PI / 4 }))), M.dark, n),
    new THREE.InstancedMesh(bake([cylinder(0.03, 0.04, 0.1, M.white, { y: 0.08, segments: 6 }), ...[-1, 1].map((sx) => cylinder(0.01, 0.011, 0.075, M.white, { x: sx * 0.038, y: 0.1, segments: 4, ry: Math.PI / 4 }))]), M.white, n),
    new THREE.InstancedMesh(bake([sphere(0.024, M.white, { y: 0.18, segments: 6 })]), mat(0xe2b48e), n),
    new THREE.InstancedMesh(bake([sphere(0.02, M.white, { y: 0.195, segments: 6 })]), mat(0x2a211c), n),
  ];
  const coat = new THREE.Color();
  for (const m of parts) {
    m.castShadow = true;
    m.receiveShadow = true;
    // Instances roam the crossing; the geometry's own bounds sit at the origin.
    m.frustumCulled = false;
    m.userData.dynamic = true;
    g.add(m);
  }
  // Coats: the office palette, with every fifth person in a bright tourist colour so the crowd reads from afar.
  const BRIGHT = [0xff5a3c, 0xffd23f, 0x2fb5ff, 0xff7ab8];
  for (let i = 0; i < n; i++) parts[1].setColorAt(i, coat.set(i % 5 === 0 ? BRIGHT[(i / 5) % BRIGHT.length] : COATS[(i * 5 + 2) % COATS.length]));
  // Each corner waits in an L: a row along the cross-street kerb and a column along the avenue kerb, on a jittered grid.
  const perCorner = Math.ceil(n / 4);
  const walkers = Array.from({ length: n }, (_, i) => {
    const corner = i % 4;
    const j = Math.floor(i / 4);
    const sx = corner < 2 ? -1 : 1;
    const sz = corner % 2 ? 1 : -1;
    const along = j < perCorner / 2;
    const m = along ? j : j - Math.ceil(perCorner / 2);
    const off: [number, number] = along ? [1.0 + m * 0.1 + rand() * 0.01, 0.97 + rand() * 0.06] : [0.97 + rand() * 0.04, 1.12 + m * 0.1 + rand() * 0.01];
    const a: [number, number] = [3 + sx * off[0], 5.5 + sz * off[1]];
    const kind = i % 3;
    const b: [number, number] = [kind === 1 ? a[0] : 6 - a[0], kind === 2 ? a[1] : 11 - a[1]];
    const start = CYCLE.walk[0] + rand() * 1.2;
    const dist = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { a, b, start, dur: Math.min(dist / (0.55 + rand() * 0.2), CYCLE.walk[1] - start - 0.3), lat: (rand() - 0.5) * 0.3 };
  });
  const o = new THREE.Object3D();
  anim.add((t) => {
    const c = Math.floor(t / CYCLE.T);
    const u = t - c * CYCLE.T;
    walkers.forEach((w, i) => {
      const [p, q] = c % 2 ? [w.b, w.a] : [w.a, w.b];
      const k = Math.min(1, Math.max(0, (u - w.start) / w.dur));
      const dx = q[0] - p[0];
      const dz = q[1] - p[1];
      const len = Math.hypot(dx, dz);
      // A slight sideways bow keeps crossing paths from running through each other.
      const side = Math.sin(Math.PI * k) * w.lat;
      const walking = k > 0 && k < 1;
      o.position.set(p[0] + dx * k - (dz / len) * side, 0.04 + (walking ? Math.abs(Math.sin(u * 9 + i)) * 0.006 : 0), p[1] + dz * k + (dx / len) * side);
      o.rotation.y = Math.atan2(dx, dz);
      o.updateMatrix();
      for (const m of parts) m.setMatrixAt(i, o.matrix);
    });
    for (const m of parts) m.instanceMatrix.needsUpdate = true;
  });
  return g;
}

const FOAM = mat(0xffffff, { transparent: true, opacity: 0.5 });

/** Add a V of foam trailing from the stern (`len` back from local z = `stern`) to a boat facing +z; returns it pre-merged. */
function withWake<T extends THREE.Object3D>(b: T, stern: number, width: number, len = 0.7): T {
  const a = 0.26;
  for (const s of [-1, 1]) {
    b.add(box(0.03, 0.004, len, FOAM, { x: s * (width / 2 + Math.sin(a) * len / 2), y: 0.024, z: stern - Math.cos(a) * len / 2, ry: -s * a }));
  }
  mergeStatic(b);
  return b;
}

/** Tokyo Mizube Line-style water bus: a low silver hull under a long glass canopy. Pre-merged. */
function waterBus(): THREE.Group {
  const g = group({ y: 0.01 });
  g.add(profile([[-0.55, 0.05], [0.5, 0.05], [0.42, -0.02], [-0.45, -0.02]], 0.24, SILVER, { ry: Math.PI / 2 }));
  const canopy = sphere(0.11, M.glass, { y: 0.02, segments: 12 });
  canopy.scale.set(1, 0.7, 4.2);
  g.add(canopy);
  g.add(box(0.2, 0.02, 0.9, windowMaterial, { y: 0.05 }));
  return g;
}

/** Yakatabune: long wooden houseboat with a lit cabin, a low dark roof and red lanterns along both eaves. Pre-merged. */
function yakatabune(): THREE.Group {
  const g = group({ y: 0.01 });
  g.add(profile([[-0.55, 0.05], [0.62, 0.05], [0.52, -0.02], [-0.47, -0.02]], 0.26, M.wood, { ry: Math.PI / 2 }));
  g.add(box(0.2, 0.09, 0.8, windowMaterial, { y: 0.05 }));
  for (const sx of [-1, 1]) for (let k = 0; k < 5; k++) g.add(box(0.015, 0.09, 0.015, M.wood, { x: sx * 0.105, y: 0.05, z: -0.4 + k * 0.2 }));
  g.add(templeRoof(0.92, 0.28, 0.05, M.dark, { y: 0.14, ry: Math.PI / 2, kick: 0.02, t: 0.015 }));
  for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) g.add(cylinder(0.018, 0.018, 0.035, LANTERN, { x: sx * 0.14, y: 0.1, z: -0.375 + k * 0.15, segments: 6 }));
  mergeStatic(g);
  return g;
}

export default function build(): CityScene {
  const rand = rng(2024);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: mat(0x5d636b, { roughness: 0.95 }), side: mat(0x45484f) }));

  // Ground zones.
  const pav = M.pavement;
  root.add(patch(19.6, 3.55, pav, { z: -1.475 }));
  root.add(patch(11.6, 4.1, pav, { x: -3.9, z: 2.35 }));
  root.add(patch(5.6, 4.1, pav, { x: 6.9, z: 2.35 }));
  root.add(patch(11.6, 3.1, pav, { x: -3.9, z: 8.15 }));
  root.add(patch(5.6, 3.1, M.grass, { x: 6.9, z: 8.15 }));
  root.add(patch(11.6, 4.45, pav, { x: -3.9, z: -7.2 }));
  root.add(patch(5.6, 4.45, mat(0xd8cdb5), { x: 6.9, z: -7.2 }));
  root.add(patch(3.3, 1.3, mat(0xc9a98a), { x: 8.05, z: -6.9, h: 0.05 }));
  root.add(patch(5.0, 0.9, M.grass, { x: -6.5, z: -2.75, h: 0.05 }));
  root.add(patch(5.0, 0.9, M.grass, { x: 6.9, z: -2.75, h: 0.05 }));
  // Kerb strips close the 0.2 gap between the corner pavements and the cross street, so people waiting there stand on paving.
  for (const z of [4.5, 6.5]) {
    root.add(patch(11.6, 0.2, pav, { x: -3.9, z }));
    root.add(patch(5.6, 0.2, pav, { x: 6.9, z }));
  }

  // Sumida river: its surface sits low (0.02) so the road crosses it on a thin deck with open water underneath.
  root.add(patch(19.6, 1.5, waterMat(0x4fa3d1), { z: -4.0, h: 0.02 }));
  // Kerbs stop short of the road so they do not cross the bridge carriageway.
  for (const z of [-4.81, -3.19]) {
    root.add(patch(11.9, 0.12, M.concrete, { x: -3.85, z, h: 0.08 }));
    root.add(patch(5.9, 0.12, M.concrete, { x: 6.85, z, h: 0.08 }));
  }

  // Streets: Shibuya crossing at (3, 5.5).
  root.add(road(3, 9.8, 3, -2.95, 1.8, { material: ROAD }));
  root.add(road(3, -5.05, 3, -9.8, 1.8, { material: ROAD }));
  // Sumida road bridge: ramps up from both banks to a deck over a low arch, so the boats pass underneath.
  const DECK = 0.38;
  const bridgeY = (z: number) => {
    const a = Math.abs(z + 4.0);
    return a <= 0.85 ? DECK : a >= 1.7 ? 0.05 : DECK - ((DECK - 0.05) * (a - 0.85)) / 0.85;
  };
  const arch: [number, number][] = [];
  for (let k = 0; k <= 10; k++) {
    const u = 0.8 - (1.6 * k) / 10;
    arch.push([u, 0.05 + 0.27 * Math.sqrt(Math.max(0, 1 - (u / 0.8) ** 2))]);
  }
  const deckTop: [number, number][] = [[-1.7, 0.05], [-0.85, DECK], [0.85, DECK], [1.7, 0.05]];
  root.add(profile([...deckTop, [0.8, 0.05], ...arch, [-1.7, 0.05]], 1.8, M.concrete, { x: 3, z: -4.0, ry: Math.PI / 2 }));
  root.add(profile([...deckTop, ...deckTop.map(([u, y]): [number, number] => [u, y + 0.012]).reverse()], 1.7, ROAD, { x: 3, z: -4.0, ry: Math.PI / 2 }));
  for (const px of [2.12, 3.88]) root.add(profile([...deckTop, ...deckTop.map(([u, y]): [number, number] => [u, y + 0.1]).reverse()], 0.05, M.white, { x: px, z: -4.0, ry: Math.PI / 2 }));
  const avenueY = (x: number, z: number) => (Math.abs(x - 3) < 0.9 ? bridgeY(z) + 0.012 : 0.05);
  root.add(road(-9.8, 5.5, 9.8, 5.5, 1.8, { material: ROAD, lines: false }));
  root.add(patch(1.8, 1.8, ROAD, { x: 3, z: 5.5, h: 0.055 }));
  // Centre line over the bridge.
  root.add(profile([...deckTop, ...deckTop.map(([u, y]): [number, number] => [u, y + 0.012]).reverse()], 0.02, M.roadLine, { x: 3, y: 0.002, z: -4.0, ry: Math.PI / 2 }));
  const zebra = (x: number, z: number, alongZ: boolean) => {
    for (let i = 0; i < 8; i++) {
      const o = -0.77 + i * 0.22;
      root.add(alongZ ? box(0.1, 0.012, 0.4, M.roadLine, { x: x + o, y: 0.05, z }) : box(0.4, 0.012, 0.1, M.roadLine, { x, y: 0.05, z: z + o }));
    }
  };
  zebra(3, 4.2, true);
  zebra(3, 6.8, true);
  zebra(4.3, 5.5, false);
  zebra(1.7, 5.5, false);
  for (const s of [-1, 1]) {
    for (let i = -4; i <= 4; i++) root.add(box(0.1, 0.012, 0.18, M.roadLine, { x: 3 + i * 0.2, y: 0.058, z: 5.5 + s * i * 0.2, ry: s * Math.PI / 4 }));
  }
  // The scramble crowd waits on the corners and crosses every way in the all-red phase.
  root.add(scrambleCrowd(anim, rand, 48));
  // Further crossings on the avenue and the cross street.
  root.add(crosswalk(3, 0.9, 1.8));
  root.add(crosswalk(3, 8.6, 1.8));
  root.add(crosswalk(-4.2, 5.5, 1.8, { ry: Math.PI / 2 }));
  root.add(crosswalk(8.2, 5.5, 1.8, { ry: Math.PI / 2 }));

  // Shibuya screens: corner building facing the crossing.
  root.add(midrise(1.0, 3.4, 1.8, 2.0, 3.4, 0, rand));
  root.add(adBoard(1.3, 0.8, 0xff4f8b, { x: 0.9, y: 2.2, z: 4.45 }));
  root.add(adBoard(0.9, 1.2, 0x2fd0ff, { x: 1.97, y: 1.4, z: 3.4, ry: Math.PI / 2 }));
  root.add(adBoard(0.9, 0.7, 0xffd23f, { x: 1.97, y: 2.5, z: 3.0, ry: Math.PI / 2 }));
  root.add(adBoard(1.2, 0.5, 0x7cff6b, { x: 0.8, y: 1.0, z: 4.45 }));
  // SHIBUYA109 opposite, its crown and entrance turned to the crossing, a second "109" toward the default view.
  root.add(shibuya109({ x: 5.2, z: 3.2 }, [Math.atan2(3 - 5.2, 5.5 - 3.2), Math.PI / 4]));

  // Dense blocks (left of crossing, right of crossing, front). Blocks on the camera side of Tokyo Tower's foot,
  // Skytree's base and 109 stay low so those read from the default view.
  const blocks: [number, number, number, number, number][] = [
    [-5.2, 2.0, 2.0, 2.4, 2.6], [-3.0, 2.4, 1.8, 3.0, 2.4], [-0.9, 2.2, 1.6, 2.6, 2.2],
    // Two pencil buildings, narrow and tall, beside the 109 block.
    [7.3, 3.2, 2.0, 2.2, 2.9], [5.15, 0.9, 0.9, 1.2, 3.1], [5.95, 0.9, 0.6, 1.2, 2.6], [7.4, 1.0, 2.0, 1.2, 1.8],
    [-6.4, 8.3, 2.0, 2.0, 1.5], [-4.2, 8.1, 2.0, 2.4, 2.1], [-2.0, 8.3, 2.0, 2.0, 1.4], [0.4, 8.1, 2.0, 2.4, 1.9],
    [-1.4, -6.2, 1.8, 1.6, 1.6], [0.8, -5.9, 1.4, 1.2, 2.1], [-0.9, -9.0, 1.8, 1.2, 2.4],
  ];
  blocks.forEach(([x, z, w, d, h], i) => root.add(midrise(x, z, w, d, h, i + 1, rand)));
  // Glass office towers (Shinjuku / Marunouchi style) at the left and right corners, where nothing stands behind
  // them in the default view: stepped, banded, with a mast.
  const GLASS = mat(0x6f8fa8, { roughness: 0.2, metalness: 0.5 });
  root.add(tower({ x: -8.6, z: 8.1, w: 2.0, d: 2.4, sections: [4.2, 1.6, 0.8], step: 0.3, wall: GLASS, windows: 'bands', spire: 0.6 }));
  root.add(tower({ x: 9.0, z: 2.6, w: 1.2, d: 2.2, sections: [3.4, 1.2], step: 0.25, wall: M.glassDark, windows: 'bands', spire: 0.4 }));
  // Asahi: the golden beer-glass tower under its white foam crown, and the black Super Dry Hall with the Flamme d'Or.
  root.add(building({ x: 0.25, z: -7.55, w: 1.1, d: 1.3, h: 3.4, wall: mat(0xd6a53a, { roughness: 0.4, metalness: 0.3 }), roof: 'flat', windows: 'bands' }));
  root.add(box(1.18, 0.3, 1.38, M.white, { x: 0.25, y: 3.4, z: -7.55 }));
  root.add(box(1.08, 0.08, 1.28, M.white, { x: 0.25, y: 3.7, z: -7.55 }));
  root.add(superDryHall({ x: 1.45, z: -8.95 }));

  // Landmarks.
  root.add(skytree({ x: -3.4, z: -7.6 }));
  root.add(tokyoTower({ x: -8.0, z: 1.8 }));
  root.add(fuji({ x: -7.4, z: -7.4 }));

  // Senso-ji, seen as from Kaminarimon-dori: the gate stands at the plinth's right edge with its lantern and the
  // Fujin/Raijin niches facing out (+x, toward the default camera), the Nakamise lane runs left past three shops a
  // side to the incense burner and the hall, whose front faces back down the lane toward the gate and the camera.
  // Gate (0.88) and hall (0.92) are scaled so the lane between them holds the three shops; the hall stays the taller.
  const gateK = kaminarimon({ x: 9.0, z: -6.9, ry: Math.PI / 2 });
  gateK.scale.setScalar(0.88);
  root.add(gateK);
  const hall = mainHall({ x: 5.25, z: -6.9, ry: Math.PI / 2 });
  hall.scale.setScalar(0.92);
  root.add(hall);
  // The pagoda stands to the side of the approach, behind the gate's south corner.
  const pag = pagoda({ x: 8.75, z: -9.25 });
  pag.scale.setScalar(0.7);
  root.add(pag);
  root.add(box(0.8, 0.5, 0.7, TEMPLE_RED, { x: 7.2, z: -9.05 }));
  root.add(templeRoof(1.2, 1.0, 0.4, TEMPLE_ROOF, { x: 7.2, y: 0.5, z: -9.05, kick: 0.07 }));
  for (let i = 0; i < 3; i++) {
    const sx = 6.95 + i * 0.55;
    root.add(stall({ x: sx, z: -6.0, ry: Math.PI }, i));
    root.add(stall({ x: sx, z: -7.8 }, i + 1));
    // Lantern string across the lane between the stall roofs.
    root.add(beam([sx, 0.6, -6.0], [sx, 0.6, -7.8], 0.01, M.dark));
    for (const lz of [-6.45, -6.75, -7.05, -7.35]) root.add(cylinder(0.055, 0.055, 0.12, LANTERN, { x: sx, y: 0.46, z: lz, segments: 8 }));
  }
  // Incense burner (jokoro) in the lane at the foot of the hall steps.
  root.add(cylinder(0.16, 0.2, 0.22, M.stone, { x: 6.7, z: -6.9, segments: 8 }));
  root.add(cylinder(0.07, 0.07, 0.12, M.dark, { x: 6.7, y: 0.22, z: -6.9, segments: 6 }));
  root.add(templeRoof(0.36, 0.36, 0.14, TEMPLE_ROOF, { x: 6.7, y: 0.34, z: -6.9, ridge: 0, kick: 0.04, t: 0.02 }));
  root.add(scatter({ x: 7.45, z: -6.9, w: 1.3, d: 0.7 }, 7, rand, (x, z, i) => tokyoite(x, z, i), (x, z) => Math.hypot(x - 6.7, z + 6.9) < 0.34));
  // Visitors at the gate's outer face, looking up at the lantern.
  for (const [z, i] of [[-6.6, 2], [-7.25, 5], [-6.9, 9]]) root.add(tokyoite(9.75, z, i, -Math.PI / 2));
  // Pilgrims walking the lane, salarymen on the river-side pavement and a few strollers along the park edge.
  for (let i = 0; i < 4; i++) root.add(anim.follow(tokyoite(0, 0, i, undefined, i === 2), [[7.0, -6.55], [8.25, -6.55], [8.25, -7.25], [7.0, -7.25]], 0.3, i / 4, true));
  for (let i = 0; i < 3; i++) root.add(anim.follow(tokyoite(0, 0, i + 4, undefined, i === 1), [[4.8, 6.68], [9.3, 6.68], [9.3, 6.9], [4.8, 6.9]], 0.35, i / 3, true));
  for (let i = 0; i < 3; i++) root.add(anim.follow(tokyoite(0, 0, i + 1), [[-6.0, -0.45], [1.3, -0.45], [1.3, 0.35], [-6.0, 0.35]], 0.38, i / 3, true));
  for (let i = 0; i < 2; i++) root.add(anim.follow(tokyoite(0, 0, i + 6, undefined, i === 0), [[4.6, -0.5], [9.3, -0.5], [9.3, 0.1], [4.6, 0.1]], 0.36, i / 2, true));

  // Cherry blossoms.
  root.add(row(-9.2, -2.8, -4.0, -2.8, 6, (x, z) => tree({ x, z, s: 0.8, kind: 'blossom' })));
  root.add(row(5.2, -2.8, 9.2, -2.8, 4, (x, z) => tree({ x, z, s: 0.8, kind: 'blossom' })));
  // Hachiko plaza: a paved corner of the park at the crossing, the statue in profile, people waiting by it.
  const plaza = (x: number, z: number) => x < 5.9 && z < 8.0;
  root.add(patch(1.6, 1.25, M.pavement, { x: 4.9, z: 7.22, h: 0.05 }));
  root.add(hachiko({ x: 4.5, y: 0.05, z: 7.45, ry: -Math.PI / 2 }));
  for (const [x, z, i] of [[4.95, 7.65, 3], [5.25, 7.25, 8], [4.2, 7.05, 5]]) root.add(tokyoite(x, z, i, Math.atan2(4.5 - x, 7.45 - z)));
  const parkTrees: [number, number][] = [];
  root.add(scatter({ x: 6.9, z: 8.15, w: 4.6, d: 2.2 }, 8, rand, (x, z) => {
    parkTrees.push([x, z]);
    return tree({ x, z, s: 0.9, kind: 'blossom' });
  }, plaza));
  root.add(row(4.8, 9.4, 9.4, 9.4, 4, (x, z) => bench({ x, z, ry: Math.PI })));
  // Park visitors stay clear of the plaza, trunks and the bench row.
  root.add(scatter({ x: 6.9, z: 8.15, w: 4.6, d: 2.2 }, 8, rand, (x, z, i) => tokyoite(x, z, i), (x, z) => plaza(x, z) || z > 9.1 || parkTrees.some(([tx, tz]) => Math.hypot(x - tx, z - tz) < 0.32)));
  root.add(row(-9.4, 6.65, 1.4, 6.65, 6, (x, z) => tree({ x, z, s: 0.55, kind: 'blossom' })));
  // Fallen petals drift on the park lawn and the river banks.
  const PETAL = mat(0xf6cfdc);
  const petal = (x: number, z: number, y: number) => box(0.06, 0.006, 0.05, PETAL, { x, y, z, ry: rand() * Math.PI });
  root.add(scatter({ x: 6.9, z: 8.15, w: 4.6, d: 2.2 }, 70, rand, (x, z) => petal(x, z, 0.04), plaza));
  for (const x of [-6.6, 7.2]) root.add(scatter({ x, z: -2.75, w: x < 0 ? 4.8 : 3.8, d: 0.8 }, 40, rand, (px, pz) => petal(px, pz, 0.05)));

  // Elevated Shinkansen line: deck, parapets between the stations, rails, piers and catenary masts with arms.
  const deckZ = -1.5;
  const STATION_L = 3.4;
  const stationX = 9.8 - STATION_L / 2;
  root.add(box(19.6, 0.14, 1.3, M.concrete, { y: 1.1, z: deckZ }));
  for (const s of [-1, 1]) root.add(box(2 * (9.8 - STATION_L), 0.1, 0.06, M.dark, { y: 1.24, z: deckZ + s * 0.62 }));
  for (const z of [-1.7, -1.3]) root.add(box(19.6, 0.02, 0.05, M.steel, { y: 1.24, z }));
  for (let x = -9.5; x <= 9.5; x += 2) {
    if (Math.abs(x - 3) < 1.3) continue;
    root.add(box(0.28, 1.1, 0.5, M.concrete, { x, z: deckZ }));
  }
  for (let x = -5.5; x <= 6; x += 2.2) {
    root.add(cylinder(0.02, 0.02, 0.55, M.steel, { x, y: 1.24, z: deckZ - 0.58, segments: 5 }));
    root.add(box(0.02, 0.02, 0.75, M.steel, { x, y: 1.74, z: deckZ - 0.22 }));
  }
  // Stations at both ends: platforms, lit glass screens, posts, a vaulted canopy with lights under it, and a
  // glazed concourse under the viaduct with an entrance and a name board.
  const vault: [number, number][] = [];
  for (let k = 0; k <= 8; k++) {
    const u = -0.72 + (1.44 * k) / 8;
    vault.push([u, 1.78 + 0.1 * (1 - (u / 0.72) ** 2)]);
  }
  for (const sx of [-1, 1]) {
    const cx = sx * stationX;
    for (const s of [-1, 1]) {
      root.add(box(STATION_L, 0.08, 0.22, M.concrete, { x: cx, y: 1.24, z: deckZ + s * 0.53 }));
      root.add(box(STATION_L, 0.22, 0.02, windowMaterial, { x: cx, y: 1.32, z: deckZ + s * 0.64 }));
      for (let k = 0; k < 5; k++) root.add(cylinder(0.018, 0.018, 0.47, M.steel, { x: cx - STATION_L / 2 + 0.2 + (k * (STATION_L - 0.4)) / 4, y: 1.32, z: deckZ + s * 0.6, segments: 5 }));
      root.add(box(STATION_L - 0.2, 0.015, 0.05, lampMaterial, { x: cx, y: 1.76, z: deckZ + s * 0.3 }));
    }
    root.add(profile([...vault, ...vault.map(([u, y]): [number, number] => [u, y - 0.04]).reverse()], STATION_L, SILVER, { x: cx, z: deckZ, ry: Math.PI / 2 }));
    root.add(building({ x: cx, z: deckZ, w: STATION_L - 0.3, d: 1.1, h: 0.95, wall: mat(0xb9bcbf), windows: 'bands', floorH: 0.45, roof: 'flat', plain: true }));
    root.add(box(0.5, 0.42, 0.03, M.dark, { x: cx, z: deckZ + 0.56 }));
    root.add(box(1.1, 0.16, 0.02, M.white, { x: cx, y: 0.55, z: deckZ + 0.57 }));
    root.add(box(0.14, 0.12, 0.01, M.grassDark, { x: cx - 0.4, y: 0.57, z: deckZ + 0.585 }));
    root.add(box(0.7, 0.04, 0.01, M.dark, { x: cx + 0.08, y: 0.61, z: deckZ + 0.585 }));
  }
  // Double-ended sets shuttle between the two terminals: dwell at the platform, run across, reverse.
  // Tips at -6.3 (set inside the left station) and 9.75 (inside the right one); the two tracks run half a trip apart.
  for (const [z, phase] of [[-1.7, 0], [-1.3, 0.5]]) root.add(shuttle(anim, shinkansen(), z, -6.3, 9.75, 3, 8, phase));

  // Streets: lamps (the ones nearest the crossing stand clear of the waiting crowd), traffic.
  root.add(row(-9.5, 4.55, 1.1, 4.55, 6, (x, z) => lamp({ x, z })));
  root.add(row(4.75, 6.45, 9.5, 6.45, 3, (x, z) => lamp({ x, z })));
  // Traffic keeps to the scramble's signals: cars queue at a red only when they reach it, and never enter the
  // crossing unless they can clear it before their green ends.
  for (const [from, to, stopS, n, vmax, green, yAt] of [
    [[-9.6, 5.15], [9.6, 5.15], 10.65, 3, 1.3, CYCLE.street, undefined],
    [[9.6, 5.85], [-9.6, 5.85], 4.65, 3, 1.3, CYCLE.street, undefined],
    [[2.65, 9.6], [2.65, -9.6], 2.25, 4, 1.2, CYCLE.avenue, avenueY],
    [[3.35, -9.6], [3.35, 9.6], 13.25, 4, 1.2, CYCLE.avenue, avenueY],
  ] as const) {
    const cars = Array.from({ length: n }, (_, i) => pm(car({ taxi: i % 2 === (stopS > 5 ? 0 : 1) })));
    for (const c of signalLane(anim, cars, [...from], [...to], stopS, 19.2 / n, green, vmax, yAt)) root.add(c);
  }

  // River boats circulate on one loop: eastbound along the south lane, a U-turn short of each plinth edge,
  // westbound along the north lane, all at one speed and a quarter loop apart, passing under the road bridge.
  const loop: [number, number][] = [];
  for (const [cx, a0] of [[8.7, -Math.PI / 2], [-8.7, Math.PI / 2]] as const) {
    for (let k = 0; k <= 8; k++) {
      const a = a0 + (Math.PI * k) / 8;
      loop.push([cx + 0.25 * Math.cos(a), -4.0 + 0.25 * Math.sin(a)]);
    }
  }
  const boats: [THREE.Object3D, number, number][] = [
    [withWake(pm(boat({ y: 0.01, color: 0xe8d27a, len: 0.9 })), -0.45, 0.2), 0.012, 1.4],
    [withWake(waterBus(), -0.5, 0.2, 0.9), 0.01, 1.2],
    [withWake(pm(boat({ y: 0.01, color: 0xf4f4f0, len: 0.7 })), -0.35, 0.2), 0.012, 1.4],
    [withWake(yakatabune(), -0.5, 0.24, 0.5), 0.008, 1.1],
  ];
  boats.forEach(([b, amp, freq], i) => root.add(anim.bob(anim.follow(b, loop, 0.45, i / 4, true), amp, freq)));
  // A water-bus landing on the north bank (pontoon, shelter, gangway) and two boats moored on the south bank.
  root.add(box(1.4, 0.04, 0.22, M.wood, { x: -6.5, y: 0.02, z: -3.42 }));
  root.add(box(0.3, 0.03, 0.12, M.wood, { x: -6.5, y: 0.05, z: -3.27 }));
  for (const sx of [-1, 1]) root.add(box(0.03, 0.2, 0.03, M.steel, { x: -6.5 + sx * 0.28, y: 0.06, z: -3.42 }));
  root.add(box(0.7, 0.03, 0.24, M.white, { x: -6.5, y: 0.26, z: -3.42 }));
  for (const [x, color] of [[-1.5, 0x3f7fb6], [6.2, 0xd9442b]] as const) root.add(boat({ x, y: 0.01, z: -4.64, color, len: 0.6, ry: Math.PI / 2 }));

  return { root, update: anim.update };
}
