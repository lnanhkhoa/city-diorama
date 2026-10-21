import * as THREE from 'three';
import {
  Animator, M, archHole, area, beam, box, building, car, cone, createBase, crosswalk, cylinder, dome, floodMat, group, hipRoof, lamp, mat,
  mergeStatic, patch, person, profile, rng, road, row, scatter, shape, tree, waterMat, windowMaterial, lampMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';
import CAMEL from '../shapes/camel.shape';
import FELUCCA from '../shapes/felucca.shape';
import SPHINX from '../shapes/sphinx.shape';

const SAND = mat(0xd9bb82);
const PAVE = mat(0xece0c0);
const ROCK = mat(0xb8935e, { roughness: 0.95 });
const STREET = mat(0xb89a68, { roughness: 0.95 });
const STONE = mat(0xd9a45a, { roughness: 0.95 });
const STONE_DARK = mat(0xc08c48, { roughness: 0.95 });
const CASING = mat(0xf1e6cf, { roughness: 0.8 });
const ALABASTER = mat(0xe6dcc3, { roughness: 0.7 });
const LEAD = mat(0x9ba6ad, { roughness: 0.55, metalness: 0.2 });
const WALLS = [mat(0xd9bd8c), mat(0xe3cba0), mat(0xcfae7a), mat(0xe8d4ac)];
const TOWER = mat(0xd6cab4);
const TOWER_LATTICE = mat(0xb4a68c);
const TOWER_SHAFT = mat(0x8f8472);
const DUNE = mat(0xcda262);
const NILE = waterMat(0x4f9fb8);
const GREEN = mat(0x7fae56);
const PLATEAU = mat(0xcaa874);
const ROAD = mat(0x6a6460, { roughness: 0.95 });

const STONE_LIGHT = mat(0xe3b86e, { roughness: 0.95 });
const NEMES_DARK = mat(0x8f6a38, { roughness: 0.9 });
const REED = mat(0x6f8f3e, { flat: true });
const STONE_FLOOD = floodMat(0xd9a45a, 0xffb866, 0.35, { roughness: 0.95 });
const TIMBER = mat(0x6b5436);
const TANK = mat(0x2f3d46);
const BX = -1.2; // Qasr el-Nil bridge, centre x
const GIZA_Y = 0.12;

// Square pyramid built from stacked, slightly stepped masonry courses. With a
// `cap`, the top 30% is a smooth casing (Khafre).
function pyramid(w: number, h: number, x: number, z: number, courses: number, cap?: THREE.Material): THREE.Group {
  const g = group({ x, z });
  const R = w / Math.SQRT2;
  const f = cap ? 0.7 : 1;
  const n = courses;
  const ch = (h * f) / n;
  for (let i = 0; i < n; i++) {
    const rb = R * (1 - (i / n) * f);
    const rt = R * (1 - ((i + 1) / n) * f) + (cap || i < n - 1 ? 0.018 * R : 0);
    g.add(cylinder(Math.max(rt, 0.001), rb, ch, i % 2 ? STONE_LIGHT : STONE, { y: i * ch, segments: 4, ry: Math.PI / 4 }));
  }
  if (cap) {
    const cw = w * (1 - f);
    g.add(hipRoof(cw * 1.01, cw * 1.01, h * (1 - f) * 1.01, cap, { y: h * f - 0.005 }));
  }
  g.add(cylinder(R * 0.96, R * 1.02, h * 0.04, STONE_DARK, { segments: 4, ry: Math.PI / 4 }));
  return g;
}

// Great Sphinx facing +x, baked from Rodin (scripts/rodin/assets.ts; the mesh's head points +z),
// on a sand-filled pit. Parts: headdress stripes, carved stone, both floodlit at night. ~3.6 long, 1.65 high.
function sphinx(p: Place): THREE.Group {
  const g = group(p);
  const pit: [number, number][] = Array.from({ length: 20 }, (_, i) => [Math.cos((i / 20) * Math.PI * 2) * 2.2, Math.sin((i / 20) * Math.PI * 2) * 0.75]);
  g.add(area(pit, DUNE, { h: 0.03 }));
  g.add(shape(SPHINX, [NEMES_DARK, STONE_FLOOD], { y: 0.03, ry: Math.PI / 2, height: 1.6, smooth: true }));
  return g;
}

// Open waisted hyperboloid lattice (diamond mesh of crossing beams around a thin
// shaft), a closed glazed cabin and an open lotus-bud crown of petal beams.
function cairoTower(p: Place): THREE.Group {
  const g = group(p);
  const H = 5.2;
  const y0 = 0.3;
  // Hyperbola: r 0.44 at the base, 0.26 at the waist (60% up), flaring to ~0.35 at the top.
  const radius = (t: number) => Math.sqrt(0.26 * 0.26 + 0.35 * (t - 0.6) * (t - 0.6)) + 0.02;
  g.add(cylinder(0.5, 0.62, y0, TOWER));
  g.add(cylinder(0.09, 0.11, H, TOWER_SHAFT, { y: y0, segments: 8 }));
  const tiers = 8;
  const cols = 10;
  const d = (Math.PI * 2) / cols;
  const P = (a: number, t: number): [number, number, number] => [Math.cos(a) * radius(t), y0 + t * H, Math.sin(a) * radius(t)];
  for (let t = 0; t < tiers; t++) {
    for (let i = 0; i < cols; i++) {
      const a = (i + 0.5 * (t % 2)) * d;
      g.add(beam(P(a, t / tiers), P(a + d / 2, (t + 1) / tiers), 0.045, TOWER_LATTICE));
      g.add(beam(P(a, t / tiers), P(a - d / 2, (t + 1) / tiers), 0.045, TOWER_LATTICE));
    }
  }
  // Horizontal rings at the foot, waist and neck.
  for (const t of [0, 4, 8]) {
    for (let i = 0; i < cols; i++) {
      const a = (i + 0.5 * (t % 2)) * d;
      g.add(beam(P(a, t / tiers), P(a + d, t / tiers), 0.05, TOWER));
    }
  }
  const top = y0 + H;
  // Closed cabin: tapered underside, glazed drum, roof ring.
  g.add(cylinder(0.62, 0.37, 0.25, TOWER, { y: top }));
  g.add(cylinder(0.6, 0.6, 0.4, windowMaterial, { y: top + 0.25, segments: 16 }));
  g.add(cylinder(0.66, 0.66, 0.06, TOWER, { y: top + 0.65, segments: 16 }));
  // Lotus bud: 8 open petals bulging out, then closing to the tip around a lit core.
  const c = top + 0.71;
  g.add(cylinder(0.14, 0.22, 1.0, lampMaterial, { y: c, segments: 8 }));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const at = (r: number, y: number): [number, number, number] => [Math.cos(a) * r, c + y, Math.sin(a) * r];
    g.add(beam(at(0.66, 0), at(0.8, 0.5), 0.05, TOWER_LATTICE));
    g.add(beam(at(0.8, 0.5), at(0.06, 1.55), 0.05, TOWER_LATTICE));
    g.add(beam(at(0.8, 0.5), [Math.cos(a + Math.PI / 4) * 0.8, c + 0.5, Math.sin(a + Math.PI / 4) * 0.8], 0.045, TOWER_LATTICE));
  }
  g.add(cylinder(0.012, 0.035, 0.7, M.steel, { y: c + 1.5, segments: 5 }));
  return g;
}

function minaret(x: number, z: number, h: number, s = 1): THREE.Group {
  const g = group({ x, z });
  const w = 0.15 * s;
  g.add(box(w * 2.2, h * 0.22, w * 2.2, ALABASTER));
  g.add(cylinder(w, w * 1.15, h * 0.4, ALABASTER, { y: h * 0.22, segments: 10 }));
  g.add(cylinder(w * 2.0, w * 2.0, 0.06, ALABASTER, { y: h * 0.62, segments: 10 }));
  g.add(cylinder(w * 0.85, w, h * 0.22, ALABASTER, { y: h * 0.62, segments: 10 }));
  g.add(cylinder(w * 1.8, w * 1.8, 0.06, ALABASTER, { y: h * 0.84, segments: 10 }));
  g.add(cylinder(w * 0.7, w * 0.8, h * 0.08, ALABASTER, { y: h * 0.84, segments: 10 }));
  g.add(cone(w * 0.9, h * 0.2, LEAD, { y: h * 0.92 - 0.02, segments: 10 }));
  // Gilded finial with a lamp at the tip.
  g.add(cylinder(0.008, 0.012, 0.16 * s, M.gold, { y: h * 1.12 - 0.03, segments: 4 }));
  g.add(cone(0.025 * s, 0.04 * s, lampMaterial, { y: h * 1.12 - 0.03 + 0.16 * s, segments: 6 }));
  return g;
}

function muhammadAli(p: Place): THREE.Group {
  const g = group(p);
  // Raised citadel plateau with walls + round towers.
  g.add(box(6.6, 1.0, 6.0, PLATEAU));
  g.add(box(6.8, 0.12, 6.2, STONE_DARK, { y: 0.9 }));
  for (const [x, z] of [[-3.3, -3.0], [3.3, -3.0], [3.3, 3.0], [-3.3, 3.0]] as const) {
    g.add(cylinder(0.4, 0.45, 1.3, PLATEAU, { x, z, segments: 10 }));
    g.add(cylinder(0.46, 0.4, 0.14, STONE_DARK, { x, z, y: 1.3, segments: 10 }));
  }
  // Rim battlements (not over the corner towers or the gate), then a gate tower with an arched portal on the front wall.
  for (let i = 0; i < 14; i++) {
    const t = -2.6 + i * 0.4;
    if (Math.abs(t) > 0.7) for (const sz of [-1, 1]) g.add(box(0.2, 0.14, 0.1, PLATEAU, { x: t, y: 1.02, z: sz * 3.05 }));
  }
  for (let j = 0; j < 11; j++) for (const sx of [-1, 1]) g.add(box(0.1, 0.14, 0.2, PLATEAU, { x: sx * 3.35, y: 1.02, z: -2.0 + j * 0.4 }));
  g.add(box(1.3, 0.55, 0.4, PLATEAU, { y: 1.02, z: 2.85 }));
  g.add(box(1.4, 0.07, 0.5, STONE_DARK, { y: 1.57, z: 2.85 }));
  g.add(box(0.1, 0.2, 0.02, windowMaterial, { y: 1.2, z: 3.055 }));
  g.add(profile(archHole(0, 0.7, 0.4), 0.03, M.dark, { z: 3.012 }));
  const y = 1.0;
  // Mosque proper (set back).
  const mz = -1.0;
  g.add(box(2.7, 1.3, 2.7, ALABASTER, { y, z: mz }));
  g.add(box(2.8, 0.1, 2.8, STONE, { y: y + 1.3, z: mz }));
  // Drum (taller than the half-domes so its window slits clear them), then the central dome.
  g.add(cylinder(0.95, 1.0, 0.7, ALABASTER, { y: y + 1.4, z: mz, segments: 16 }));
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2;
    g.add(box(0.12, 0.25, 0.06, windowMaterial, { x: Math.sin(a) * 0.96, z: mz + Math.cos(a) * 0.96, y: y + 1.8, ry: a }));
  }
  g.add(dome(1.0, LEAD, { y: y + 2.1, z: mz, segments: 20, squash: 1.0 }));
  g.add(cylinder(0.02, 0.02, 0.4, M.gold, { y: y + 3.1, z: mz, segments: 4 }));
  // Four half-domes: quarter-spheres whose flat cut faces the central mass, stepping down from it.
  const halfGeo = new THREE.SphereGeometry(0.85, 14, 7, 0, Math.PI, 0, Math.PI / 2);
  halfGeo.scale(1, 0.55, 1);
  for (const [dx, dz, ry] of [[0.5, 0, Math.PI / 2], [-0.5, 0, -Math.PI / 2], [0, 0.5, 0], [0, -0.5, Math.PI]] as const) {
    const half = new THREE.Mesh(halfGeo, LEAD);
    half.position.set(dx, y + 1.4, mz + dz);
    half.rotation.y = ry;
    g.add(half);
  }
  for (const [dx, dz] of [[1.2, 1.2], [-1.2, 1.2], [1.2, -1.2], [-1.2, -1.2]] as const) {
    g.add(cylinder(0.3, 0.3, 0.25, ALABASTER, { x: dx, z: mz + dz, y: y + 1.3, segments: 10 }));
    g.add(dome(0.34, LEAD, { x: dx, z: mz + dz, y: y + 1.55, segments: 10 }));
  }
  // Windows along the front face.
  g.add(box(2.0, 0.3, 0.04, windowMaterial, { y: y + 0.6, z: mz + 1.36 }));
  // Courtyard with arcade and domed fountain pavilion.
  g.add(patch(2.7, 2.0, mat(0xe4d6b8), { y: y + 0.1, z: 1.45 }));
  for (const sx of [-1, 1]) g.add(box(0.2, 0.5, 2.0, ALABASTER, { x: sx * 1.35, y: y + 0.1, z: 1.45 }));
  g.add(box(2.7, 0.5, 0.2, ALABASTER, { y: y + 0.1, z: 2.45 }));
  g.add(cylinder(0.3, 0.3, 0.3, ALABASTER, { y: y + 0.1, z: 1.45, segments: 8 }));
  g.add(dome(0.4, LEAD, { y: y + 0.4, z: 1.45, segments: 10, squash: 0.8 }));
  // Pencil minarets flanking the courtyard entrance.
  g.add(minaret(-1.0, 2.45, 4.0));
  g.add(minaret(1.0, 2.45, 4.0));
  // Fortress buildings beside.
  g.add(building({ w: 1.2, d: 2.4, h: 0.5, wall: WALLS[0], windows: 'none', plain: true, x: -2.5, y, z: 1.0 }));
  g.add(building({ w: 1.2, d: 2.2, h: 0.6, wall: WALLS[1], windows: 'none', plain: true, x: 2.5, y, z: 0.9 }));
  g.add(dome(0.35, LEAD, { x: 2.5, y: y + 0.6, z: 0.9, segments: 10 }));
  return g;
}

// Rodin-baked felucca (scripts/rodin/assets.ts), bow toward +z (the follow heading). Parts: hull, sail.
function felucca(): THREE.Group {
  return shape(FELUCCA, [mat(0x8a5a35, { roughness: 0.8 }), mat(0xf7f2e4, { roughness: 0.9 })], { height: 1.0, smooth: true });
}

// Rodin-baked camel (scripts/rodin/assets.ts), head toward +z. Parts: saddle blanket, body.
function camel(p: Place): THREE.Group {
  return shape(CAMEL, [M.red, mat(0xb98a55)], { ...p, height: 0.45, smooth: true });
}

function cairoHouse(x: number, z: number, w: number, d: number, h: number, i: number, domed = false, shop?: number): THREE.Group {
  const g = group({ x, z });
  const wall = WALLS[i % WALLS.length];
  const side = i % 2 ? -1 : 1;
  // Mashrabiya: a projecting timber bay with a lit lattice slit, on the upper floor of every house.
  const bay = (bx: number): void => {
    g.add(box(w * 0.36, 0.3, 0.1, TIMBER, { x: bx, y: h * 0.58, z: d / 2 + 0.05 }));
    g.add(box(w * 0.28, 0.16, 0.02, windowMaterial, { x: bx, y: h * 0.58 + 0.07, z: d / 2 + 0.105 }));
  };
  if (shop !== undefined) {
    g.add(building({ w, d, h, wall, trim: ALABASTER, windows: 'grid', shop, floorH: 0.5, roof: 'flat' }));
    bay(side * w * 0.25);
    if (i % 2 === 0) g.add(box(w * 0.5, 0.3, d * 0.45, wall, { y: h + 0.12, x: w * 0.12 })); // roof-top room
  } else {
    g.add(box(w, h, d, wall));
    g.add(box(w + 0.1, 0.07, d + 0.1, ALABASTER, { y: h }));
    // Arched door and two arched ground-floor windows, the mashrabiya bay above the door.
    g.add(profile(archHole(0, 0.26, 0.2), 0.03, TIMBER, { z: d / 2 + 0.01 }));
    for (const sx of [-1, 1]) g.add(profile(archHole(0, 0.14, 0.08), 0.03, windowMaterial, { x: sx * w * 0.3, y: h * 0.3, z: d / 2 + 0.01 }));
    bay(0);
    if (i % 2) g.add(box(w * 0.5, 0.25, d * 0.4, wall, { y: h + 0.07, x: -w * 0.1 }));
  }
  if (domed) {
    g.add(cylinder(Math.min(w, d) * 0.28, Math.min(w, d) * 0.3, 0.18, ALABASTER, { y: h + 0.08, segments: 10 }));
    g.add(dome(Math.min(w, d) * 0.3, mat(0x8fb0a0, { roughness: 0.6 }), { y: h + 0.26, segments: 10 }));
  } else if (i % 3 !== 0) {
    g.add(cylinder(0.08, 0.08, 0.16, TANK, { x: -side * w * 0.3, z: -d * 0.2, y: h + 0.08, segments: 8 }));
  }
  return g;
}

export default function build(): CityScene {
  const rand = rng(30);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: SAND, side: mat(0xc9a26b) }));

  // Giza: a raised rocky plateau (darker than the desert floor) carrying the dunes, pyramids and Sphinx.
  root.add(area([[-9.8, -9.8], [-0.1, -9.8], [-0.1, -3.0], [-1.0, -1.6], [-1.9, -1.1], [-1.9, 1.1], [-9.8, 1.1]], ROCK, { h: GIZA_Y }));
  const GALABEYA = [0xf1ece0, 0xe3d3ae, 0xc9a870, 0x7a5a3a, 0x1c1c20, 0x5d6f80, 0xf1ece0];
  const TOURIST = [0xd23f3f, 0x2f8fd0, 0xf2c230, 0x3fae6a, 0xe86fa3, 0xf1ece0];
  const cairene = (x: number, z: number, i: number, y: number) => person({ x, y, z, color: GALABEYA[i % GALABEYA.length] });
  const visitor = (x: number, z: number, i: number) => person({ x, y: GIZA_Y, z, color: i % 3 === 2 ? GALABEYA[(i * 2) % GALABEYA.length] : TOURIST[i % TOURIST.length] });
  const giza = group({ y: GIZA_Y });
  root.add(giza);
  // Low dunes behind and left of the pyramids.
  for (const [x, z, r] of [[-8.2, -7.6, 1.5], [-8.7, -5.5, 1.0], [-4.0, -8.9, 0.8]] as const) giza.add(dome(r, DUNE, { x, z, y: 0.02, segments: 16, squash: 0.3 }));

  // The three pyramids + queens' pyramids + Sphinx.
  giza.add(pyramid(4.4, 4.4, -4.6, -5.6, 16));
  giza.add(pyramid(3.4, 3.6, -8.0, -1.6, 12, CASING));
  giza.add(pyramid(2.0, 1.9, -1.3, -8.2, 8));
  for (const [x, z] of [[-1.6, -4.6], [-1.6, -6.0]] as const) giza.add(pyramid(0.7, 0.55, x, z, 3));
  giza.add(sphinx({ x: -4.3, z: 0.1 }));
  // Sphinx plaza lamps at the corners of the pit.
  for (const [x, z] of [[-6.7, -0.55], [-2.0, -0.55], [-6.7, 0.75], [-2.0, 0.75]] as const) {
    const l = lamp({ x, z, ry: x < -4.3 ? 0 : Math.PI });
    l.scale.setScalar(1.6);
    giza.add(l);
  }
  // Camels and visitors: two by the bridgehead on the paved plaza, one on the plateau.
  root.add(camel({ x: -0.2, y: 0.03, z: 0.0, ry: 1.2 }));
  root.add(camel({ x: 0.3, y: 0.03, z: 0.4, ry: 1.0 }));
  giza.add(camel({ x: -6.2, z: 1.0, ry: -0.4 }));
  // Visitors on the plateau between Khufu's front and the Sphinx pit; bright tourist shirts among the guides.
  const onMonument = (x: number, z: number) =>
    (Math.abs(x + 4.6) < 2.5 && Math.abs(z + 5.6) < 2.5) || (Math.abs(x + 1.6) < 0.6 && Math.abs(z + 5.3) < 1.3) ||
    (Math.abs(x + 8.0) < 1.9 && Math.abs(z + 1.6) < 2.0) || (Math.abs(x + 4.3) < 2.2 && Math.abs(z - 0.1) < 0.9);
  root.add(scatter({ x: -3.8, z: -2.1, w: 4.2, d: 1.8 }, 9, rand, (x, z, i) => visitor(x, z, i), onMonument));
  const walk: [number, number][] = [[-5.6, -2.3], [-2.0, -2.3], [-2.0, -1.8], [-5.6, -1.8]];
  for (let i = 0; i < 3; i++) root.add(anim.follow(visitor(0, 0, i + 3), walk, 0.25, i / 3, true));

  // Nile (runs along x), green banks.
  const NZ = 3.0;
  root.add(patch(19.6, 2.6, NILE, { x: 0, z: NZ, h: 0.05 }));
  for (const s of [-1, 1]) {
    root.add(patch(19.6, 0.4, GREEN, { x: 0, z: NZ + s * 1.5, h: 0.06 }));
    // Quay edge strip where the water meets the bank.
    root.add(patch(19.6, 0.1, mat(0xcdb88c), { x: 0, z: NZ + s * 1.33, h: 0.08 }));
  }
  // Reeds along both banks.
  root.add(scatter({ x: 0, z: NZ - 1.5, w: 19, d: 0.25 }, 22, rand, (x, z) => cone(0.05, 0.28, REED, { x, z, y: 0.05, segments: 4 })));
  root.add(scatter({ x: 0, z: NZ + 1.5, w: 19, d: 0.25 }, 22, rand, (x, z) => cone(0.05, 0.28, REED, { x, z, y: 0.05, segments: 4 })));
  // Gezira island with Cairo Tower (kept clear of the Sphinx sight line).
  const TX = 5.4;
  root.add(patch(4.6, 1.5, GREEN, { x: TX, z: NZ, h: 0.1 }));
  root.add(patch(2.2, 1.1, mat(0xcfc3a0), { x: TX, z: NZ, h: 0.12 }));
  root.add(cairoTower({ x: TX, y: 0.12, z: NZ }));
  root.add(row(TX - 1.8, NZ + 0.45, TX + 1.8, NZ + 0.45, 4, (x, z) => tree({ x, z, kind: 'palm', s: 1.3 })));
  root.add(row(TX - 1.8, NZ - 0.45, TX + 1.8, NZ - 0.45, 4, (x, z) => tree({ x, z, kind: 'round', s: 0.9 })));

  // Qasr el-Nil bridge: a hump deck with three arches the water runs through, parapets, four lions and lamps.
  // It runs along z and joins the Sphinx plaza (z 1.15) to the corniche (z 4.85).
  const deck: [number, number][] = [[-1.85, 0], [1.85, 0], [1.85, 0.08], [1.6, 0.3], [1.0, 0.6], [-1.0, 0.6], [-1.6, 0.3], [-1.85, 0.08]];
  // Arch feet are lifted to 0.04 so the holes do not share the slab's bottom edge.
  const arches = [archHole(-1.0, 0.5, 0.1, 8), archHole(0, 0.8, 0.1, 10), archHole(1.0, 0.5, 0.1, 8)]
    .map((h) => h.map(([x, y]) => [x, Math.max(y, 0.04)] as [number, number]));
  root.add(profile(deck, 0.9, STONE_LIGHT, { x: BX, z: NZ, ry: Math.PI / 2, holes: arches }));
  const rail = deck.slice(2, 8);
  const parapet: [number, number][] = [...rail, ...rail.slice().reverse().map(([x, y]) => [x, y + 0.1] as [number, number])];
  for (const sx of [-1, 1]) {
    root.add(profile(parapet, 0.06, ALABASTER, { x: BX + sx * 0.42, z: NZ, ry: Math.PI / 2 }));
    for (const sz of [-1, 1]) {
      // Lion on a pedestal at each bridgehead, head outward.
      const lion = group({ x: BX + sx * 0.3, y: 0.3, z: NZ + sz * 1.45 });
      lion.add(box(0.16, 0.14, 0.16, ALABASTER));
      lion.add(box(0.08, 0.07, 0.16, STONE_LIGHT, { y: 0.14 }));
      lion.add(box(0.07, 0.08, 0.06, STONE_LIGHT, { y: 0.17, z: sz * 0.09 }));
      root.add(lion);
      const l = lamp({ x: BX + sx * 0.33, y: 0.6, z: NZ + sz * 0.7, ry: sx > 0 ? Math.PI : 0 });
      l.scale.setScalar(1.6);
      root.add(l);
    }
  }

  // Felucca sailboats.
  // The bridge blocks the channel, so each lane runs from under it to the plinth edge (one boat per lane).
  const lanes: [[number, number][], number, number][] = [
    [[[BX, 1.95], [-9.4, 1.95]], 0.5, 0.0],
    [[[-9.4, 4.05], [BX, 4.05]], 0.4, 0.5],
    [[[BX, 1.95], [9.4, 1.95]], 0.5, 0.3],
    [[[9.4, 4.05], [BX, 4.05]], 0.4, 0.8],
  ];
  lanes.forEach(([path, sp, off], i) => {
    const b = felucca();
    b.position.y = 0.03;
    b.scale.setScalar(0.9 + (i % 2) * 0.15);
    mergeStatic(b);
    root.add(anim.bob(anim.follow(b, path, sp, off), 0.02, 1.4));
  });

  // Paved ground (lighter than the desert floor): the Sphinx / bridgehead plaza, the Islamic Cairo blocks and Old Cairo.
  root.add(patch(2.8, 2.1, PAVE, { x: -0.5, z: 0.15, h: 0.03 }));
  root.add(patch(19.6, 4.15, PAVE, { x: 0, z: 7.725, h: 0.03 }));
  root.add(patch(8.9, 4.6, PAVE, { x: 5.35, z: -1.1, h: 0.03 }));
  // Old Cairo lanes: dusty streets between the blocks.
  root.add(road(0.0, 0.3, 9.7, 0.3, 0.55, { material: STREET, lines: false }));
  root.add(road(3.45, 0.3, 3.45, -3.2, 0.5, { material: STREET, lines: false }));

  // Corniche road along the east bank, and city streets.
  root.add(road(-9.8, 5.2, 9.8, 5.2, 0.9, { material: ROAD }));
  root.add(road(-4.5, 5.6, -4.5, 9.8, 0.7, { material: ROAD }));
  root.add(road(1.0, 5.6, 1.0, 9.8, 0.7, { material: ROAD }));
  const lanesC: [number, number][][] = [[[-9.6, 5.05], [9.6, 5.05]], [[9.6, 5.35], [-9.6, 5.35]]];
  lanesC.forEach((path, li) => {
    for (let i = 0; i < 4; i++) {
      const c = car({ y: 0.05 });
      mergeStatic(c);
      root.add(anim.follow(c, path, 1.2, i / 4 + li * 0.12));
    }
  });
  const sideRoads: [[number, number][], number][] = [[[[1.0, 9.6], [1.0, 5.6]], 0.2], [[[-4.5, 5.6], [-4.5, 9.6]], 0.5]];
  for (const [path, off] of sideRoads) {
    const c = car({ y: 0.05 });
    mergeStatic(c);
    root.add(anim.follow(c, path, 0.8, off));
  }
  // Palms along the corniche; the one at x = -1.88 would run into the bridge deck.
  root.add(row(-9.4, 4.65, 9.4, 4.65, 11, (x, z, i) => (i === 4 ? group() : tree({ x, z, kind: 'palm', s: 1.0 }))));
  // Corniche streetlamps between the palms, arms over the road (the slot at x = -0.94 is the bridge).
  root.add(row(-8.46, 4.76, 8.46, 4.76, 10, (x, z, i) => {
    if (i === 4) return group();
    const l = lamp({ x, z, ry: -Math.PI / 2 });
    l.scale.setScalar(1.6);
    return l;
  }));

  // Islamic Cairo: sand-coloured blocks, small domes and minarets (front).
  const houses: [number, number, number, number, number, boolean][] = [
    [-8.3, 7.4, 1.8, 1.6, 0.9, false], [-6.5, 8.6, 1.5, 1.3, 0.7, true], [-6.3, 6.5, 1.3, 1.1, 0.6, false],
    [-2.8, 7.2, 2.0, 1.6, 1.0, true], [-2.4, 9.0, 1.6, 1.2, 0.7, false], [-0.5, 8.2, 1.2, 1.8, 0.8, false],
    [2.9, 7.0, 1.9, 1.5, 0.8, false], [3.2, 8.9, 1.5, 1.3, 1.0, true], [5.4, 6.6, 1.1, 1.1, 0.6, false],
    [6.2, 8.3, 2.2, 1.8, 0.9, true], [8.5, 6.8, 1.4, 1.2, 0.8, false], [8.6, 8.9, 1.3, 1.5, 0.7, false],
  ];
  const AWNINGS = [0xb8412f, 0x2f6f8f, 0xd9a21b, 0x3f7f5a, 0x8a3b6e];
  houses.forEach(([x, z, w, d, h, dm], i) => root.add(cairoHouse(x, z, w, d, Math.max(1.25, h * 1.5) + (i % 3) * 0.2, i, dm, AWNINGS[i % AWNINGS.length])));
  // Zebra crossings at the side-street junctions (the mid-block ones had no street to cross to).
  root.add(crosswalk(-4.5, 6.2, 0.7, { ry: 0 }));
  root.add(crosswalk(1.0, 6.2, 0.7, { ry: 0 }));
  root.add(minaret(-3.6, 8.2, 2.6, 0.9));
  root.add(minaret(2.0, 8.0, 2.2, 0.8));
  root.add(minaret(7.5, 7.5, 2.4, 0.8));
  root.add(minaret(-7.5, 6.2, 2.0, 0.8));
  // Corniche promenade: the pavement strip between the road edge (z 5.65) and the house fronts (z >= 5.95).
  root.add(scatter({ x: 0, z: 5.8, w: 18.4, d: 0.12 }, 8, rand, (x, z, i) => cairene(x, z, i, 0.03), (x) => Math.abs(x + 4.5) < 0.45 || Math.abs(x - 1.0) < 0.45));
  const prom: [number, number][] = [[-9.0, 5.76], [9.0, 5.76], [9.0, 5.84], [-9.0, 5.84]];
  for (let i = 0; i < 5; i++) root.add(anim.follow(cairene(0, 0, i + 1, 0.03), prom, 0.35, i / 5, true));

  // Back right: Citadel + Muhammad Ali Mosque, with Old Cairo blocks.
  root.add(patch(8.2, 6.0, mat(0xdcc392), { x: 5.4, z: -6.4 }));
  root.add(muhammadAli({ x: 6.0, z: -6.2 }));
  const oldCairo: [number, number, number, number, number, boolean][] = [
    [0.8, -4.0, 1.2, 1.4, 0.8, false], [2.2, -2.4, 1.5, 1.3, 0.7, true], [4.8, -2.0, 1.7, 1.2, 0.8, false],
    [7.2, -1.6, 1.8, 1.3, 0.9, true], [9.0, -1.8, 1.3, 1.2, 0.7, false], [2.0, -5.2, 1.3, 1.5, 0.9, false],
    [1.8, -7.8, 1.5, 1.4, 0.8, true], [0.4, -2.2, 1.2, 1.3, 0.7, false],
  ];
  oldCairo.forEach(([x, z, w, d, h, dm], i) => root.add(cairoHouse(x, z, w, d, h + (i % 3) * 0.25, i + 1, dm)));
  root.add(minaret(0.8, -1.2, 2.4, 0.9));
  root.add(minaret(8.8, -0.5, 2.2, 0.8));
  // Old Cairo lane: people keep to the dusty street (deck top 0.05) and clear of the bridgehead camels.
  root.add(scatter({ x: 4.7, z: 0.3, w: 7.4, d: 0.4 }, 6, rand, (x, z, i) => cairene(x, z, i, 0.05), (x, z) => Math.hypot(x - 0.3, z - 0.4) < 0.5));
  const lane: [number, number][] = [[1.1, 0.2], [8.3, 0.2], [8.3, 0.4], [1.1, 0.4]];
  for (let i = 0; i < 3; i++) root.add(anim.follow(cairene(0, 0, i + 2, 0.05), lane, 0.3, i / 3, true));

  return { root, update: anim.update };
}
