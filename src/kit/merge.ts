import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/**
 * Bake every static single-material mesh under `root` into one mesh per
 * material, cutting draw calls from thousands to a few dozen.
 *
 * Skipped (kept as-is): subtrees with `userData.dynamic`, multi-material
 * meshes, and non-Mesh objects (points, lines, lights).
 */
export function mergeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMat = new Map<THREE.Material, THREE.Mesh[]>();

  const visit = (o: THREE.Object3D): void => {
    if (o.userData.dynamic) return;
    // A mesh that parents other objects stays: removing it would take its children along.
    const mergeable =
      o instanceof THREE.Mesh && o.children.length === 0 && !Array.isArray(o.material) && !(o.material as THREE.MeshStandardMaterial).map;
    if (mergeable) {
      const list = byMat.get(o.material);
      if (list) list.push(o);
      else byMat.set(o.material, [o]);
    }
    for (const c of o.children) visit(c);
  };
  for (const c of root.children) visit(c);

  for (const [material, meshes] of byMat) {
    const geos = meshes.map((o) => {
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const name of Object.keys(geo.attributes)) if (name !== 'position' && name !== 'normal') geo.deleteAttribute(name);
      if (!geo.attributes.normal) geo.computeVertexNormals();
      geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      geo.clearGroups();
      return geo;
    });
    const merged = mergeGeometries(geos, false);
    for (const g of geos) g.dispose();
    // Incompatible buffers: keep the originals rather than losing them.
    if (!merged) continue;
    for (const m of meshes) {
      m.removeFromParent();
      m.geometry.dispose();
    }
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = meshes.some((m) => m.castShadow);
    mesh.receiveShadow = true;
    // Identity local matrix; flag the world matrix dirty once since it never auto-updates.
    mesh.matrixAutoUpdate = false;
    mesh.matrixWorldNeedsUpdate = true;
    root.add(mesh);
  }
  pruneEmptyGroups(root);
}

function pruneEmptyGroups(o: THREE.Object3D): void {
  for (const c of [...o.children]) {
    pruneEmptyGroups(c);
    if (c.type === 'Group' && c.children.length === 0 && !c.userData.dynamic) c.removeFromParent();
  }
}

/** Free GPU geometry for a subtree. Materials are shared and kept. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Points || o instanceof THREE.LineSegments) o.geometry.dispose();
  });
}
