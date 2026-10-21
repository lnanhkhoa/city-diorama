import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mat, mergeStatic, shape, type ShapeData } from '../src/kit';
import { encodeShapePart } from '../src/kit/shape';

// Tetrahedron in the normalised frame: width 0.8, height 1, depth 0.4.
const SIZE = [0.8, 1, 0.4] as const;
const POS = new Float32Array([-0.4, 0, -0.2, 0.4, 0, -0.2, 0.1, 0, 0.2, 0.05, 1, 0]);
const DATA: ShapeData = {
  size: SIZE,
  parts: [
    encodeShapePart(POS, new Uint32Array([0, 2, 1, 0, 1, 3]), SIZE),
    encodeShapePart(POS, new Uint32Array([1, 2, 3, 2, 0, 3]), SIZE),
  ],
};

describe('shape', () => {
  it('round-trips vertices within the quantisation step and scales by height', () => {
    const g = shape(DATA, mat(0x808080), { height: 2, smooth: true });
    const pos = (g.children[0] as THREE.Mesh).geometry.attributes.position;
    for (let v = 0; v < 4; v++) {
      for (let a = 0; a < 3; a++) {
        const step = (SIZE[a] * 2) / 65535;
        expect(Math.abs(pos.getComponent(v, a) - POS[v * 3 + a] * 2)).toBeLessThanOrEqual(step);
      }
    }
  });

  it('is bottom-anchored at its place and merges with the rest of the city', () => {
    const root = new THREE.Group();
    root.add(shape(DATA, [mat(0x111111), mat(0xeeeeee)], { x: 3, y: 0.5, z: -2, height: 4 }));
    mergeStatic(root);
    const b = new THREE.Box3().setFromObject(root);
    expect(b.min.y).toBeCloseTo(0.5, 4);
    expect(b.max.y).toBeCloseTo(4.5, 4);
    expect((b.min.x + b.max.x) / 2).toBeCloseTo(3, 4);
    expect((b.min.z + b.max.z) / 2).toBeCloseTo(-2, 4);
    expect(root.children).toHaveLength(2);
  });

  it('rejects a material list that does not match the parts', () => {
    expect(() => shape(DATA, [mat(0x111111)])).toThrow(/2 parts/);
  });
});
