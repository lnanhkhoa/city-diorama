import * as THREE from 'three';
import type { Place } from './primitives';

/**
 * A mesh baked into source by `bun run rodin bake` (see docs/rodin-pipeline.md).
 * Normalised frame: bottom at y = 0, height 1, footprint centred on x = z = 0,
 * so `size` is `[width, 1, depth]`.
 */
export interface ShapeData {
  size: readonly [number, number, number];
  parts: readonly ShapePart[];
}

/** One colour region. Both fields are base64 little-endian Uint16 arrays. */
export interface ShapePart {
  /** x, y, z per vertex, each quantised over its axis of `size`. */
  positions: string;
  /** Triangle list into `positions`. */
  indices: string;
}

/** Where and how big a baked shape goes: `height` in world units, `xzScale` multiplies the footprint only. */
export type ShapePlace = Place & { height?: number; xzScale?: number };

const Q = 65535;

function toBase64(u16: Uint16Array): string {
  const bytes = new Uint8Array(u16.length * 2);
  for (let i = 0; i < u16.length; i++) {
    bytes[i * 2] = u16[i] & 0xff;
    bytes[i * 2 + 1] = u16[i] >> 8;
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function fromBase64(s: string): Uint16Array {
  const bin = atob(s);
  const out = new Uint16Array(bin.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = bin.charCodeAt(i * 2) | (bin.charCodeAt(i * 2 + 1) << 8);
  return out;
}

/** Quantise one part. `positions` must already be in the normalised frame of `size`. */
export function encodeShapePart(positions: Float32Array, indices: Uint32Array, size: readonly [number, number, number]): ShapePart {
  const count = positions.length / 3;
  if (count > Q + 1) throw new Error(`shape part has ${count} vertices; the format holds at most ${Q + 1}`);
  const q = new Uint16Array(positions.length);
  for (let i = 0; i < count; i++) {
    q[i * 3] = Math.round((positions[i * 3] / size[0] + 0.5) * Q);
    q[i * 3 + 1] = Math.round((positions[i * 3 + 1] / size[1]) * Q);
    q[i * 3 + 2] = Math.round((positions[i * 3 + 2] / size[2] + 0.5) * Q);
  }
  return { positions: toBase64(q), indices: toBase64(Uint16Array.from(indices)) };
}

// Decoded once per part; every placement clones it.
const decoded = new WeakMap<ShapePart, THREE.BufferGeometry>();

function decodePart(part: ShapePart, size: readonly [number, number, number]): THREE.BufferGeometry {
  let geo = decoded.get(part);
  if (geo) return geo;
  const q = fromBase64(part.positions);
  const pos = new Float32Array(q.length);
  for (let i = 0; i < q.length; i += 3) {
    pos[i] = (q[i] / Q - 0.5) * size[0];
    pos[i + 1] = (q[i + 1] / Q) * size[1];
    pos[i + 2] = (q[i + 2] / Q - 0.5) * size[2];
  }
  geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(fromBase64(part.indices), 1));
  decoded.set(part, geo);
  return geo;
}

/**
 * Place a baked shape, bottom-anchored like every kit solid. `materials` has one
 * entry per part (in the order the generated file lists them), or a single
 * material for all parts. `height` scales uniformly; `xzScale` then narrows (< 1)
 * or widens the footprint alone, for a model whose proportions run stockier than
 * the real building. Faceted unless `smooth`.
 */
export function shape(
  data: ShapeData,
  materials: THREE.Material | readonly THREE.Material[],
  p: ShapePlace & { smooth?: boolean } = {},
): THREE.Group {
  const mats = Array.isArray(materials) ? materials : data.parts.map(() => materials as THREE.Material);
  if (mats.length !== data.parts.length) throw new Error(`shape has ${data.parts.length} parts but got ${mats.length} materials`);
  const g = new THREE.Group();
  g.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  g.rotation.y = p.ry ?? 0;
  const s = p.height ?? 1;
  const w = s * (p.xzScale ?? 1);
  data.parts.forEach((part, i) => {
    const base = decodePart(part, data.size);
    const geo = p.smooth ? base.clone() : base.toNonIndexed();
    geo.scale(w, s, w);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, mats[i]);
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
  });
  return g;
}
