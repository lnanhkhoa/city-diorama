/// <reference types="node" />
/**
 * GLB bytes → `ShapeData`. Faces are grouped into `parts` colour regions
 * (k-means on the base colour sampled at full resolution), the region map is
 * cleaned by `clean` passes of neighbour majority voting, and each region is
 * simplified separately with its borders locked so regions still meet without
 * cracks. Textures are dropped: the city assigns one palette material per part.
 */
import { NodeIO, type Texture } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import jpeg from 'jpeg-js';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import { PNG } from 'pngjs';
import { encodeShapePart, type ShapeData } from '../../src/kit/shape';

type RGB = [number, number, number];

export interface BakeOptions {
  tris: number;
  parts: number;
  clean: number;
}

export interface BakeResult {
  data: ShapeData;
  /** Per part, darkest first: sampled sRGB colour and triangle count. */
  parts: { hex: string; tris: number }[];
  sourceTris: number;
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);
const luma = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

interface Image { w: number; h: number; data: Uint8Array }

function decodeImage(tex: Texture): Image {
  const bytes = tex.getImage();
  if (!bytes) throw new Error(`texture "${tex.getName()}" has no image data`);
  const type = tex.getMimeType();
  if (type === 'image/png') {
    const png = PNG.sync.read(Buffer.from(bytes));
    return { w: png.width, h: png.height, data: png.data };
  }
  if (type === 'image/jpeg') {
    const jpg = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    return { w: jpg.width, h: jpg.height, data: jpg.data };
  }
  throw new Error(`texture "${tex.getName()}" is ${type}; export the GLB with PNG or JPEG textures`);
}

/** Linear RGB at a UV, nearest texel, repeat wrap. glTF UV (0, 0) is the image's top-left. */
function sample(img: Image, u: number, v: number): RGB {
  const x = Math.min(img.w - 1, Math.floor((u - Math.floor(u)) * img.w));
  const y = Math.min(img.h - 1, Math.floor((v - Math.floor(v)) * img.h));
  const i = (y * img.w + x) * 4;
  return [srgbToLinear(img.data[i] / 255), srgbToLinear(img.data[i + 1] / 255), srgbToLinear(img.data[i + 2] / 255)];
}

/** World-space triangle soup (9 floats per face) with a linear base colour per face. */
async function readTriangles(glb: Uint8Array): Promise<{ soup: number[]; faceColor: RGB[] }> {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.readBinary(glb);
  const soup: number[] = [];
  const faceColor: RGB[] = [];
  const images = new Map<Texture, Image>();

  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) {
        console.warn(`skipping a non-triangle primitive in mesh "${mesh.getName()}"`);
        continue;
      }
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const material = prim.getMaterial();
      const factor = material?.getBaseColorFactor() ?? [1, 1, 1, 1];
      const tex = material?.getBaseColorTexture() ?? null;
      const uv = tex ? prim.getAttribute(`TEXCOORD_${material!.getBaseColorTextureInfo()!.getTexCoord()}`) : null;
      const vcol = prim.getAttribute('COLOR_0');
      let img: Image | undefined;
      if (tex && uv) {
        img = images.get(tex);
        if (!img) images.set(tex, (img = decodeImage(tex)));
      }

      const idx = prim.getIndices();
      const n = idx ? idx.getCount() : pos.getCount();
      const p: number[] = [0, 0, 0];
      const t: number[] = [0, 0];
      const c: number[] = [0, 0, 0, 1];
      for (let k = 0; k + 2 < n; k += 3) {
        // Texture: three corners plus the centroid, which catches detail between them.
        // Vertex colour: corner average. Both multiply the material factor.
        const texel: RGB = [0, 0, 0];
        const vc: RGB = [0, 0, 0];
        const centre = [0, 0];
        for (let j = 0; j < 3; j++) {
          const v = idx ? idx.getScalar(k + j) : k + j;
          pos.getElement(v, p);
          soup.push(
            m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
            m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
            m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
          );
          if (img && uv) {
            uv.getElement(v, t);
            const s = sample(img, t[0], t[1]);
            for (let a = 0; a < 3; a++) texel[a] += s[a] / 4;
            centre[0] += t[0] / 3;
            centre[1] += t[1] / 3;
          }
          if (vcol) vcol.getElement(v, c);
          for (let a = 0; a < 3; a++) vc[a] += (vcol ? c[a] : 1) / 3;
        }
        if (img && uv) {
          const s = sample(img, centre[0], centre[1]);
          for (let a = 0; a < 3; a++) texel[a] += s[a] / 4;
        } else texel.fill(1);
        faceColor.push([texel[0] * vc[0] * factor[0], texel[1] * vc[1] * factor[1], texel[2] * vc[2] * factor[2]]);
      }
    }
  }
  return { soup, faceColor };
}

export async function bakeShape(glb: Uint8Array, o: BakeOptions): Promise<BakeResult> {
  await MeshoptSimplifier.ready;
  const { soup, faceColor } = await readTriangles(glb);
  if (!faceColor.length) throw new Error('the GLB has no triangles');

  // Weld by position (Rodin splits vertices along UV seams) and normalise:
  // bottom at y = 0, height 1, footprint centred.
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < soup.length; i++) {
    lo[i % 3] = Math.min(lo[i % 3], soup[i]);
    hi[i % 3] = Math.max(hi[i % 3], soup[i]);
  }
  const height = hi[1] - lo[1];
  if (!(height > 0)) throw new Error('the GLB is flat; nothing to stand up');
  const size = [(hi[0] - lo[0]) / height, 1, (hi[2] - lo[2]) / height] as const;
  // Rodin's raw meshes split seam vertices by more than 1e-6 of their size; 1e-5 closes them
  // (motorbike: 246k open edges -> 0) without merging distinct features.
  const weldStep = Math.max(hi[0] - lo[0], height, hi[2] - lo[2]) * 1e-5;

  const verts: number[] = [];
  const vertId = new Map<string, number>();
  const faces: number[] = [];
  const kept: number[] = []; // original face index per welded face
  for (let f = 0; f < faceColor.length; f++) {
    const ids = [0, 1, 2].map((j) => {
      const at = (f * 3 + j) * 3;
      const key = `${Math.round(soup[at] / weldStep)},${Math.round(soup[at + 1] / weldStep)},${Math.round(soup[at + 2] / weldStep)}`;
      let id = vertId.get(key);
      if (id === undefined) {
        id = verts.length / 3;
        vertId.set(key, id);
        verts.push((soup[at] - (lo[0] + hi[0]) / 2) / height, (soup[at + 1] - lo[1]) / height, (soup[at + 2] - (lo[2] + hi[2]) / 2) / height);
      }
      return id;
    });
    if (ids[0] === ids[1] || ids[1] === ids[2] || ids[0] === ids[2]) continue;
    faces.push(...ids);
    kept.push(f);
  }
  const faceCount = kept.length;
  const area = Float64Array.from({ length: faceCount }, (_, f) => {
    const [a, b, c] = [faces[f * 3], faces[f * 3 + 1], faces[f * 3 + 2]].map((v) => verts.slice(v * 3, v * 3 + 3));
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    return Math.hypot(u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]) / 2;
  });
  // Cluster in sRGB, which is closer to perceived difference than linear.
  const colour = kept.map((f) => faceColor[f].map((x) => linearToSrgb(Math.min(1, x))) as RGB);

  // Colour regions: deterministic area-weighted k-means, seeded at luminance quantiles.
  const label = new Int32Array(faceCount);
  let centres: RGB[] = [];
  {
    const byLuma = [...colour.keys()].sort((a, b) => luma(colour[a]) - luma(colour[b]));
    const total = area.reduce((s, a) => s + a, 0);
    let acc = 0;
    for (const f of byLuma) {
      acc += area[f];
      while (centres.length < o.parts && acc >= ((centres.length + 0.5) / o.parts) * total) centres.push([...colour[f]] as RGB);
    }
    for (let iter = 0; iter < 30; iter++) {
      let moved = false;
      for (let f = 0; f < faceCount; f++) {
        let best = 0;
        let bestD = Infinity;
        for (let k = 0; k < o.parts; k++) {
          const d = (colour[f][0] - centres[k][0]) ** 2 + (colour[f][1] - centres[k][1]) ** 2 + (colour[f][2] - centres[k][2]) ** 2;
          if (d < bestD) {
            bestD = d;
            best = k;
          }
        }
        if (label[f] !== best) moved = true;
        label[f] = best;
      }
      const sums = centres.map(() => [0, 0, 0, 0]);
      for (let f = 0; f < faceCount; f++) {
        const s = sums[label[f]];
        for (let a = 0; a < 3; a++) s[a] += colour[f][a] * area[f];
        s[3] += area[f];
      }
      centres = centres.map((c, k) => (sums[k][3] > 0 ? [sums[k][0] / sums[k][3], sums[k][1] / sums[k][3], sums[k][2] / sums[k][3]] : c));
      if (!moved && iter > 0) break;
    }
  }

  // Texture noise leaves speckles of the wrong region; each pass hands a face to
  // the area-weighted majority of itself and its edge neighbours.
  if (o.parts > 1 && o.clean > 0) {
    const byEdge = new Map<string, number[]>();
    for (let f = 0; f < faceCount; f++) {
      for (let j = 0; j < 3; j++) {
        const a = faces[f * 3 + j];
        const b = faces[f * 3 + ((j + 1) % 3)];
        const key = a < b ? `${a},${b}` : `${b},${a}`;
        const list = byEdge.get(key);
        if (list) list.push(f);
        else byEdge.set(key, [f]);
      }
    }
    const neighbours: number[][] = Array.from({ length: faceCount }, () => []);
    for (const list of byEdge.values()) for (const f of list) for (const g of list) if (f !== g) neighbours[f].push(g);
    for (let pass = 0; pass < o.clean; pass++) {
      const prev = label.slice();
      for (let f = 0; f < faceCount; f++) {
        const vote = new Float64Array(o.parts);
        vote[prev[f]] += area[f];
        for (const g of neighbours[f]) vote[prev[g]] += area[g];
        let best = prev[f];
        for (let k = 0; k < o.parts; k++) if (vote[k] > vote[best]) best = k;
        label[f] = best;
      }
    }
  }

  // Each region becomes a list of triangles over the shared `positions`, so regions
  // always meet on identical vertices (no cracks).
  const positions = new Float32Array(verts);
  const order = [...centres.keys()].sort((a, b) => luma(centres[a]) - luma(centres[b]));

  // First choice: simplify each region separately with its borders locked. Thin
  // colour features (headdress stripes) keep their exact outline.
  let regions = order.map((k) => {
    const idx: number[] = [];
    for (let f = 0; f < faceCount; f++) if (label[f] === k) idx.push(faces[f * 3], faces[f * 3 + 1], faces[f * 3 + 2]);
    if (!idx.length) return new Uint32Array();
    const target = Math.max(1, Math.round((o.tris * idx.length) / 3 / faceCount)) * 3;
    return MeshoptSimplifier.simplify(Uint32Array.from(idx), positions, 3, Math.min(target, idx.length), 1, o.parts > 1 ? ['LockBorder'] : [])[0];
  });

  // Locked borders cannot be reduced, so long, ragged colour borders can leave a
  // region far over budget (motorbike: 6,338 triangles against 500). Then simplify
  // the whole mesh at once and give each triangle the region of the nearest
  // original triangle: on budget, at the cost of blockier region outlines.
  if (regions.reduce((s, r) => s + r.length / 3, 0) > o.tris * 1.15) {
    const [simplified] = MeshoptSimplifier.simplify(Uint32Array.from(faces), positions, 3, Math.min(o.tris * 3, faces.length), 1, []);
    const centroid = (idx: ArrayLike<number>, f: number) =>
      [0, 1, 2].map((a) => (verts[idx[f * 3] * 3 + a] + verts[idx[f * 3 + 1] * 3 + a] + verts[idx[f * 3 + 2] * 3 + a]) / 3);
    const cell = Math.max(size[0], 1, size[2]) / 64;
    const grid = new Map<string, number[]>();
    for (let f = 0; f < faceCount; f++) {
      const k = centroid(faces, f).map((x) => Math.floor(x / cell)).join(',');
      const list = grid.get(k);
      if (list) list.push(f);
      else grid.set(k, [f]);
    }
    const lists = order.map((): number[] => []);
    for (let f = 0; f < simplified.length / 3; f++) {
      const c = centroid(simplified, f);
      const [gx, gy, gz] = c.map((x) => Math.floor(x / cell));
      let best = -1;
      let bestD = Infinity;
      // Widen the search shell until something is found; one shell past the first hit is exact enough.
      for (let ring = 1; ring <= 64 && (best < 0 || ring <= 2); ring++) {
        for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) for (let dz = -ring; dz <= ring; dz++) {
          if (ring > 1 && Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== ring) continue;
          for (const g of grid.get(`${gx + dx},${gy + dy},${gz + dz}`) ?? []) {
            const o2 = centroid(faces, g);
            const d = (o2[0] - c[0]) ** 2 + (o2[1] - c[1]) ** 2 + (o2[2] - c[2]) ** 2;
            if (d < bestD) {
              bestD = d;
              best = g;
            }
          }
        }
      }
      lists[order.indexOf(label[best])].push(simplified[f * 3], simplified[f * 3 + 1], simplified[f * 3 + 2]);
    }
    regions = lists.map((l) => Uint32Array.from(l));
  }

  // Compact each region to its own vertices and encode, dark to light.
  const encoded: ShapeData['parts'][number][] = [];
  const report: BakeResult['parts'] = [];
  order.forEach((k, i) => {
    if (!regions[i].length) return;
    const [remap, unique] = MeshoptSimplifier.compactMesh(regions[i]);
    const outPos = new Float32Array(unique * 3);
    for (let v = 0; v < remap.length; v++) {
      if (remap[v] === 0xffffffff) continue;
      outPos.set(positions.subarray(v * 3, v * 3 + 3), remap[v] * 3);
    }
    encoded.push(encodeShapePart(outPos, regions[i], size));
    const hex = centres[k].map((x) => Math.round(Math.min(1, Math.max(0, x)) * 255).toString(16).padStart(2, '0')).join('');
    report.push({ hex: `#${hex}`, tris: regions[i].length / 3 });
  });
  return {
    data: { size: [Number(size[0].toFixed(4)), 1, Number(size[2].toFixed(4))], parts: encoded },
    parts: report,
    sourceTris: faceCount,
  };
}
