import * as THREE from 'three';

export type Updater = (t: number, dt: number) => void;

/**
 * Collects per-frame updaters for a city's moving parts. Objects passed to
 * `follow`/`spin`/`bob` are flagged dynamic so the static merger skips them.
 */
export class Animator {
  private readonly fns: Updater[] = [];

  add(fn: Updater): void {
    this.fns.push(fn);
  }

  update: Updater = (t, dt) => {
    for (const fn of this.fns) fn(t, dt);
  };

  /**
   * Move `obj` along a closed or open polyline of `[x, z]` points at `speed`
   * units/s, facing the direction of travel. `offset` (fraction of the path,
   * any sign) staggers objects sharing a path. Open paths loop back to the start.
   */
  follow(obj: THREE.Object3D, path: [number, number][], speed: number, offset = 0, closed = false): THREE.Object3D {
    obj.userData.dynamic = true;
    const pts = closed ? [...path, path[0]] : path;
    const segs: number[] = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      segs.push(l);
      total += l;
    }
    const y = obj.position.y;
    if (total === 0) {
      obj.position.set(pts[0][0], y, pts[0][1]);
      return obj;
    }
    this.add((t) => {
      // Wrap into [0, 1): JS `%` keeps the sign, so negative offsets/speeds need the second pass.
      let s = (((((t * speed) / total + offset) % 1) + 1) % 1) * total;
      let i = 0;
      while (i < segs.length - 1 && s > segs[i]) s -= segs[i++];
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const k = segs[i] === 0 ? 0 : s / segs[i];
      obj.position.set(ax + (bx - ax) * k, y, az + (bz - az) * k);
      obj.rotation.y = Math.atan2(bx - ax, bz - az);
    });
    return obj;
  }

  /** Constant rotation about Y (radians/s). */
  spin(obj: THREE.Object3D, speed: number): THREE.Object3D {
    obj.userData.dynamic = true;
    this.add((_t, dt) => {
      obj.rotation.y += speed * dt;
    });
    return obj;
  }

  /** Gentle vertical bob (boats on water). */
  bob(obj: THREE.Object3D, amp = 0.02, freq = 1.2): THREE.Object3D {
    obj.userData.dynamic = true;
    const y = obj.position.y;
    const phase = obj.position.x * 1.7 + obj.position.z;
    this.add((t) => {
      obj.position.y = y + Math.sin(t * freq + phase) * amp;
    });
    return obj;
  }
}
