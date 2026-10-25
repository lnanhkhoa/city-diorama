import type * as THREE from 'three';
import { M, mat } from './materials';
import { box, cylinder, group, profile, sphere, type Place } from './primitives';

const FLAG_RED = mat(0xda251d, { roughness: 0.7 });
const FLAG_STAR = mat(0xffcd00, { roughness: 0.6 });

/**
 * Flag of Vietnam on a pole of height `h`, scaled by `s`: a red field, width 2/3 of the length, hanging from the top
 * of the pole and flying toward +x, with a five-pointed yellow star centred on it whose points lie on a circle of
 * radius 1/5 of the length. The star is a flat pentagram centred in depth like the field and twice as thick, so it
 * stands proud of both faces.
 */
export function vietnamFlag(p: Place & { h?: number; s?: number }): THREE.Group {
  const g = group(p);
  const h = p.h ?? 1.3;
  const s = p.s ?? 1;
  g.add(cylinder(0.015 * s, 0.022 * s, h, M.steel, { segments: 5 }));
  g.add(sphere(0.025 * s, M.gold, { y: h, segments: 5 }));
  const len = 0.5 * s;
  const wid = (len * 2) / 3;
  const cy = h - 0.03 * s - wid / 2;
  g.add(box(len, wid, 0.015, FLAG_RED, { x: len / 2, y: cy - wid / 2 }));
  const R = len / 5;
  const star: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? R : R * 0.382;
    star.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  g.add(profile(star, 0.03, FLAG_STAR, { x: len / 2, y: cy }));
  return g;
}
