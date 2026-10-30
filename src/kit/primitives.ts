import * as THREE from 'three';
import { M, lampMaterial, mat, windowMaterial } from './materials';
import { mergeStatic } from './merge';

/**
 * Placement shared by every primitive. `y` is the BOTTOM of the object (the
 * tile surface is y = 0), `ry` rotates about the vertical axis in radians.
 */
export interface Place {
  x?: number;
  y?: number;
  z?: number;
  ry?: number;
}

type Mat = THREE.Material;

function place<T extends THREE.Object3D>(o: T, p: Place): T {
  o.position.set(p.x ?? 0, p.y ?? 0, p.z ?? 0);
  o.rotation.y = p.ry ?? 0;
  return o;
}

function mesh(geo: THREE.BufferGeometry, material: Mat): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function group(p: Place = {}, ...children: THREE.Object3D[]): THREE.Group {
  const g = place(new THREE.Group(), p);
  if (children.length) g.add(...children);
  return g;
}

// ---------------------------------------------------------------------------
// Solids (bottom-anchored)
// ---------------------------------------------------------------------------

export function box(w: number, h: number, d: number, material: Mat, p: Place = {}): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(0, h / 2, 0);
  return place(mesh(geo, material), p);
}

export function cylinder(
  rTop: number,
  rBottom: number,
  h: number,
  material: Mat,
  p: Place & { segments?: number; open?: boolean } = {},
): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(rTop, rBottom, h, p.segments ?? 24, 1, p.open ?? false);
  geo.translate(0, h / 2, 0);
  return place(mesh(geo, material), p);
}

export function cone(r: number, h: number, material: Mat, p: Place & { segments?: number } = {}): THREE.Mesh {
  return cylinder(0, r, h, material, p);
}

/** Hemisphere sitting on its flat face. `squash` scales it vertically. */
export function dome(r: number, material: Mat, p: Place & { squash?: number; segments?: number } = {}): THREE.Mesh {
  const s = p.segments ?? 24;
  const geo = new THREE.SphereGeometry(r, s, Math.max(6, s / 2), 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, p.squash ?? 1, 1);
  return place(mesh(geo, material), p);
}

export function sphere(r: number, material: Mat, p: Place & { segments?: number } = {}): THREE.Mesh {
  const s = p.segments ?? 16;
  const geo = new THREE.SphereGeometry(r, s, Math.max(6, s / 2));
  geo.translate(0, r, 0);
  return place(mesh(geo, material), p);
}

/** Surface of revolution from `[radius, height]` profile points (bottom to top). */
export function lathe(profile: [number, number][], material: Mat, p: Place & { segments?: number } = {}): THREE.Mesh {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.0001), y));
  return place(mesh(new THREE.LatheGeometry(pts, p.segments ?? 24), material), p);
}

/**
 * Extrude a 2D outline (in the XZ plane, points `[x, z]`) upward by `h`.
 * Optional `holes` cut through the prism.
 */
export function prism(outline: [number, number][], h: number, material: Mat, p: Place & { holes?: [number, number][][] } = {}): THREE.Mesh {
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hole of p.holes ?? []) shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  return place(mesh(geo, material), p);
}

/**
 * Extrude a 2D side profile (points `[x, y]` in the XY plane) through depth
 * `d` along Z, centred on z = 0. Good for arches, gables and bridge decks.
 */
export function profile(points: [number, number][], d: number, material: Mat, p: Place & { holes?: [number, number][][] } = {}): THREE.Mesh {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const hole of p.holes ?? []) shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, curveSegments: 10 });
  geo.translate(0, 0, -d / 2);
  return place(mesh(geo, material), p);
}

/** Points along a semicircular arch, for use in `profile` holes. */
export function archHole(cx: number, width: number, springY: number, segments = 10): [number, number][] {
  const r = width / 2;
  const pts: [number, number][] = [[cx - r, 0]];
  for (let i = 0; i <= segments; i++) {
    const a = Math.PI - (i / segments) * Math.PI;
    pts.push([cx + Math.cos(a) * r, springY + Math.sin(a) * r]);
  }
  pts.push([cx + r, 0]);
  return pts;
}

/** Thick tube along a curve (cables, rails, arches). */
export function tube(points: THREE.Vector3[], radius: number, material: Mat, p: Place & { segments?: number } = {}): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(points);
  const geo = new THREE.TubeGeometry(curve, p.segments ?? 32, radius, 6, false);
  return place(mesh(geo, material), p);
}

/** Square-section strut from point `a` to point `b` (lattice legs, cables, braces). */
export function beam(a: [number, number, number], b: [number, number, number], thickness: number, material: Mat): THREE.Mesh {
  const from = new THREE.Vector3(...a);
  const to = new THREE.Vector3(...b);
  const len = from.distanceTo(to);
  const geo = new THREE.BoxGeometry(thickness, len, thickness);
  geo.translate(0, len / 2, 0);
  const m = mesh(geo, material);
  m.position.copy(from);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.sub(from).normalize());
  return m;
}

// ---------------------------------------------------------------------------
// Roofs
// ---------------------------------------------------------------------------

/** Triangular-prism roof; ridge runs along X. */
export function gableRoof(w: number, d: number, h: number, material: Mat, p: Place = {}): THREE.Mesh {
  return profile([[-d / 2, 0], [d / 2, 0], [0, h]], w, material, { ...p, ry: (p.ry ?? 0) + Math.PI / 2 });
}

/** Four-sided pyramid / hip roof. */
export function hipRoof(w: number, d: number, h: number, material: Mat, p: Place = {}): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0, Math.SQRT1_2, 1, 4, 1).toNonIndexed();
  geo.rotateY(Math.PI / 4);
  geo.scale(w, h, d);
  geo.translate(0, h / 2, 0);
  // Per-face normals: the cylinder's smooth ones bend shading and reflections across each planar face.
  geo.computeVertexNormals();
  return place(mesh(geo, material), p);
}

/** Parisian mansard: steep sloped sides with a flat top. */
export function mansardRoof(w: number, d: number, h: number, material: Mat, p: Place & { inset?: number } = {}): THREE.Mesh {
  const i = p.inset ?? Math.min(w, d) * 0.22;
  const geo = new THREE.CylinderGeometry(Math.SQRT1_2, Math.SQRT1_2, 1, 4, 1);
  geo.rotateY(Math.PI / 4);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let k = 0; k < pos.count; k++) {
    const top = pos.getY(k) > 0;
    const sx = top ? (w - 2 * i) : w;
    const sz = top ? (d - 2 * i) : d;
    pos.setXYZ(k, pos.getX(k) * sx, (pos.getY(k) + 0.5) * h, pos.getZ(k) * sz);
  }
  geo.computeVertexNormals();
  return place(mesh(geo, material), p);
}

// ---------------------------------------------------------------------------
// Buildings
// ---------------------------------------------------------------------------

export interface BuildingOptions extends Place {
  w: number;
  d: number;
  h: number;
  wall?: Mat;
  /** Cornice, sills, base course and parapet material (defaults to `wall`). */
  trim?: Mat;
  roof?: 'flat' | 'gable' | 'hip' | 'mansard';
  roofMat?: Mat;
  roofH?: number;
  /** Window layout on all four facades. */
  windows?: 'grid' | 'bands' | 'none';
  floorH?: number;
  /** Skip cornice/sills/base/door/rooftop clutter (sleek glass towers, sections). */
  plain?: boolean;
  /** Awning colour: turns the +z ground floor into a lit shopfront with fascia and awning. */
  shop?: THREE.ColorRepresentation;
}

/**
 * Block building read as a constructed object: base course, window sills,
 * cornice, entrance door, then a roof with chimneys (pitched) or a parapet
 * with rooftop plant (flat). Windows use the shared `windowMaterial`, so they
 * glow at night.
 */
export function building(o: BuildingOptions): THREE.Group {
  const g = group(o);
  const wall = o.wall ?? M.stone;
  const trim = o.trim ?? wall;
  const detailed = !o.plain && o.h >= 0.9;
  g.add(box(o.w, o.h, o.d, wall));
  const floorH = o.floorH ?? 0.55;
  const style = o.windows ?? 'grid';
  // A shopfront takes the ground floor, so upper windows start a floor higher.
  const shop = o.shop !== undefined && o.h >= 1.2;
  const startY = shop ? 0.62 : 0.3;
  if (style !== 'none') facadeWindows(g, o.w, o.d, o.h, floorH, style, detailed ? trim : null, startY);
  if (detailed) {
    // Base course and cornice wrap the block; they cast the thin shadow lines
    // that make a facade read as built rather than as a painted box.
    g.add(box(o.w + 0.05, 0.22, o.d + 0.05, trim));
    g.add(box(o.w + 0.12, 0.08, o.d + 0.12, trim, { y: o.h - 0.08 }));
    if (!shop) g.add(box(Math.min(0.32, o.w * 0.3), 0.42, 0.05, M.dark, { z: o.d / 2 + 0.01 }));
  }
  if (shop) {
    const front = o.d / 2;
    g.add(box(o.w * 0.86, 0.36, 0.05, windowMaterial, { y: 0.06, z: front + 0.01 }));
    g.add(box(o.w * 0.9, 0.09, 0.07, trim, { y: 0.42, z: front + 0.02 }));
    const awning = box(o.w * 0.84, 0.03, 0.24, mat(o.shop!, { roughness: 0.7 }), { y: 0.47, z: front + 0.12 });
    awning.rotation.x = 0.28;
    g.add(awning);
  }
  const roof = o.roof ?? 'flat';
  const rm = o.roofMat ?? M.slate;
  const rh = o.roofH ?? Math.min(o.w, o.d) * 0.4;
  if (roof === 'flat') {
    const roofSlab = mat(0x9a9a96);
    g.add(box(o.w - 0.04, 0.03, o.d - 0.04, roofSlab, { y: o.h }));
    if (detailed) {
      const t = 0.06;
      const ph = 0.12;
      g.add(box(o.w + 0.04, ph, t, trim, { y: o.h, z: o.d / 2 - t / 2 + 0.02 }));
      g.add(box(o.w + 0.04, ph, t, trim, { y: o.h, z: -o.d / 2 + t / 2 - 0.02 }));
      g.add(box(t, ph, o.d, trim, { y: o.h, x: o.w / 2 - t / 2 + 0.02 }));
      g.add(box(t, ph, o.d, trim, { y: o.h, x: -o.w / 2 + t / 2 - 0.02 }));
      if (o.w > 1.1 && o.d > 1.1) {
        // Rooftop plant: a stair head and an AC unit, offset from centre.
        g.add(box(o.w * 0.28, 0.26, o.d * 0.24, M.concrete, { y: o.h, x: -o.w * 0.18, z: o.d * 0.12 }));
        g.add(box(0.22, 0.14, 0.22, M.steel, { y: o.h, x: o.w * 0.22, z: -o.d * 0.2 }));
      }
    }
  } else {
    if (roof === 'gable') g.add(gableRoof(o.w + 0.16, o.d + 0.16, rh, rm, { y: o.h }));
    else if (roof === 'hip') g.add(hipRoof(o.w + 0.18, o.d + 0.18, rh, rm, { y: o.h }));
    else g.add(mansardRoof(o.w + 0.08, o.d + 0.08, rh, rm, { y: o.h }));
    if (detailed && o.w > 0.9) {
      const chimney = mat(0xa0634a);
      g.add(box(0.14, rh * 0.75 + 0.2, 0.14, chimney, { y: o.h + rh * 0.25, x: o.w * 0.3, z: -o.d * 0.15 }));
      if (o.w > 2) g.add(box(0.14, rh * 0.75 + 0.2, 0.14, chimney, { y: o.h + rh * 0.25, x: -o.w * 0.3, z: o.d * 0.1 }));
    }
  }
  return g;
}

function facadeWindows(g: THREE.Group, w: number, d: number, h: number, floorH: number, style: 'grid' | 'bands', sill: Mat | null, startY: number): void {
  const floors = Math.max(1, Math.floor((h - startY) / floorH));
  const t = 0.04;
  const winH = floorH * 0.5;
  for (const [len, depth, rot] of [[w, d, 0], [d, w, Math.PI / 2]] as const) {
    for (const side of [1, -1]) {
      const off = (depth / 2 + t / 2 - 0.01) * side;
      for (let f = 0; f < floors; f++) {
        const y = startY + f * floorH + (floorH - winH) / 2;
        if (style === 'bands') {
          const b = box(len * 0.86, winH, t, windowMaterial, { y });
          positionOnFace(b, 0, off, rot);
          g.add(b);
        } else {
          const cols = Math.max(1, Math.floor(len / 0.45));
          const step = len / cols;
          for (let c = 0; c < cols; c++) {
            const b = box(step * 0.45, winH, t, windowMaterial, { y });
            positionOnFace(b, -len / 2 + step * (c + 0.5), off, rot);
            g.add(b);
          }
        }
        if (sill) {
          // One continuous sill course per floor: cheap, and it carries the floor rhythm.
          const s = box(len * 0.92, 0.035, 0.07, sill, { y: y - 0.045 });
          positionOnFace(s, 0, (depth / 2 + 0.025) * side, rot);
          g.add(s);
        }
      }
    }
  }
}

function positionOnFace(o: THREE.Object3D, along: number, off: number, rot: number): void {
  if (rot === 0) o.position.set(along, o.position.y, off);
  else {
    o.position.set(off, o.position.y, along);
    o.rotation.y = rot;
  }
}

export interface TowerOptions extends Place {
  w: number;
  d: number;
  /** Section heights; each section is narrower than the last by `step`. */
  sections: number[];
  step?: number;
  wall?: Mat;
  windows?: 'grid' | 'bands' | 'none';
  /** Height of a spire/antenna on top (0 for none). */
  spire?: number;
  round?: boolean;
}

/**
 * Skyscraper: a lobby podium, stacked sections narrowing by `step`, a ledge
 * at every setback and a crown on top. One section gives a plain tower.
 */
export function tower(o: TowerOptions): THREE.Group {
  const g = group(o);
  const wall = o.wall ?? M.concrete;
  const step = o.step ?? 0.35;
  const ledge = mat(0xd9d9d4);
  let y = 0;
  let w = o.w;
  let d = o.d;
  o.sections.forEach((sh, i) => {
    if (o.round) {
      g.add(cylinder(w / 2, w / 2, sh, wall, { y, segments: 24 }));
      if ((o.windows ?? 'bands') !== 'none') {
        const floors = Math.floor(sh / 0.45);
        for (let f = 0; f < floors; f++) g.add(cylinder(w / 2 + 0.02, w / 2 + 0.02, 0.2, windowMaterial, { y: y + 0.12 + f * 0.45, segments: 24, open: true }));
      }
      g.add(cylinder(w / 2 + 0.06, w / 2 + 0.06, 0.08, ledge, { y: y + sh - 0.08, segments: 24 }));
    } else {
      g.add(building({ w, d, h: sh, y, wall, windows: o.windows ?? 'grid', roof: 'flat', floorH: 0.45, plain: true }));
      g.add(box(w + 0.1, 0.08, d + 0.1, ledge, { y: y + sh - 0.08 }));
      if (i === 0) {
        // Glazed lobby with a canopy marks the street entrance.
        g.add(box(w + 0.06, 0.4, d + 0.06, M.glassDark));
        g.add(box(Math.min(0.9, w * 0.5), 0.05, 0.3, ledge, { y: 0.42, z: d / 2 + 0.15 }));
      }
    }
    y += sh;
    w = Math.max(0.3, w - step);
    d = Math.max(0.3, d - step);
  });
  // Crown: a slim mechanical penthouse so the top does not end in a bare slab.
  const cw = Math.max(0.25, w * 0.55);
  const cd = Math.max(0.25, d * 0.55);
  if (o.round) g.add(cylinder(cw / 2, cw / 2, 0.3, ledge, { y, segments: 16 }));
  else g.add(box(cw, 0.3, cd, ledge, { y }));
  y += 0.3;
  if (o.spire) g.add(cylinder(0.03, 0.08, o.spire, M.steel, { y, segments: 8 }));
  return g;
}

// ---------------------------------------------------------------------------
// Ground features (thin slabs just above the tile surface)
// ---------------------------------------------------------------------------

/** Flat rectangular patch (plaza, lawn, sand). */
export function patch(w: number, d: number, material: Mat, p: Place & { h?: number } = {}): THREE.Mesh {
  const m = box(w, p.h ?? 0.04, d, material, { ...p, y: p.y ?? 0 });
  m.castShadow = false;
  return m;
}

/** Flat polygon patch from `[x, z]` outline (rivers, harbours, parks). */
export function area(outline: [number, number][], material: Mat, p: Place & { h?: number } = {}): THREE.Mesh {
  const m = prism(outline, p.h ?? 0.04, material, p);
  m.castShadow = false;
  return m;
}

/** Straight road from (x1, z1) to (x2, z2) with a dashed centre line. */
export function road(x1: number, z1: number, x2: number, z2: number, w = 1.2, opts: { lines?: boolean; material?: Mat } = {}): THREE.Group {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const ang = Math.atan2(x2 - x1, z2 - z1);
  const g = group({ x: (x1 + x2) / 2, z: (z1 + z2) / 2, ry: ang });
  const surf = box(w, 0.05, len, opts.material ?? M.asphalt);
  surf.castShadow = false;
  g.add(surf);
  if (opts.lines ?? true) {
    const dashes = Math.floor(len / 0.6);
    for (let i = 0; i < dashes; i++) {
      const dash = box(0.06, 0.012, 0.3, M.roadLine, { y: 0.05, z: -len / 2 + 0.3 + i * 0.6 });
      dash.castShadow = false;
      g.add(dash);
    }
  }
  return g;
}

/**
 * Zebra crossing centred at (x, z) across a road `roadW` wide. Bars lie along
 * the road and step across its width: `ry` = 0 for a road running along Z,
 * π/2 for one running along X.
 */
export function crosswalk(x: number, z: number, roadW: number, p: { ry?: number; depth?: number } = {}): THREE.Group {
  const g = group({ x, z, ry: p.ry ?? 0 });
  const depth = p.depth ?? 0.4;
  const stripes = Math.max(3, Math.floor(roadW / 0.16));
  const step = roadW / stripes;
  for (let i = 0; i < stripes; i++) {
    const s = box(step * 0.55, 0.012, depth, M.roadLine, { x: -roadW / 2 + step * (i + 0.5), y: 0.05 });
    s.castShadow = false;
    g.add(s);
  }
  return g;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export function lamp(p: Place = {}): THREE.Group {
  const g = group(p);
  g.add(cylinder(0.015, 0.022, 0.5, M.dark, { segments: 5 }));
  g.add(box(0.12, 0.015, 0.015, M.dark, { y: 0.49, x: 0.05 }));
  g.add(cone(0.035, 0.03, M.dark, { y: 0.47, x: 0.1, segments: 6 }));
  g.add(sphere(0.022, lampMaterial, { y: 0.44, x: 0.1, segments: 6 }));
  return g;
}

const CAR_COLORS = [0xe0b43a, 0xd04a3b, 0x3d6fb6, 0xf4f4f0, 0x2f343b, 0x5c9c6b];

function wheels(g: THREE.Group, halfW: number, axles: number[]): void {
  const tyre = M.dark;
  for (const z of axles) {
    for (const sx of [-1, 1]) {
      const w = cylinder(0.045, 0.045, 0.04, tyre, { segments: 8 });
      w.rotation.z = Math.PI / 2;
      w.position.set(sx * halfW, 0.045, z);
      w.geometry.translate(0, -0.02, 0);
      g.add(w);
    }
  }
}

/** Car (or taxi) facing +z. Pre-merged per material: it animates, so the scene merger skips it. */
export function car(p: Place & { color?: THREE.ColorRepresentation; taxi?: boolean } = {}): THREE.Group {
  const g = group(p);
  const c = p.taxi ? 0xf2c230 : p.color ?? CAR_COLORS[Math.abs(Math.round((p.x ?? 0) * 7 + (p.z ?? 0) * 13)) % CAR_COLORS.length];
  const paint = mat(c, { roughness: 0.35, metalness: 0.1, surface: 'none' });
  g.add(box(0.22, 0.08, 0.44, paint, { y: 0.04 }));
  g.add(box(0.19, 0.08, 0.24, paint, { y: 0.12, z: -0.03 }));
  g.add(box(0.2, 0.055, 0.2, windowMaterial, { y: 0.13, z: -0.03 }));
  g.add(box(0.16, 0.02, 0.02, lampMaterial, { y: 0.07, z: 0.22 }));
  if (p.taxi) g.add(box(0.07, 0.03, 0.04, M.white, { y: 0.2, z: -0.03 }));
  wheels(g, 0.1, [0.13, -0.14]);
  mergeStatic(g);
  return g;
}

export function bus(p: Place & { color?: THREE.ColorRepresentation } = {}): THREE.Group {
  const g = group(p);
  const paint = mat(p.color ?? 0xc8433a, { roughness: 0.4, surface: 'none' });
  g.add(box(0.26, 0.24, 0.8, paint, { y: 0.04 }));
  g.add(box(0.27, 0.07, 0.7, windowMaterial, { y: 0.17 }));
  g.add(box(0.27, 0.02, 0.82, M.white, { y: 0.28 }));
  wheels(g, 0.12, [0.26, -0.26]);
  mergeStatic(g);
  return g;
}

export function boat(p: Place & { color?: THREE.ColorRepresentation; len?: number } = {}): THREE.Group {
  const g = group(p);
  const l = p.len ?? 0.7;
  g.add(profile([[-l / 2, 0.05], [l / 2, 0.05], [l / 2 - 0.08, -0.02], [-l / 2 + 0.12, -0.02]], 0.22, mat(p.color ?? 0xf4f4f0, { roughness: 0.5 }), { ry: Math.PI / 2 }));
  g.add(box(0.23, 0.02, l * 0.92, M.wood, { y: 0.05 }));
  g.add(box(0.16, 0.1, l * 0.4, M.white, { y: 0.06 }));
  g.add(box(0.17, 0.04, l * 0.38, windowMaterial, { y: 0.1 }));
  mergeStatic(g);
  return g;
}

const PEOPLE_COLORS = [0xc8433a, 0x3d6fb6, 0xe0b43a, 0x2f343b, 0xf4f4f0, 0x6a9a5b, 0x9a5bb0];
// People stay dry and snow-free: no white heads or shoulders.
const SKIN = mat(0xe2b48e, { surface: 'none' });
const HAIR = [mat(0x2a211c, { surface: 'none' }), mat(0x6b4a2e, { surface: 'none' }), mat(0xc9a06a, { surface: 'none' })];

/**
 * Pedestrian, ~0.23 tall (1 unit ≈ 8 m): trousers, a flared coat with arms,
 * head with hair. `umbrella` adds a domed canopy held in the right hand and
 * tilted forward. Without `ry`, a figure placed by `x`/`z` faces a direction
 * hashed from its position, so crowds do not all face +z. Pre-merged per
 * material, so it can be handed to `Animator.follow` as is.
 */
export function person(p: Place & { color?: THREE.ColorRepresentation; umbrella?: THREE.ColorRepresentation } = {}): THREE.Group {
  const placed = p.x !== undefined || p.z !== undefined;
  const facing = (((Math.sin((p.x ?? 0) * 12.9898 + (p.z ?? 0) * 78.233) * 43758.5453) % 1) + 1) % 1;
  const g = group({ ...p, ry: p.ry ?? (placed ? facing * Math.PI * 2 : 0) });
  const seed = Math.abs(Math.round((p.x ?? 0) * 11 + (p.z ?? 0) * 5));
  const coat = mat(p.color ?? PEOPLE_COLORS[seed % PEOPLE_COLORS.length], { surface: 'none' });
  for (const sx of [-1, 1]) g.add(cylinder(0.011, 0.013, 0.085, M.dark, { x: sx * 0.015, segments: 4, ry: Math.PI / 4 }));
  g.add(cylinder(0.03, 0.04, 0.1, coat, { y: 0.08, segments: 6 }));
  for (const sx of [-1, 1]) g.add(cylinder(0.01, 0.011, 0.075, coat, { x: sx * 0.038, y: 0.1, segments: 4, ry: Math.PI / 4 }));
  g.add(sphere(0.024, SKIN, { y: 0.18, segments: 6 }));
  g.add(sphere(0.02, HAIR[seed % HAIR.length], { y: 0.195, segments: 6 }));
  if (p.umbrella !== undefined) {
    // Canopy about 1.4 shoulder widths across, domed, over the right shoulder and tipped into the rain.
    const u = group({ x: 0.04, y: 0.17 });
    u.rotation.x = -0.18;
    u.add(cylinder(0.004, 0.004, 0.13, M.dark, { segments: 3 }));
    u.add(lathe([[0.085, 0], [0.078, 0.015], [0.055, 0.035], [0.025, 0.048], [0, 0.052]], mat(p.umbrella, { surface: 'none' }), { y: 0.1, segments: 8 }));
    u.add(cylinder(0.003, 0.003, 0.02, M.dark, { y: 0.15, segments: 3 }));
    g.add(u);
  }
  mergeStatic(g);
  return g;
}

export function bench(p: Place = {}): THREE.Group {
  const g = group(p);
  g.add(box(0.3, 0.03, 0.09, M.wood, { y: 0.07 }));
  g.add(box(0.3, 0.07, 0.02, M.wood, { y: 0.1, z: -0.04 }));
  return g;
}

/** Billboard/screen with a flat emissive colour (Times Square, Shibuya). */
export function screen(w: number, h: number, color: THREE.ColorRepresentation, p: Place = {}): THREE.Mesh {
  return box(w, h, 0.04, mat(color, { emissive: color, emissiveIntensity: 0.6, roughness: 0.3 }), p);
}

// ---------------------------------------------------------------------------
// Scatter helpers
// ---------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32); same seed → same city layout. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rect {
  x: number;
  z: number;
  w: number;
  d: number;
}

/**
 * Place `count` objects at random points inside `r` (centre x/z, size w/d).
 * Points `avoid` returns true for are redrawn (at most 8 draws per object),
 * so crowds and trees can keep off footprints inside the rect.
 */
export function scatter(
  r: Rect,
  count: number,
  rand: () => number,
  make: (x: number, z: number, i: number) => THREE.Object3D,
  avoid?: (x: number, z: number) => boolean,
): THREE.Group {
  const g = group();
  for (let tries = 0; g.children.length < count && tries < count * 8; tries++) {
    const x = r.x + (rand() - 0.5) * r.w;
    const z = r.z + (rand() - 0.5) * r.d;
    if (!avoid?.(x, z)) g.add(make(x, z, g.children.length));
  }
  return g;
}

/** A row of `count` objects from (x1, z1) to (x2, z2) inclusive. */
export function row(x1: number, z1: number, x2: number, z2: number, count: number, make: (x: number, z: number, i: number) => THREE.Object3D): THREE.Group {
  const g = group();
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    g.add(make(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, i));
  }
  return g;
}
