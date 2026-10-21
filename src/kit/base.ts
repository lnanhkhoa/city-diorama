import * as THREE from 'three';

type Mat = THREE.Material;

export const TILE = 20;

export interface BaseOptions {
  /** Top surface (streets/ground) material. */
  top: Mat;
  /** Side material (soil, stone plinth, snow). */
  side: Mat;
  depth?: number;
  radius?: number;
}

const CAP = 0.16;
const BEVEL = 0.06;
const SEAM = 0.05;
const seamMat = new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.6 });

function roundedRect(half: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(-half + r, -half);
  s.lineTo(half - r, -half);
  s.quadraticCurveTo(half, -half, half, -half + r);
  s.lineTo(half, half - r);
  s.quadraticCurveTo(half, half, half - r, half);
  s.lineTo(-half + r, half);
  s.quadraticCurveTo(-half, half, -half, half - r);
  s.lineTo(-half, -half + r);
  s.quadraticCurveTo(-half, -half, -half + r, -half);
  return s;
}

/** Extrude downward from `top` by `depth`, so the slab spans [top - depth, top]. */
function slab(shape: THREE.Shape, depth: number, top: number, material: Mat | Mat[], bevel = 0): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * bevel,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.translate(0, 0, bevel);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, top, 0);
  const m = new THREE.Mesh(geo, material);
  m.receiveShadow = true;
  m.castShadow = true;
  return m;
}

/**
 * The diorama display base, read as a crafted object: a bevelled street cap
 * whose top face sits at y = 0, a dark seam, then the strata body. Everything
 * stays within [-TILE/2, TILE/2] on X and Z.
 */
export function createBase(o: BaseOptions): THREE.Group {
  const depth = o.depth ?? 1.2;
  const r = o.radius ?? 0.6;
  const h = TILE / 2;
  const g = new THREE.Group();
  // Cap: bevel grows the outline by BEVEL, so shrink the shape to stay inside the tile.
  g.add(slab(roundedRect(h - BEVEL, r), CAP, 0, [o.top, o.top], BEVEL));
  g.add(slab(roundedRect(h - 0.1, r), SEAM, -CAP, seamMat));
  g.add(slab(roundedRect(h - 0.02, r), depth - CAP - SEAM, -CAP - SEAM, [o.side, o.side]));
  return g;
}
