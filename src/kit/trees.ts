import * as THREE from 'three';
import { group, rng, type Place } from './primitives';

// Trees are the one kit prop with textures. They are drawn here in code into
// DataTextures (no image files, no canvas, so builds also run under Node):
// leaf clusters for crowns, leaflets for palm fronds, fibrous ringed bark. The
// textures are grey; vertex colours carry hue and a light-to-shade gradient,
// so one material per texture serves every tree species and colour, and the
// static merger still folds all trees into three draw calls.

/** Deterministic 0–1 hash of a ground position (and a salt per decision). */
function hash(x: number, z: number, salt = 0): number {
  const h = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

function texture(w: number, h: number, paint: (lum: Float32Array) => void, wrapS: THREE.Wrapping): THREE.DataTexture {
  const lum = new Float32Array(w * h);
  paint(lum);
  const data = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const v = Math.min(1, Math.max(0, lum[i]));
    // Highlights lean warm, shade cool: grey alone would flatten the vertex colour's hue.
    data[i * 4] = Math.round(255 * Math.min(1, v * (0.94 + 0.08 * v)));
    data[i * 4 + 1] = Math.round(255 * v);
    data[i * 4 + 2] = Math.round(255 * v * (1.04 - 0.12 * v));
    data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, w, h);
  t.wrapS = wrapS;
  t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/** Overlapping leaves on dark gaps, each lit from one side with a darker vein; tiles both ways. */
function canopyTexture(): THREE.DataTexture {
  const S = 128;
  return texture(S, S, (lum) => {
    const rand = rng(7);
    lum.fill(0.42);
    for (let n = 0; n < 650; n++) {
      const cx = rand() * S;
      const cy = rand() * S;
      const a = rand() * Math.PI * 2;
      const l = 5 + rand() * 3;
      const wd = 2.4 + rand() * 1.2;
      const base = 0.66 + rand() * 0.36;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      for (let dy = -8; dy <= 8; dy++) {
        for (let dx = -8; dx <= 8; dx++) {
          const u = (dx * ca + dy * sa) / l;
          const v = (-dx * sa + dy * ca) / wd;
          if (u * u + v * v > 1) continue;
          const x = (Math.floor(cx + dx) + S) % S;
          const y = (Math.floor(cy + dy) + S) % S;
          lum[y * S + x] = base * (1 - 0.22 * u) * (Math.abs(v) < 0.22 ? 0.86 : 1 - 0.18 * v);
        }
      }
    }
  }, THREE.RepeatWrapping);
}

/**
 * Palm frond blade: u runs across (0.5 is the midrib), v along the frond.
 * Leaflets slant toward the tip in a chevron, split by dark cuts.
 */
function frondTexture(): THREE.DataTexture {
  const W = 64;
  const H = 128;
  return texture(W, H, (lum) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.abs((x + 0.5) / W - 0.5) * 2;
        const f = ((y / H) * 16 - d * 1.4 + 16) % 1;
        let l = 0.62 + 0.4 * Math.sin(Math.PI * f) * (1 - 0.3 * d);
        if (f < 0.14) l = 0.28;
        if (d < 0.07) l = 1;
        lum[y * W + x] = l;
      }
    }
  }, THREE.ClampToEdgeWrapping);
}

/** Bark: vertical fibres with a leaf-scar ring at the foot of every tile (each palm trunk ring is one tile tall). */
function barkTexture(): THREE.DataTexture {
  const W = 64;
  const H = 64;
  const rand = rng(11);
  const fibre = Array.from({ length: W }, () => rand());
  return texture(W, H, (lum) => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const t = y / H;
        const n = (fibre[x] + fibre[(x + 1) % W] + fibre[(x + W - 1) % W]) / 3;
        let l = 0.6 + 0.4 * n + (rand() - 0.5) * 0.1;
        if (t < 0.1) l *= 0.62;
        else if (t < 0.16) l *= 1.12;
        lum[y * W + x] = l;
      }
    }
  }, THREE.RepeatWrapping);
}

let materials: { canopy: THREE.MeshStandardMaterial; frond: THREE.MeshStandardMaterial; bark: THREE.MeshStandardMaterial } | null = null;

function treeMaterials() {
  materials ??= {
    canopy: new THREE.MeshStandardMaterial({ map: canopyTexture(), vertexColors: true, roughness: 0.82 }),
    frond: new THREE.MeshStandardMaterial({ map: frondTexture(), vertexColors: true, roughness: 0.7 }),
    bark: new THREE.MeshStandardMaterial({ map: barkTexture(), vertexColors: true, roughness: 0.95 }),
  };
  return materials;
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Vertex colour `base` scaled by `shade(position)`. Texture greys average ~0.7, so colours are lifted to match the old flat palette. */
function paint(geo: THREE.BufferGeometry, base: THREE.ColorRepresentation, shade: (p: THREE.Vector3) => number): THREE.BufferGeometry {
  const c = new THREE.Color(base);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const k = shade(v.fromBufferAttribute(p, i)) * 1.35;
    col[i * 3] = c.r * k;
    col[i * 3 + 1] = c.g * k;
    col[i * 3 + 2] = c.b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

const UP = new THREE.Vector3(0, 1, 0);

/**
 * One palm frond along +z from the origin: a spine that rises, then droops by
 * `droop`, carrying a tent-folded blade with a notched (pinnate) edge. Both
 * sides are faced so it reads from below. UV u runs across the blade, v along it.
 */
function frond(len: number, width: number, rise: number, droop: number): THREE.BufferGeometry {
  const N = 6;
  const pts: [THREE.Vector3, number][][] = [];
  for (let j = 0; j <= N; j++) {
    const u = j / N;
    const y = len * (rise * u - droop * u * u);
    const z = len * u * (1 - 0.12 * u);
    // Narrow stalk, widest a third out, sharp tip; odd nodes notched for leaflets.
    const w = width * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.7 * (j % 2 ? 0.58 : 1) * (j === 0 ? 0.3 : 1);
    const fold = w * 0.45;
    pts.push([
      [new THREE.Vector3(-w, y - fold, z), u],
      [new THREE.Vector3(0, y, z), u],
      [new THREE.Vector3(w, y - fold, z), u],
    ]);
  }
  const pos: number[] = [];
  const uv: number[] = [];
  const tri = (a: [THREE.Vector3, number, number], b: [THREE.Vector3, number, number], c: [THREE.Vector3, number, number]) => {
    for (const [p, s, t] of [a, b, c, a, c, b]) {
      pos.push(p.x, p.y, p.z);
      uv.push(s, t);
    }
  };
  for (let j = 0; j < N; j++) {
    const [l0, c0, r0] = pts[j].map(([p, t], k) => [p, k / 2, t] as [THREE.Vector3, number, number]);
    const [l1, c1, r1] = pts[j + 1].map(([p, t], k) => [p, k / 2, t] as [THREE.Vector3, number, number]);
    tri(l0, c0, c1);
    tri(l0, c1, l1);
    tri(c0, r0, r1);
    tri(c0, r1, c1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

/** Coconut palm, ~1.1·s tall: a ringed trunk curving off vertical, coconuts, dead fronds hanging under two tiers of arching fronds. */
function palm(g: THREE.Group, s: number, x: number, z: number): void {
  const mats = treeMaterials();
  // Crown offset stays ≤ 0.1·s, so trunk to frond tip reaches ~0.53·s, close to the old straight palm's 0.5.
  const lean = (0.03 + hash(x, z, 2) * 0.07) * s;
  const la = hash(x, z, 1) * Math.PI * 2;
  const H = 1.08 * s;
  // Trunk curve: the lean grows toward the crown, as a palm bends out of its neighbours' shade.
  const at = (t: number) => new THREE.Vector3(Math.cos(la) * lean * t * t, H * t, Math.sin(la) * lean * t * t);
  const radius = (t: number) => (0.062 - 0.024 * t) * s;
  const SEGS = 7;
  for (let i = 0; i < SEGS; i++) {
    const a = at(i / SEGS);
    const b = at((i + 1) / SEGS);
    const dir = b.clone().sub(a);
    const len = dir.length() * 1.02;
    // Each ring flares at its base and narrows to its top: the stepped silhouette of leaf scars.
    const geo = new THREE.CylinderGeometry(radius((i + 1) / SEGS) * 0.86, radius(i / SEGS) * 1.08, len, 6);
    geo.rotateY(i * 0.5);
    geo.translate(0, len / 2, 0);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
    geo.translate(a.x, a.y, a.z);
    // Grey-brown, darker toward the ground.
    g.add(mesh(paint(geo, 0x8f7a62, (p) => 0.75 + 0.25 * (p.y / H)), mats.bark));
  }
  const top = at(1);
  const boot = new THREE.CylinderGeometry(0.035 * s, 0.05 * s, 0.07 * s, 6);
  boot.translate(top.x, top.y + 0.01 * s, top.z);
  g.add(mesh(paint(boot, 0x7a6a3c, () => 0.8), mats.bark));
  const yaw = hash(x, z, 3) * Math.PI * 2;
  for (let i = 0; i < 3; i++) {
    const a = yaw + i * 2.1;
    const nut = new THREE.IcosahedronGeometry(0.032 * s, 0);
    nut.translate(top.x + Math.cos(a) * 0.045 * s, top.y - 0.035 * s, top.z + Math.sin(a) * 0.045 * s);
    g.add(mesh(paint(nut, 0x6f7a2e, () => 0.8), mats.bark));
  }
  // Dead fronds hang under the crown; seven old ones arch out and droop; three young ones stand up in the middle.
  const tiers = [
    { n: 2, len: 0.3, width: 0.06, rise: 0, droop: 1.3, off: 0.25, base: 0x9a7a48, tip: 0x7a5f38 },
    { n: 7, len: 0.48, width: 0.095, rise: 0.55, droop: 0.85, off: 0, base: 0x4f8a36, tip: 0x93b552 },
    { n: 3, len: 0.42, width: 0.08, rise: 1.0, droop: 0.6, off: 0.5, base: 0x5f9e40, tip: 0x9cc75c },
  ];
  const tint = new THREE.Color();
  for (const [ti, t] of tiers.entries()) {
    for (let i = 0; i < t.n; i++) {
      const h = hash(x + i, z - ti, 4);
      const len = t.len * s * (0.9 + h * 0.2);
      const geo = frond(len, t.width * s, t.rise, t.droop * (0.85 + h * 0.3));
      // Colour runs from the stalk to a sunlit, yellower tip; v is the distance along the frond.
      const uv = geo.attributes.uv;
      const col = new Float32Array(uv.count * 3);
      for (let k = 0; k < uv.count; k++) {
        tint.set(t.base).lerp(new THREE.Color(t.tip), uv.getY(k)).multiplyScalar(1.35 * (0.9 + h * 0.2));
        col.set([tint.r, tint.g, tint.b], k * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geo.rotateZ((h - 0.5) * 0.5);
      geo.rotateY(yaw + ((i + t.off) / t.n) * Math.PI * 2 + (h - 0.5) * 0.35);
      geo.translate(top.x, top.y + 0.04 * s, top.z);
      g.add(mesh(geo, mats.frond));
    }
  }
}

/**
 * Leafy crown mass: a subdivided icosahedron swollen into a few lobes, its
 * underside pressed nearly flat as on a real crown. Normals blend the radial
 * direction with the face so the mass shades round but keeps its facets; UVs
 * are box-projected per face at a fixed world scale so leaves match across
 * trees of any size.
 */
function crown(r: number, c: THREE.Vector3, detail: number, seed: number, squash = 0.84): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const rand = rng(Math.floor(seed * 9973) + 1);
  const lobes = Array.from({ length: 5 }, () => new THREE.Vector3(rand() * 2 - 1, rand() * 1.4 - 0.3, rand() * 2 - 1).normalize());
  const p = geo.attributes.position;
  const n = new THREE.Vector3();
  const dirs: THREE.Vector3[] = [];
  for (let i = 0; i < p.count; i++) {
    n.fromBufferAttribute(p, i).normalize();
    let k = 0.8;
    for (const l of lobes) k += 0.42 * Math.max(0, n.dot(l)) ** 4;
    // Hash the unit direction so copies of a shared corner move together and the crown stays closed.
    k += (hash(n.x * 7.1 + seed, n.z * 5.3 + n.y * 3.7, seed) - 0.5) * 0.1;
    let y = n.y * k * squash;
    if (y < -0.4) y = -0.4 + (y + 0.4) * 0.25;
    p.setXYZ(i, n.x * k * r + c.x, y * r + c.y, n.z * k * r + c.z);
    dirs.push(n.clone());
  }
  const normals = new Float32Array(p.count * 3);
  const face = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    faceNormal(p, i, face);
    for (let k = 0; k < 3; k++) {
      const m = dirs[i + k].clone().multiplyScalar(0.65).addScaledVector(face, 0.35).normalize();
      normals.set([m.x, m.y, m.z], (i + k) * 3);
    }
  }
  geo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return boxUV(geo, seed);
}

function faceNormal(p: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number, out: THREE.Vector3): THREE.Vector3 {
  const a = new THREE.Vector3().fromBufferAttribute(p, i);
  const b = new THREE.Vector3().fromBufferAttribute(p, i + 1);
  const c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
  return out.subVectors(c, b).cross(a.sub(b)).normalize();
}

/**
 * Box-projected UVs per face of a non-indexed geometry, at a fixed world scale
 * so leaves are the same size on every tree; `seed` shifts the pattern.
 */
function boxUV(geo: THREE.BufferGeometry, seed: number): THREE.BufferGeometry {
  const TILE = 0.42;
  const p = geo.attributes.position;
  const uvs = new Float32Array(p.count * 2);
  const face = new THREE.Vector3();
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    faceNormal(p, i, face);
    const ax = Math.abs(face.x);
    const ay = Math.abs(face.y);
    const az = Math.abs(face.z);
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(p, i + k);
      const [s, t] = ax >= ay && ax >= az ? [v.z, v.y] : ay >= az ? [v.x, v.z] : [v.x, v.y];
      uvs.set([s / TILE + seed, t / TILE + seed * 0.7], (i + k) * 2);
    }
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  return geo;
}

/**
 * Italian stone pine, ~1.05·s tall: a tall bare trunk with a slight lean, forking near the top into limbs that carry a
 * wide, flat-topped umbrella crown with a few lobes breaking its rim.
 */
function umbrellaPine(g: THREE.Group, s: number, yaw: number, v: number, x: number, z: number): void {
  const mats = treeMaterials();
  const lean = (hash(x, z, 11) - 0.5) * 0.16;
  const trunk = new THREE.CylinderGeometry(0.026 * s, 0.05 * s, 0.78 * s, 6);
  trunk.translate(0, 0.39 * s, 0);
  trunk.rotateZ(lean);
  trunk.rotateY(yaw);
  g.add(mesh(paint(trunk, 0x7a5a45, (q) => 0.7 + 0.45 * (q.y / s)), mats.bark));
  // The crown sits over the trunk's leaning top.
  const top = new THREE.Vector3(-Math.sin(lean) * 0.78 * s, 0.78 * s, 0).applyAxisAngle(UP, yaw);
  for (let i = 0; i < 3; i++) {
    const limb = new THREE.CylinderGeometry(0.011 * s, 0.019 * s, 0.2 * s, 5);
    limb.translate(0, 0.1 * s, 0);
    limb.rotateZ(0.95);
    limb.rotateY(yaw + (i / 3) * Math.PI * 2);
    limb.translate(top.x, top.y - 0.06 * s, top.z);
    g.add(mesh(paint(limb, 0x7a5a45, () => 0.9), mats.bark));
  }
  const hue = 0x3f7434;
  const bottom = 0.78 * s;
  const height = 0.26 * s;
  const shade = (q: THREE.Vector3) => {
    const t = Math.min(1, Math.max(0, (q.y - bottom) / height));
    return 0.48 + 0.62 * t * t * (3 - 2 * t);
  };
  // A flattened central canopy with four smaller, flatter lobes on its rim.
  g.add(mesh(paint(crown(0.3 * s, new THREE.Vector3(top.x, 0.9 * s, top.z), 2, v + 1, 0.36), hue, shade), mats.canopy));
  for (let i = 0; i < 4; i++) {
    const h = hash(x + i, z - i, 13);
    const a = yaw + (i / 4) * Math.PI * 2 + (h - 0.5) * 0.8;
    const d = (0.2 + h * 0.06) * s;
    const c = new THREE.Vector3(top.x + Math.cos(a) * d, (0.88 + h * 0.04) * s, top.z + Math.sin(a) * d);
    g.add(mesh(paint(crown((0.14 + h * 0.04) * s, c, 1, v + 2 + i, 0.42), hue, shade), mats.canopy));
  }
}

export function tree(p: Place & { s?: number; kind?: 'round' | 'cone' | 'palm' | 'blossom' | 'umbrella' } = {}): THREE.Group {
  const s = p.s ?? 1;
  const g = group(p);
  const kind = p.kind ?? 'round';
  const x = p.x ?? 0;
  const z = p.z ?? 0;
  if (kind === 'palm') {
    palm(g, s, x, z);
    return g;
  }
  // Per-instance variation from position keeps rows of trees from looking stamped.
  const v = Math.abs(Math.sin(x * 12.9898 + z * 78.233)) % 1;
  const sv = s * (0.85 + v * 0.3);
  const mats = treeMaterials();
  const yaw = hash(x, z, 5) * Math.PI * 2;
  if (kind === 'cone') {
    const trunk = new THREE.CylinderGeometry(0.035 * sv, 0.05 * sv, 0.32 * sv, 6);
    trunk.translate(0, 0.16 * sv, 0);
    g.add(mesh(paint(trunk, 0x5e4330, () => 0.8), mats.bark));
    // Two needle tiers, the lower in its own shade at the hem.
    for (const [r, h, y] of [[0.3, 0.6, 0.2], [0.22, 0.55, 0.52]]) {
      const tier = new THREE.CylinderGeometry(0, r * sv, h * sv, 7).toNonIndexed();
      tier.rotateY(yaw);
      tier.translate(0, (y + h / 2) * sv, 0);
      g.add(mesh(paint(boxUV(tier, v), 0x3c7838, (q) => 0.62 + 0.45 * Math.min(1, q.y / (1.07 * sv))), mats.canopy));
    }
    return g;
  }
  if (kind === 'umbrella') {
    umbrellaPine(g, sv, yaw, v, x, z);
    return g;
  }
  // Trunk and two limbs forking up into the crown, visible under its flat underside.
  const trunk = new THREE.CylinderGeometry(0.026 * sv, 0.048 * sv, 0.5 * sv, 6);
  trunk.translate(0, 0.25 * sv, 0);
  g.add(mesh(paint(trunk, 0x6e4c33, (q) => 0.7 + 0.5 * (q.y / sv)), mats.bark));
  for (const side of [0, Math.PI * 0.9]) {
    const limb = new THREE.CylinderGeometry(0.012 * sv, 0.02 * sv, 0.22 * sv, 5);
    limb.translate(0, 0.11 * sv, 0);
    limb.rotateZ(0.65);
    limb.rotateY(yaw + side);
    limb.translate(0, 0.3 * sv, 0);
    g.add(mesh(paint(limb, 0x6e4c33, () => 0.95), mats.bark));
  }
  const blossom = kind === 'blossom';
  // Two greens so neighbouring trees differ; blossom pink.
  const hue = blossom ? 0xf2bccb : v < 0.35 ? 0x4a8a3c : 0x5f9e44;
  const bottom = 0.4 * sv;
  const height = 0.55 * sv;
  // Shade from the crown's underside (in its own shadow) up to the sunlit top.
  const shade = (q: THREE.Vector3) => {
    const t = Math.min(1, Math.max(0, (q.y - bottom) / height));
    return 0.5 + 0.6 * t * t * (3 - 2 * t);
  };
  // A lobed central mass with three smaller crowns bulging out of its upper flanks: a broken, cumulus outline.
  g.add(mesh(paint(crown(0.27 * sv, new THREE.Vector3(0, 0.6 * sv, 0), 2, v + 1), hue, shade), mats.canopy));
  for (let i = 0; i < 3; i++) {
    const h = hash(x - i, z + i, 7);
    const a = yaw + (i / 3) * Math.PI * 2 + (h - 0.5) * 0.9;
    const d = (0.18 + h * 0.04) * sv;
    const c = new THREE.Vector3(Math.cos(a) * d, (0.6 + h * 0.16) * sv, Math.sin(a) * d);
    g.add(mesh(paint(crown((0.13 + h * 0.04) * sv, c, 1, v + 2 + i), hue, shade), mats.canopy));
  }
  return g;
}
