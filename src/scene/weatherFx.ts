import * as THREE from 'three';
import type { WeatherKind } from '../weather/codes';

const AREA = 22;
const TOP = 18;
const FLOOR = -1;

/** Rain streaks and snowflakes, confined to the diorama volume. */
export class WeatherFx {
  readonly group = new THREE.Group();
  private rain: THREE.LineSegments;
  private snow: THREE.Points;

  constructor(private readonly reducedMotion: boolean) {
    this.rain = this.makeRain(1800);
    this.snow = this.makeSnow(1600);
    this.group.add(this.rain, this.snow);
    this.set('clear');
  }

  set(kind: WeatherKind): void {
    this.rain.visible = kind === 'rain';
    this.snow.visible = kind === 'snow';
  }

  update(t: number, dt: number): void {
    if (this.reducedMotion) return;
    if (this.rain.visible) {
      const pos = this.rain.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const fall = 22 * dt;
      for (let i = 0; i < arr.length; i += 6) {
        arr[i + 1] -= fall;
        arr[i + 4] -= fall;
        if (arr[i + 4] < FLOOR) {
          const y = TOP + Math.random() * 2;
          arr[i + 1] = y + 0.45;
          arr[i + 4] = y;
        }
      }
      pos.needsUpdate = true;
    }
    if (this.snow.visible) {
      const pos = this.snow.geometry.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      for (let i = 0; i < arr.length; i += 3) {
        arr[i + 1] -= 1.6 * dt;
        arr[i] += Math.sin(t * 0.8 + i) * 0.4 * dt;
        if (arr[i + 1] < FLOOR) arr[i + 1] = TOP;
      }
      pos.needsUpdate = true;
    }
  }

  private makeRain(n: number): THREE.LineSegments {
    const arr = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) {
      const x = (Math.random() - 0.5) * AREA;
      const z = (Math.random() - 0.5) * AREA;
      const y = FLOOR + Math.random() * (TOP - FLOOR);
      arr.set([x, y + 0.45, z, x, y, z], i * 6);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc7d6e6, transparent: true, opacity: 0.5 }));
    m.frustumCulled = false;
    return m;
  }

  private makeSnow(n: number): THREE.Points {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) arr.set([(Math.random() - 0.5) * AREA, FLOOR + Math.random() * (TOP - FLOOR), (Math.random() - 0.5) * AREA], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const m = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.2, map: flakeTexture(), transparent: true, depthWrite: false }));
    m.frustumCulled = false;
    return m;
  }
}

function flakeTexture(): THREE.Texture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
}
