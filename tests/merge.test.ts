import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { Animator, M, box, building, car, group } from '../src/kit';
import { mergeStatic } from '../src/kit/merge';

function meshes(root: THREE.Object3D): THREE.Mesh[] {
  const out: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) out.push(o);
  });
  return out;
}

function triangles(root: THREE.Object3D): number {
  return meshes(root).reduce((n, m) => n + (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3, 0);
}

describe('mergeStatic', () => {
  it('batches static meshes into one mesh per material without moving geometry', () => {
    const root = group({ x: 3, ry: 0.7 });
    root.add(building({ w: 2, d: 2, h: 3, x: -4, z: 2, ry: 0.3, roof: 'gable' }));
    root.add(building({ w: 1.5, d: 3, h: 2, x: 4, z: -1, roof: 'mansard' }));
    root.add(box(1, 1, 1, M.stone, { x: 0, y: 2, z: 0 }));
    const before = new THREE.Box3().setFromObject(root, true);
    const tris = triangles(root);
    const materials = new Set(meshes(root).map((m) => m.material));

    mergeStatic(root);

    const after = new THREE.Box3().setFromObject(root, true);
    expect(after.min.distanceTo(before.min)).toBeLessThan(1e-4);
    expect(after.max.distanceTo(before.max)).toBeLessThan(1e-4);
    expect(triangles(root)).toBe(tris);
    expect(meshes(root)).toHaveLength(materials.size);
    expect(root.children.every((c) => c instanceof THREE.Mesh)).toBe(true);
  });

  it('leaves animated objects untouched and still animatable', () => {
    const anim = new Animator();
    const root = group();
    root.add(box(4, 0.1, 4, M.asphalt));
    const moving = anim.follow(car(), [[-2, 0], [2, 0]], 1);
    root.add(moving);

    mergeStatic(root);

    expect(moving.parent).toBe(root);
    expect(meshes(moving).length).toBeGreaterThan(1);
    anim.update(1, 1);
    expect(moving.position.x).toBeCloseTo(-1);
    expect(moving.rotation.y).toBeCloseTo(Math.PI / 2);
  });
});

describe('Animator.follow', () => {
  it('wraps around an open path and honours the offset', () => {
    const anim = new Animator();
    const a = anim.follow(new THREE.Object3D(), [[0, 0], [10, 0]], 2);
    const b = anim.follow(new THREE.Object3D(), [[0, 0], [10, 0]], 2, 0.5);
    anim.update(6, 0); // 12 units travelled on a 10-unit path → 2
    expect(a.position.x).toBeCloseTo(2);
    expect(b.position.x).toBeCloseTo(7);
  });

  it('closes a loop back to the first point', () => {
    const anim = new Animator();
    const o = anim.follow(new THREE.Object3D(), [[0, 0], [4, 0], [4, 4], [0, 4]], 1, 0, true);
    anim.update(14, 0); // perimeter 16 → 2 units before closing the loop
    expect(o.position.x).toBeCloseTo(0);
    expect(o.position.z).toBeCloseTo(2);
  });

  it('keeps negative offsets and reverse speeds on the path', () => {
    const anim = new Animator();
    const trailing = anim.follow(new THREE.Object3D(), [[0, 0], [10, 0]], 1, -0.25);
    const reverse = anim.follow(new THREE.Object3D(), [[0, 0], [10, 0]], -1);
    anim.update(0, 0);
    expect(trailing.position.x).toBeCloseTo(7.5);
    anim.update(3, 0);
    expect(reverse.position.x).toBeCloseTo(7);
  });
});
