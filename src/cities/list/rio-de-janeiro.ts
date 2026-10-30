import * as THREE from 'three';
import {
  Animator, M, area, beam, box, building, car, cone, createBase, crosswalk, cylinder, dome, floodMat, group, lamp, lampMaterial, mat,
  patch, patchSurface, person, prism, rng, road, row, scatter, shape, tree, boat, waterMat, windowMaterial, type Place,
} from '../../kit';
import type { CityScene } from '../types';
import CHRIST from '../shapes/christ-redeemer.shape';
import CORCOVADO_SHAPE from '../shapes/corcovado.shape';
import SUGARLOAF from '../shapes/sugarloaf.shape';

// Layout follows assets/rio-de-janeiro.jpeg (positions read off the poster through a homography fitted to the plinth
// corners, with the back corner predicted from the app camera). The Copacabana crescent runs along the whole front
// (z = +10) edge: sea, sand, the black-and-white wave promenade and Avenida Atlântica, backed by a wall of tall
// apartment blocks. A central avenue runs diagonally from the beach toward the back corner, between Corcovado with
// Christ (left) and Sugarloaf (right); a small bay sits behind them. On the right the Maracanã and the
// Maracanãzinho dome stand in front of a favela climbing terraces along the back and right edges.

const GROUND = mat(0xc9cbc8, { roughness: 0.9 });
const GRANITE = mat(0x8d8174, { roughness: 0.9, flat: true });
const FOREST = mat(0x3f7a36, { flat: true });
const SAND = mat(0xf0dcaa);
const SEA = waterMat(0x3f9fcf);
// Floodlit at night, as the real statue is.
const STATUE = floodMat(0xf6f5ef, 0xe4ecff, 0.6, { roughness: 0.6 });
// Stadium pitch under floodlights at night.
const PITCH = floodMat(0x5e9b46, 0x9fe07a, 0.35);
const PITCH_LIGHT = floodMat(0x74b257, 0xb5f08f, 0.35);
const TERRACE = mat(0x6d8a4c, { flat: true });
const FAVELA = [0xe8503a, 0xf2b630, 0x3aa0d8, 0x62b94e, 0xe66fa8, 0xf08a3c, 0x8a62c9, 0x2fb5a3, 0xf4e04d, 0xd9482f];
// Favela roofs: bare concrete slabs and a few clay tiles.
const FAVELA_ROOFS = [0xd9d3c7, 0xe8e2d6, 0xb9b3a7, 0xc9693f];
const UMBRELLAS = [0xe8503a, 0xf2b630, 0x3aa0d8, 0xe66fa8, 0x62b94e, 0xf08a3c];
// Beachwear: coral, turquoise, yellow, white, green, hot pink, sky blue.
const BEACHWEAR = [0xff6b5a, 0x1fc1c9, 0xffd23f, 0xffffff, 0x3fbf5f, 0xe66fa8, 0x3aa0d8, 0xf08a3c];
// Copacabana apartment walls as in the poster: concrete grey, sand, cream, salmon, blue-grey, white, taupe.
const FACADES = [0xbdbcb6, 0xdac9a6, 0xece5d3, 0xc98a6a, 0x9eabc2, 0xf1efe8, 0x8c8173, 0xd9c08f, 0xc7b8a4];

/** Copacabana's black-and-white wave paving, drawn in code: one wave and two stripes per tile, tiling both ways. */
function promenadeMaterial(): THREE.MeshStandardMaterial {
  const S = 128;
  const data = new Uint8Array(S * S * 4);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      const phase = (j / S) * 2 + 0.3 * Math.sin((i / S) * Math.PI * 2);
      const f = phase - Math.floor(phase);
      // Black stripe for the first 30% of each band, faded to grey over ~1.5 texels at both edges so it does not
      // shimmer when minified (one band is S / 2 texels).
      const edge = Math.min(1, (Math.min(f, Math.abs(f - 0.3), 1 - f) * S) / 2 / 1.5);
      const lum = 0.565 + ((f < 0.3 ? 0.18 : 0.95) - 0.565) * edge;
      const k = (j * S + i) * 4;
      data[k] = data[k + 1] = Math.round(255 * lum);
      data[k + 2] = Math.round(255 * Math.min(1, lum * 1.02));
      data[k + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, S, S);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1.3, 1.3);
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.75 });
  patchSurface(m, 'ground');
  return m;
}
let promenade: THREE.MeshStandardMaterial | undefined;

function ellipse(a: number, b: number, n = 36): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push([Math.cos(t) * a, Math.sin(t) * b]);
  }
  return pts;
}

/** Piecewise-linear z(x) through `[x, z]` points sorted by x. */
function curve(pts: [number, number][]): (x: number) => number {
  return (x) => {
    if (x <= pts[0][0]) return pts[0][1];
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, z0] = pts[k];
      const [x1, z1] = pts[k + 1];
      if (x <= x1) return z0 + ((x - x0) / (x1 - x0)) * (z1 - z0);
    }
    return pts[pts.length - 1][1];
  };
}

// Corcovado: baked Rodin massif (scripts/rodin/assets.ts), parts rainforest + granite, its sheer cliff on local +z. The
// bake is a steep tower of rock; the poster's mountain is a broad forested massif, so it is widened and turned so the
// forest climbs the flank facing the camera, the cliff toward the bay. Footprint (sampled) x -9.8..-2.1,
// z -7.8..0.1. The summit plateau (centre (0.012, 0.026) of the normalised footprint, terrain 0.998 of the height
// there) carries a viewing terrace and Christ.
const CORCOVADO = { x: -5.9, z: -3.8, h: 6.3, xz: 1.2, ry: (-3 * Math.PI) / 4 };
const SUMMIT = (() => {
  const { x, z, h, xz, ry } = CORCOVADO;
  const sx = 0.012 * h * xz;
  const sz = 0.026 * h * xz;
  return { x: x + sx * Math.cos(ry) + sz * Math.sin(ry), y: 0.995 * h, z: z - sx * Math.sin(ry) + sz * Math.cos(ry) };
})();
function corcovado(rand: () => number): THREE.Group {
  const { x, y, z } = SUMMIT;
  const g = group();
  const massif = shape(CORCOVADO_SHAPE, [FOREST, GRANITE], { x: CORCOVADO.x, z: CORCOVADO.z, height: CORCOVADO.h, ry: CORCOVADO.ry, xzScale: CORCOVADO.xz });
  g.add(massif, forestCover(massif, rand, 0.62, 0.95, 4.6));
  g.add(cylinder(0.62, 0.5, 0.14, M.white, { x, y: y - 0.06, z, segments: 14 }));
  g.add(cylinder(0.3, 0.34, 0.1, STATUE, { x, y: y + 0.08, z, segments: 8 }));
  // Christ the Redeemer: baked Rodin statue on its pedestal (one stone part), arms across x.
  g.add(shape(CHRIST, [STATUE], { x, y: y + 0.18, z, height: 2.4, smooth: true }));
  return g;
}

/**
 * Kit trees over the forest part (part 0) of a baked massif, up to `maxY`, so its rainforest reads as leafy canopy
 * as in the poster rather than as flat green facets. Heights come from rays cast down onto the bake.
 */
function forestCover(massif: THREE.Group, rand: () => number, step: number, s: number, maxY: number): THREE.Group {
  massif.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(massif);
  const forest = massif.children[0];
  const rc = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  const from = new THREE.Vector3();
  const g = group();
  for (let gx = bounds.min.x + step / 2; gx < bounds.max.x; gx += step) {
    for (let gz = bounds.min.z + step / 2; gz < bounds.max.z; gz += step) {
      const x = gx + (rand() - 0.5) * step * 0.8;
      const z = gz + (rand() - 0.5) * step * 0.8;
      if (Math.abs(x) > 9.6 || Math.abs(z) > 9.6) continue;
      rc.set(from.set(x, 50, z), down);
      const hit = rc.intersectObject(massif, true)[0];
      // Above 0.3 only: the skirt's thin edge runs under the streets and blocks around it.
      if (!hit || hit.object !== forest || hit.point.y < 0.3 || hit.point.y > maxY) continue;
      const ts = s * (0.8 + rand() * 0.4);
      g.add(tree({ x, y: hit.point.y - 0.1 * ts, z, kind: 'round', s: ts }));
    }
  }
  return g;
}

function gondola(): THREE.Group {
  const g = group();
  g.add(box(0.26, 0.2, 0.2, mat(0xd8392f, { roughness: 0.5 }), { y: -0.32 }));
  g.add(box(0.27, 0.07, 0.21, windowMaterial, { y: -0.29 }));
  g.add(box(0.3, 0.04, 0.24, M.white, { y: -0.12 }));
  g.add(box(0.03, 0.2, 0.03, M.steel, { y: -0.12 }));
  g.userData.dynamic = true;
  return g;
}

function cableCar(anim: Animator, a: [number, number, number], b: [number, number, number], count: number): THREE.Group {
  const g = group();
  g.add(beam(a, b, 0.035, M.steel));
  for (let i = 0; i < count; i++) {
    const gd = gondola();
    const ph = i / count;
    g.add(gd);
    anim.add((t) => {
      const u = 0.5 - 0.5 * Math.cos(t * 0.35 + ph * Math.PI * 2);
      gd.position.set(a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u);
    });
  }
  return g;
}

/**
 * Favela on terraces stepping up toward the plinth edge: along the back edge (rising toward -z) and down the right
 * edge (rising toward +x). One row of small painted houses on each terrace, some with a second storey.
 */
function favela(rand: () => number): THREE.Group {
  const g = group();
  const house = (x: number, y: number, z: number, ry: number, maxS: number) => {
    const s = Math.min(maxS, 0.36 + rand() * 0.16);
    const h = 0.24 + rand() * 0.2;
    const c = mat(FAVELA[Math.floor(rand() * FAVELA.length)]);
    g.add(box(s, h, s * (0.85 + rand() * 0.3), c, { x, y, z, ry }));
    g.add(box(s * 1.08, 0.04, s * 1.08, mat(FAVELA_ROOFS[Math.floor(rand() * FAVELA_ROOFS.length)]), { x, y: y + h, z, ry }));
    if (rand() < 0.3) {
      const s2 = s * 0.7;
      g.add(box(s2, 0.2, s2, mat(FAVELA[Math.floor(rand() * FAVELA.length)]), { x: x + (rand() - 0.5) * 0.08, y: y + h + 0.04, z, ry }));
    }
    // A lit window on the face toward the camera for two houses in three.
    if (rand() < 0.66) {
      const nx = Math.sin(ry);
      const nz = Math.cos(ry);
      g.add(box(s * 0.35, h * 0.35, 0.02, windowMaterial, { x: x + nx * s * 0.52, y: y + h * 0.4, z: z + nz * s * 0.52, ry }));
    }
  };
  // Back terraces: x 3.6..9.8 (right of Sugarloaf), front edges stepping back from z -7.5.
  const BACK = [-7.5, -8.1, -8.7, -9.25];
  BACK.forEach((z0, k) => {
    const y = 0.32 * (k + 1);
    g.add(box(6.2, y, -9.8 - z0, TERRACE, { x: 6.7, z: (z0 - 9.8) / 2 }));
    const zEnd = k + 1 < BACK.length ? BACK[k + 1] : -9.8;
    for (let x = 3.85 + rand() * 0.2; x < 9.55; x += 0.5 + rand() * 0.1) {
      house(x, y, (z0 + zEnd) / 2 + (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.25, (z0 - zEnd) * 0.9);
    }
  });
  // Right terraces: z -7.5..-1.9, front edges stepping right from x 8.8.
  const RIGHT = [8.8, 9.3];
  RIGHT.forEach((x0, k) => {
    const y = 0.32 * (k + 1);
    g.add(box(9.8 - x0, y, 5.6, TERRACE, { x: (x0 + 9.8) / 2, z: -4.7 }));
    const xEnd = k + 1 < RIGHT.length ? RIGHT[k + 1] : 9.8;
    for (let z = -2.15 - rand() * 0.2; z > -7.4; z -= 0.5 + rand() * 0.1) {
      house((x0 + xEnd) / 2 + (rand() - 0.5) * 0.04, y, z, Math.PI / 2 + (rand() - 0.5) * 0.25, (xEnd - x0) * 0.9);
    }
  });
  return g;
}

/** Maracanã: tiered bowl inside a colonnade, the white roof ring with radial ribs, floodlit pitch. Long axis on local x. */
function maracana(p: Place): THREE.Group {
  const g = group(p);
  const A = 2.9;
  const B = 2.55;
  const H = 1.1;
  g.add(prism(ellipse(A, B), H, mat(0xe9e6df), { holes: [ellipse(A - 0.3, B - 0.3)] }));
  // Glazed concourse band, lit at night.
  g.add(prism(ellipse(A + 0.02, B + 0.02), 0.12, windowMaterial, { y: 0.5, holes: [ellipse(A - 0.05, B - 0.05)] }));
  g.add(prism(ellipse(A - 0.3, B - 0.3), 0.85, mat(0x3d6fb0), { holes: [ellipse(A - 0.8, B - 0.8)] }));
  g.add(prism(ellipse(A - 0.8, B - 0.8), 0.45, mat(0x2f4f86), { holes: [ellipse(A - 1.15, B - 1.15)] }));
  // Roof ring on the colonnade.
  g.add(prism(ellipse(A + 0.25, B + 0.25), 0.1, M.white, { y: H, holes: [ellipse(A - 1.3, B - 1.3)] }));
  g.add(prism(ellipse(A + 0.27, B + 0.27), 0.05, M.dark, { y: H - 0.05, holes: [ellipse(A + 0.15, B + 0.15)] }));
  const rib = mat(0xc6cacf);
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    g.add(beam([c * (A - 1.25), H + 0.11, s * (B - 1.25)], [c * (A + 0.2), H + 0.11, s * (B + 0.2)], 0.025, rib));
  }
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    g.add(cylinder(0.045, 0.045, H, M.white, { x: Math.cos(a) * (A + 0.12), z: Math.sin(a) * (B + 0.12), segments: 5 }));
  }
  // Floodlights under the inner roof rim, aimed at the pitch.
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    g.add(box(0.16, 0.05, 0.05, lampMaterial, { x: Math.cos(a) * (A - 1.35), z: Math.sin(a) * (B - 1.35), y: H - 0.06, ry: -a }));
  }
  g.add(prism(ellipse(A - 1.12, B - 1.12), 0.04, PITCH));
  g.add(patch(2.6, 1.6, PITCH_LIGHT, { h: 0.05 }));
  g.add(patch(0.04, 1.6, M.white, { h: 0.06 }));
  return g;
}

/** Maracanãzinho: the round arena beside the stadium, a ribbed drum under a shallow white dome. */
function maracanazinho(p: Place): THREE.Group {
  const g = group(p);
  const R = 1.2;
  g.add(cylinder(R, R, 0.55, mat(0xe9e6df), { segments: 32 }));
  g.add(cylinder(R + 0.015, R + 0.015, 0.16, windowMaterial, { y: 0.2, segments: 32, open: true }));
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    g.add(box(0.06, 0.55, 0.06, M.white, { x: Math.cos(a) * (R + 0.03), z: Math.sin(a) * (R + 0.03), ry: -a }));
  }
  g.add(cylinder(R + 0.08, R + 0.08, 0.06, M.white, { y: 0.55, segments: 32 }));
  g.add(dome(R + 0.02, M.white, { y: 0.6, squash: 0.36, segments: 28 }));
  g.add(cylinder(0.22, 0.26, 0.08, mat(0xd8dde3), { y: 0.6 + (R + 0.02) * 0.36 - 0.02, segments: 12 }));
  return g;
}

function umbrella(x: number, z: number, color: number): THREE.Group {
  const g = group({ x, z });
  g.add(cylinder(0.018, 0.018, 0.4, M.white, { segments: 5 }));
  g.add(cone(0.26, 0.14, mat(color), { y: 0.38, segments: 8 }));
  g.add(patch(0.3, 0.45, mat(color), { x: 0.08, z: 0.3, ry: 0.4, h: 0.02, y: 0.04 }));
  return g;
}

export default function build(): CityScene {
  const rand = rng(2016);
  const anim = new Animator();
  const root = group();
  root.add(createBase({ top: GROUND, side: mat(0xb8a587) }));

  // --- Copacabana: sea, sand crescent, wave promenade, Avenida Atlântica (z 3.0..4.0). ---
  // The promenade is a band about 0.9 wide that widens toward both ends; the sand and the sea bow inland in the middle.
  const SAND_EDGE: [number, number][] = [[-9.8, 5.5], [-8.0, 5.15], [-5.0, 4.95], [0, 4.9], [4.0, 4.95], [7.0, 5.1], [9.8, 5.45]];
  const WATER_EDGE: [number, number][] = [[-9.8, 6.3], [-8.0, 6.55], [-5.0, 6.95], [-1.0, 7.15], [3.0, 7.3], [6.0, 7.75], [8.0, 8.5], [9.1, 9.8]];
  const sandZ = curve(SAND_EDGE);
  const waterZ = curve(WATER_EDGE);
  promenade ??= promenadeMaterial();
  root.add(area([[-9.8, 4.0], [9.8, 4.0], ...[...SAND_EDGE].reverse()], promenade, { h: 0.05 }));
  root.add(area([...SAND_EDGE, [9.8, 9.8], [-9.8, 9.8]], SAND, { h: 0.04 }));
  root.add(area([...WATER_EDGE, [-9.8, 9.8]], SEA, { h: 0.07 }));
  root.add(road(-9.8, 3.5, 9.8, 3.5, 1.0));

  // --- Central avenue: diagonal from the beach to the foot of the mountains (drawn just above the avenue it meets). ---
  const AV0: [number, number] = [3.2, 3.2];
  const AV1: [number, number] = [-2.3, -2.3];
  const central = road(AV0[0], AV0[1], AV1[0], AV1[1], 1.1);
  central.position.y = 0.006;
  root.add(central);
  root.add(cylinder(0.75, 0.75, 0.05, M.asphalt, { x: AV1[0], z: AV1[1], segments: 16 }));

  // --- Mountains and the bay behind them. ---
  root.add(area([[-9.8, -9.8], [-3.4, -9.8], [-3.6, -8.6], [-5.2, -8.0], [-7.4, -7.9], [-9.8, -7.7]], SAND, { h: 0.04 }));
  root.add(area([[-9.8, -9.8], [-3.8, -9.8], [-4.0, -9.0], [-5.3, -8.45], [-7.4, -8.35], [-9.8, -8.2]], SEA, { h: 0.07 }));
  root.add(corcovado(rand));
  // Sugarloaf with its Urca shoulder: baked Rodin massif (forest skirt, bare granite), long axis along the back edge.
  // Footprint (sampled) x -4.7..3.5, z -9.8..-4.0; summit at (-0.15, 5.38, -7.1).
  const sugarloaf = shape(SUGARLOAF, [FOREST, GRANITE], { x: -0.6, z: -6.9, ry: Math.PI / 2, height: 5.4 });
  root.add(sugarloaf, forestCover(sugarloaf, rand, 0.62, 0.9, 3.6));
  // Cable car as the poster draws it: from Christ's terrace across the saddle to the Sugarloaf summit station. The
  // rope clears both slopes by at least 0.3 under the cabins (sampled off the bakes).
  const TOP = { x: -0.15, y: 5.38, z: -7.1 };
  const toSugar = Math.atan2(TOP.x - SUMMIT.x, TOP.z - SUMMIT.z);
  const ropeA: [number, number, number] = [SUMMIT.x + Math.sin(toSugar) * 0.5, SUMMIT.y + 0.37, SUMMIT.z + Math.cos(toSugar) * 0.5];
  const ropeB: [number, number, number] = [TOP.x, TOP.y + 0.7, TOP.z];
  root.add(box(0.36, 0.42, 0.3, M.white, { x: ropeA[0], y: SUMMIT.y - 0.1, z: ropeA[2], ry: toSugar }));
  root.add(box(0.46, 0.74, 0.46, M.white, { x: TOP.x, y: TOP.y - 0.12, z: TOP.z, ry: toSugar }));
  root.add(box(0.56, 0.1, 0.56, M.red, { x: TOP.x, y: TOP.y + 0.62, z: TOP.z, ry: toSugar }));
  root.add(box(0.3, 0.22, 0.02, windowMaterial, { x: TOP.x - Math.sin(toSugar) * 0.24, y: TOP.y + 0.2, z: TOP.z - Math.cos(toSugar) * 0.24, ry: toSugar }));
  root.add(cableCar(anim, ropeA, ropeB, 2));
  // Trees between the end of the avenue and the Sugarloaf skirt.
  root.add(scatter({ x: -1.7, z: -3.6, w: 0.6, d: 0.6 }, 2, rand, (x, z) => tree({ x, z, kind: 'round', s: 1.0 })));

  // --- Maracanã, Maracanãzinho and the favela behind them. ---
  root.add(maracana({ x: 5.55, z: -4.3, ry: 0.1 }));
  root.add(maracanazinho({ x: 7.8, z: -0.35 }));
  root.add(favela(rand));
  root.add(scatter({ x: 2.6, z: -2.0, w: 1.0, d: 1.2 }, 3, rand, (x, z) => tree({ x, z, kind: 'round', s: 0.8 })));
  root.add(row(4.3, 0.5, 5.9, -0.6, 3, (x, z) => tree({ x, z, kind: 'round', s: 0.7 })));
  // Street trees along both sides of the central avenue.
  for (const s of [-2, -1, 0, 1, 2]) {
    root.add(tree({ x: s - 0.62, z: s + 0.62, kind: 'round', s: 0.6 }));
    root.add(tree({ x: s + 0.62, z: s - 0.62, kind: 'round', s: 0.6 }));
  }

  // --- Apartment blocks: a wall along Avenida Atlântica (fronts at z 2.2), more along the central avenue. ---
  const apartment = (x: number, z: number, w: number, d: number, h: number, i: number, shopColor?: number) => {
    root.add(building({
      x, z, w, d, h, wall: mat(FACADES[i % FACADES.length]), windows: 'grid', floorH: 0.42,
      shop: shopColor,
    }));
  };
  const AWN = [0xe8503a, 0xf2b630, 0x3aa0d8, 0x62b94e, 0xe66fa8];
  for (let i = 0; i < 7; i++) {
    const x = -9.05 + i * 1.3;
    apartment(x, 1.6, 1.15, 1.2, 2.7 + ((i * 5) % 4) * 0.3 + rand() * 0.3, i, AWN[i % AWN.length]);
  }
  // Right of the avenue: blocks step down toward the corner and leave a gap of trees in front of the Maracanãzinho,
  // so its dome shows as in the poster.
  const RIGHT: [number, number][] = [[4.0, 2.7], [5.3, 2.3], [9.15, 1.9]];
  RIGHT.forEach(([x, h], i) => apartment(x, 1.6, 1.15, 1.2, h, i + 3, AWN[(i + 2) % AWN.length]));
  root.add(row(6.5, 1.75, 8.2, 1.75, 3, (x, z) => tree({ x, z, kind: 'round', s: 0.65 })));
  apartment(-2.7, -0.4, 1.1, 1.0, 3.4, 1);
  apartment(-3.7, 0.45, 1.0, 0.9, 3.4, 6);
  apartment(0.9, -1.5, 1.1, 1.1, 4.0, 5);
  apartment(2.7, -0.2, 1.1, 1.0, 3.2, 7);
  apartment(-0.7, -3.4, 1.0, 1.0, 3.4, 2);
  apartment(1.5, -3.1, 1.0, 1.0, 3.0, 4);

  // --- Beach life. ---
  // Palms on the building side of the avenue, lamps on the promenade edge.
  root.add(row(-9.4, 2.65, -1.2, 2.65, 8, (x, z) => tree({ x, z, kind: 'palm', s: 0.75 })));
  root.add(row(3.9, 2.65, 9.4, 2.65, 5, (x, z) => tree({ x, z, kind: 'palm', s: 0.75 })));
  root.add(row(-9.2, 4.15, 9.2, 4.15, 10, (x, z) => lamp({ x, y: 0.05, z })));
  // Palms where the promenade widens at the left end.
  root.add(row(-9.4, 4.5, -8.6, 4.4, 2, (x, z) => tree({ x, z, kind: 'palm', s: 0.8 })));

  // Dry sand: between the sand edge (+0.25) and 0.45 short of the waterline.
  const onSand = (x: number, z: number) => x > -9.5 && x < 9.6 && z < 9.6 && z > sandZ(x) + 0.25 && (x > 9.1 || z < waterZ(x) - 0.45);
  const umbs: [number, number][] = [];
  for (let i = 0; i < 18; i++) {
    for (let k = 0; k < 10; k++) {
      const x = -9.2 + rand() * 18.4;
      const z = sandZ(x) + 0.5 + rand() * (waterZ(x) - sandZ(x) - 1.0);
      if (onSand(x, z) && umbs.every(([ux, uz]) => Math.hypot(x - ux, z - uz) > 0.6)) {
        root.add(umbrella(x, z, UMBRELLAS[i % UMBRELLAS.length]));
        umbs.push([x, z]);
        break;
      }
    }
  }
  const beachGoers: [number, number][] = [];
  const clearBeach = (x: number, z: number) =>
    onSand(x, z) && umbs.every(([ux, uz]) => Math.hypot(x - ux, z - uz) > 0.3) && beachGoers.every(([ox, oz]) => Math.hypot(x - ox, z - oz) > 0.18);
  const prand = rng(7016);
  for (let i = 0; i < 26; i++) {
    for (let k = 0; k < 12; k++) {
      const x = -9.4 + prand() * 18.8;
      const z = sandZ(x) + prand() * (waterZ(x) - sandZ(x));
      if (clearBeach(x, z)) {
        beachGoers.push([x, z]);
        root.add(person({ x, y: 0.04, z, color: BEACHWEAR[i % BEACHWEAR.length] }));
        break;
      }
    }
  }
  // Walkers on the promenade (top 0.05): closed loops along it, clear of the lamp row (z 4.15).
  const WALK: [number, number, number, number][] = [
    [-8.0, -3.0, 4.4, 0.0], [-5.0, 0.5, 4.65, 0.4], [-1.0, 4.5, 4.4, 0.7],
    [2.0, 8.0, 4.65, 0.15], [-6.5, 1.0, 4.65, 0.55], [3.0, 8.5, 4.4, 0.85],
  ];
  WALK.forEach(([a, b, z, ph], i) => {
    const loop: [number, number][] = [[a, z - 0.12], [b, z - 0.12], [b, z + 0.12], [a, z + 0.12]];
    root.add(anim.follow(person({ y: 0.05, color: BEACHWEAR[(i * 3 + 1) % BEACHWEAR.length] }), loop, 0.3 + (i % 3) * 0.05, ph, true));
  });

  // --- Traffic. ---
  root.add(crosswalk(1.0, 3.5, 1.0, { ry: Math.PI / 2 }));
  root.add(crosswalk(-6.0, 3.5, 1.0, { ry: Math.PI / 2 }));
  for (let i = 0; i < 5; i++) root.add(anim.follow(car({ y: 0.05, taxi: i === 2 }), [[-9.6, 3.25], [9.6, 3.25]], 1.2, i / 5));
  for (let i = 0; i < 4; i++) root.add(anim.follow(car({ y: 0.05, taxi: i === 1 }), [[9.6, 3.75], [-9.6, 3.75]], 1.2, i / 4 + 0.1));
  const lane = (off: number, rev: boolean): [number, number][] => {
    const a: [number, number] = [AV0[0] - 0.8 + off * Math.SQRT1_2, AV0[1] - 0.8 - off * Math.SQRT1_2];
    const b: [number, number] = [AV1[0] + 0.3 + off * Math.SQRT1_2, AV1[1] + 0.3 - off * Math.SQRT1_2];
    return rev ? [b, a] : [a, b];
  };
  for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: 0.056 }), lane(0.25, false), 1.0, i / 3));
  for (let i = 0; i < 3; i++) root.add(anim.follow(car({ y: 0.056, taxi: i === 0 }), lane(-0.25, true), 1.0, i / 3 + 0.15));

  // --- Boats: sea and bay. ---
  const boats: [number, number, number, number][] = [
    [-5.4, 9.0, 0xe8503a, 0.5], [-1.0, 8.8, 0xf2b630, 1.8], [4.6, 8.9, 0x3aa0d8, 3.0],
    [-8.4, -8.6, 0xf4f1ea, 0.9], [-7.0, -9.2, 0xe8503a, 2.2],
  ];
  for (const [x, z, color, ry] of boats) {
    root.add(anim.bob(boat({ x, z, y: 0.07, ry, color, len: 0.7 }), 0.025, 1.3));
  }

  return { root, update: anim.update };
}
