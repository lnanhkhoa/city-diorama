import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { CITIES, cityFromHash, loadCity } from '../src/cities';
import type { CityBuild } from '../src/cities/types';
import { mergeStatic } from '../src/kit/merge';
import { TILE } from '../src/kit';

const MAX_HEIGHT = 14;
/** Per-city render budgets after static merging (see docs/city-authoring.md). */
const MAX_TRIANGLES = 90_000;
const MAX_DRAW_CALLS = 220;
const HEX = /^#[0-9a-f]{6}$/i;
const HALF = TILE / 2 + 0.05;

function expectOnPlinth(root: THREE.Object3D): void {
  const b = new THREE.Box3().setFromObject(root, true);
  expect(b.min.x).toBeGreaterThanOrEqual(-HALF);
  expect(b.max.x).toBeLessThanOrEqual(HALF);
  expect(b.min.z).toBeGreaterThanOrEqual(-HALF);
  expect(b.max.z).toBeLessThanOrEqual(HALF);
}

/** Order-sensitive digest of every merged vertex, to compare two builds exactly. */
function geometryDigest(root: THREE.Object3D): string {
  let n = 0;
  let acc = 0;
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const pos = o.geometry.attributes.position.array as ArrayLike<number>;
    for (let i = 0; i < pos.length; i++) acc = (acc * 31 + Math.round(pos[i] * 1e4)) % 2147483647;
    n += pos.length;
  });
  return `${n}:${acc}`;
}

describe('city registry', () => {
  it('has exactly one scene module per city, named after its slug', () => {
    const files = Object.keys(import.meta.glob('../src/cities/list/*.ts')).map((p) => p.replace(/^.*\/(.+)\.ts$/, '$1'));
    expect(files.sort()).toEqual(CITIES.map((c) => c.slug).sort());
    expect(new Set(CITIES.map((c) => c.slug)).size).toBe(CITIES.length);
  });

  it('rejects a slug without a scene module', async () => {
    await expect(loadCity('atlantis')).rejects.toThrow(/atlantis/);
  });

  it('resolves hashes to cities and falls back to the first city', () => {
    expect(cityFromHash('#/tokyo').slug).toBe('tokyo');
    expect(cityFromHash('#/NEW-YORK').slug).toBe('new-york');
    expect(cityFromHash('#tokyo').slug).toBe('tokyo');
    expect(cityFromHash('').slug).toBe(CITIES[0].slug);
    expect(cityFromHash('#/atlantis').slug).toBe(CITIES[0].slug);
  });
});

describe.each(CITIES.map((c) => [c.slug, c] as const))('%s', (_slug, city) => {
  let build: CityBuild;
  beforeAll(async () => {
    build = await loadCity(city.slug);
  });

  it('has valid metadata', () => {
    expect(city.slug).toMatch(/^[a-z]+(-[a-z]+)*$/);
    expect(Math.abs(city.lat)).toBeLessThanOrEqual(90);
    expect(Math.abs(city.lon)).toBeLessThanOrEqual(180);
    expect(() => new Intl.DateTimeFormat('en', { timeZone: city.timezone })).not.toThrow();
    expect(city.theme.bg[0]).toMatch(HEX);
    expect(city.theme.bg[1]).toMatch(HEX);
    expect(city.theme.ink).toMatch(HEX);
  });

  it('builds a diorama that stays on its plinth and within budget', () => {
    const { root } = build();
    mergeStatic(root);
    expectOnPlinth(root);
    expect(new THREE.Box3().setFromObject(root).max.y).toBeLessThanOrEqual(MAX_HEIGHT);

    let tris = 0;
    let draws = 0;
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      draws++;
      tris += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    expect(tris).toBeLessThan(MAX_TRIANGLES);
    expect(draws).toBeLessThanOrEqual(MAX_DRAW_CALLS);
  });

  it('builds identical geometry every time', () => {
    const a = build().root;
    const b = build().root;
    mergeStatic(a);
    mergeStatic(b);
    expect(geometryDigest(a)).toBe(geometryDigest(b));
  });

  it('keeps every moving object on the plinth at each moment', () => {
    const { root, update } = build();
    for (const t of [0, 3.7, 11.2, 40]) {
      update?.(t, 1 / 60);
      expectOnPlinth(root);
    }
  });
});
