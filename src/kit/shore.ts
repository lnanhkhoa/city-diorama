import * as THREE from 'three';
import { TILE } from './base';

/** Cells across the tile; one cell is TILE / RES ≈ 0.04 units, so a 0.1-wide seawall or kerb covers two or more. */
const RES = 512;
/** Distances are stored up to this many units from the shore; farther water reads as open water. */
export const SHORE_MAX = 1.0;
/** Dry strip along the tile rim that counts as curb rather than shore, in units. */
const EDGE = 0.4;
/** A surface standing more than this above the nearby water is a wall, quay or kerb, not a beach. */
const WALL_RISE = 0.03;
/** Surfaces this far above the water are decks and roofs over it (bridges), not the shoreline. */
const OVERHEAD = 0.6;
/** Search radius (cells) around a shore cell for the water level, ≈ 0.12 units. */
const COAST = 3;
/** A patch of ground standing in open water smaller than this (units²) is a moored boat, not an island. */
const FLOATING = 0.35;

const blank = new THREE.DataTexture(new Uint8Array([255, 255]), 1, 1, THREE.RGFormat);
blank.needsUpdate = true;

/**
 * Shore distances over the tile's top view, sampled by `waterMat`: red is the
 * distance to any dry ground (the lapping foam line), green the distance to a
 * low, sloping shore such as a beach or a grassy bank (the shallow margin), both
 * as 0 = shore … 1 = `SHORE_MAX` or farther. Water against a wall, quay or kerb
 * keeps its deep colour up to the wall. `scale` is the stage's current scale of
 * the tile, so the lookup stays put while the tile grows in.
 */
export const waterShore = {
  map: { value: blank as THREE.DataTexture },
  scale: { value: 1 },
};

const NONE = -Infinity;

/** Static, solid geometry that forms a shoreline: not movers (boats), not tree crowns (textured, overhanging). */
function isGround(o: THREE.Object3D, m: THREE.Material): boolean {
  if ((m as THREE.MeshStandardMaterial).map) return false;
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.userData.dynamic) return false;
  return true;
}

/**
 * Rasterise the up-facing faces under `root` into top-view height maps (water,
 * and the highest dry surface), classify each dry cell on the shoreline as beach
 * (no higher than the water beside it) or wall, and store each water cell's
 * distance to dry ground and to beach. Beyond the tile, and dry ground within
 * `EDGE` of its rim (the plinth's curb), count as open water, so a river running
 * off the plinth edge gets no margin there. Call once per city after
 * `mergeStatic`, with `root` not yet parented.
 */
export function bakeShore(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const cell = TILE / RES;
  const waterH = new Float32Array(RES * RES).fill(NONE);
  const dryH = new Float32Array(RES * RES).fill(NONE);
  // Over water: the lowest downward-facing surface clear of it, i.e. the soffit of a deck or arch spanning it.
  const soffit = new Float32Array(RES * RES).fill(Infinity);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const n = new THREE.Vector3();
  const e = new THREE.Vector3();
  // Water first: its extent and top bound which ground matters (only ground near it, and not roofs high above it).
  const box = new THREE.Box2(new THREE.Vector2(Infinity, Infinity), new THREE.Vector2(-Infinity, -Infinity));
  let top = NONE;
  type Pass = 'water' | 'soffit' | 'ground';
  const raster = (pass: Pass) =>
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      const water = pass === 'water';
      if (water !== (o.material.userData.water === true) || (!water && !isGround(o, o.material))) return;
      const pos = o.geometry.attributes.position;
      const index = o.geometry.index;
      const count = index ? index.count : pos.count;
      for (let t = 0; t < count; t += 3) {
        a.fromBufferAttribute(pos, index ? index.getX(t) : t).applyMatrix4(o.matrixWorld);
        b.fromBufferAttribute(pos, index ? index.getX(t + 1) : t + 1).applyMatrix4(o.matrixWorld);
        c.fromBufferAttribute(pos, index ? index.getX(t + 2) : t + 2).applyMatrix4(o.matrixWorld);
        if (!water) {
          if (Math.min(a.y, b.y, c.y) > top + OVERHEAD) continue;
          if (Math.max(a.x, b.x, c.x) < box.min.x || Math.min(a.x, b.x, c.x) > box.max.x) continue;
          if (Math.max(a.z, b.z, c.z) < box.min.y || Math.min(a.z, b.z, c.z) > box.max.y) continue;
        }
        n.subVectors(c, b).cross(e.subVectors(a, b));
        const len = n.length();
        if (len === 0) continue;
        const up = n.y / len;
        if (pass === 'soffit') {
          if (up < -0.7) cells(a, b, c, cell, (i, h) => {
            if (waterH[i] !== NONE && h > waterH[i] + 0.01) soffit[i] = Math.min(soffit[i], h);
          });
          continue;
        }
        // Water tops are flat; ground may slope (an island's hill, a bank) but not be a wall's side.
        if (up < (water ? 0.7 : 0.2)) continue;
        if (water) {
          top = Math.max(top, a.y, b.y, c.y);
          for (const p of [a, b, c]) box.expandByPoint(new THREE.Vector2(p.x, p.z));
          cells(a, b, c, cell, (i, h) => (waterH[i] = Math.max(waterH[i], h)));
        } else {
          // Over a span, only what stands under its soffit (a pier, a bank) is ground; the deck on top is not.
          cells(a, b, c, cell, (i, h) => {
            if (h <= soffit[i] + 0.005) dryH[i] = Math.max(dryH[i], h);
          });
        }
      }
    });
  raster('water');
  if (top === NONE) {
    setMap(blank);
    return;
  }
  box.expandByScalar((COAST + 1) * cell);
  raster('soffit');
  raster('ground');

  // Ground standing in the water (an island, a pier, the near half of a seawall) makes those cells dry; a deck or
  // arch spanning the water (its top is above a soffit) and decks high over it do not.
  const covered = new Uint8Array(RES * RES);
  for (let i = 0; i < RES * RES; i++) {
    const w = waterH[i];
    if (w !== NONE && dryH[i] > w + 0.005 && dryH[i] < w + OVERHEAD) covered[i] = 1;
  }
  // A small covered patch out on the water that touches no land is a moored boat or similar, not an island: the
  // water stays open around it.
  const stack: number[] = [];
  const patch: number[] = [];
  const seen = new Uint8Array(RES * RES);
  for (let s = 0; s < RES * RES; s++) {
    if (!covered[s] || seen[s]) continue;
    let land = false;
    patch.length = 0;
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      patch.push(i);
      const x = i % RES;
      const y = (i - x) / RES;
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
        if (nx < 0 || ny < 0 || nx >= RES || ny >= RES) continue;
        const j = ny * RES + nx;
        if (waterH[j] === NONE) land = true;
        else if (covered[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (land || patch.length * cell * cell >= FLOATING) for (const i of patch) waterH[i] = NONE;
  }

  const waterSeed = new Uint8Array(RES * RES);
  for (let i = 0; i < RES * RES; i++) if (waterH[i] !== NONE) waterSeed[i] = 1;
  const toWater = chamfer(waterSeed);

  const isWater = (i: number) => waterH[i] !== NONE;
  const rim = (x: number, y: number) => Math.min(x, y, RES - 1 - x, RES - 1 - y) < Math.ceil(EDGE / cell);
  const anySeed = new Uint8Array(RES * RES);
  const beachSeed = new Uint8Array(RES * RES);
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      const i = y * RES + x;
      if (isWater(i) || rim(x, y)) continue;
      anySeed[i] = 1;
      // Only the dry cells touching the water are the shoreline: behind a wall, the low pavement is a wall's width
      // inland and never qualifies. A shoreline cell is beach when it lies no higher than the water beside it and no
      // wall, quay or kerb stands next to it.
      if (toWater[i] > 1.5) continue;
      let level = NONE;
      for (let dy = -COAST; dy <= COAST; dy++) {
        for (let dx = -COAST; dx <= COAST; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < RES && yy < RES) level = Math.max(level, waterH[yy * RES + xx]);
        }
      }
      if (level === NONE || dryH[i] === NONE || dryH[i] > level + WALL_RISE) continue;
      let wall = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= RES || yy >= RES) continue;
          const h = dryH[yy * RES + xx];
          if (h > level + WALL_RISE && h < level + OVERHEAD) wall = true;
        }
      }
      if (!wall) beachSeed[i] = 1;
    }
  }

  const toAny = chamfer(anySeed);
  const toBeach = chamfer(beachSeed);
  const data = new Uint8Array(RES * RES * 2);
  const enc = (d: number) => Math.round(Math.min(1, (d * cell) / SHORE_MAX) * 255);
  for (let i = 0; i < RES * RES; i++) {
    data[i * 2] = enc(toAny[i]);
    data[i * 2 + 1] = enc(toBeach[i]);
  }

  const tex = new THREE.DataTexture(data, RES, RES, THREE.RGFormat);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  setMap(tex);
}

function setMap(tex: THREE.DataTexture): void {
  if (waterShore.map.value !== blank && waterShore.map.value !== tex) waterShore.map.value.dispose();
  waterShore.map.value = tex;
}

/** Two-pass chamfer distance (1, √2), in cells, from every cell to the nearest seed; off-grid is seedless. */
function chamfer(seed: Uint8Array): Float32Array {
  const INF = 1e9;
  const d = new Float32Array(RES * RES);
  for (let i = 0; i < d.length; i++) d[i] = seed[i] ? 0 : INF;
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= RES || y >= RES ? INF : d[y * RES + x]);
  for (let y = 0; y < RES; y++) {
    for (let x = 0; x < RES; x++) {
      const i = y * RES + x;
      if (d[i]) d[i] = Math.min(d[i], at(x - 1, y) + 1, at(x, y - 1) + 1, at(x - 1, y - 1) + Math.SQRT2, at(x + 1, y - 1) + Math.SQRT2);
    }
  }
  for (let y = RES - 1; y >= 0; y--) {
    for (let x = RES - 1; x >= 0; x--) {
      const i = y * RES + x;
      if (d[i]) d[i] = Math.min(d[i], at(x + 1, y) + 1, at(x, y + 1) + 1, at(x + 1, y + 1) + Math.SQRT2, at(x - 1, y + 1) + Math.SQRT2);
    }
  }
  return d;
}

/** Call `visit(cell index, surface height)` for every cell centre inside the triangle. Row is world z, column world x. */
function cells(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, cell: number, visit: (i: number, h: number) => void): void {
  const half = TILE / 2;
  const toCell = (v: number) => (v + half) / cell - 0.5;
  const x0 = Math.max(0, Math.ceil(toCell(Math.min(a.x, b.x, c.x))));
  const x1 = Math.min(RES - 1, Math.floor(toCell(Math.max(a.x, b.x, c.x))));
  const z0 = Math.max(0, Math.ceil(toCell(Math.min(a.z, b.z, c.z))));
  const z1 = Math.min(RES - 1, Math.floor(toCell(Math.max(a.z, b.z, c.z))));
  const area = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
  if (area === 0) return;
  for (let gz = z0; gz <= z1; gz++) {
    const pz = (gz + 0.5) * cell - half;
    for (let gx = x0; gx <= x1; gx++) {
      const px = (gx + 0.5) * cell - half;
      const w0 = ((b.x - px) * (c.z - pz) - (c.x - px) * (b.z - pz)) / area;
      const w1 = ((c.x - px) * (a.z - pz) - (a.x - px) * (c.z - pz)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < -1e-6 || w1 < -1e-6 || w2 < -1e-6) continue;
      visit(gz * RES + gx, w0 * a.y + w1 * b.y + w2 * c.y);
    }
  }
}
