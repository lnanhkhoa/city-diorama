import * as THREE from 'three';
import type { CityBuild, CityScene } from '../cities/types';
import { waterTime } from '../kit/materials';
import { disposeTree, mergeStatic } from '../kit/merge';
import { bakeShore, waterShore } from '../kit/shore';

export const INTRO_MS = 900;
const OUTRO_MS = 280;

export type ShowMode = 'animate' | 'replace';

interface Transition {
  obj: THREE.Object3D;
  start: number;
  dur: number;
  from: number;
  to: number;
  done?: () => void;
}

/**
 * The displayed city and its shrink/grow swap. Owns `root`, which the
 * diorama scene mounts; `tick` runs once per frame before rendering.
 */
export class CityStage {
  readonly root = new THREE.Group();
  private city: { scene: CityScene; holder: THREE.Group } | null = null;
  /** Incoming city, built on the first frame after the outgoing one has left the stage (see `show`). */
  private pending: { build: CityBuild; cleared: boolean } | null = null;
  private transitions: Transition[] = [];

  /**
   * @param reducedMotion Swap instantly and freeze city animation.
   * @param onMount Called after a city's build is added: its upload and shader compile are not steady-state load.
   */
  constructor(
    private readonly reducedMotion: boolean,
    private readonly onMount: (busyUntil: number) => void,
  ) {}

  /**
   * Show a city. `animate` swaps with the shrink/grow transition, after
   * `resetView` has returned the camera to the default corner; `replace`
   * rebuilds in place and keeps the camera (dev hot-swap of an edited city).
   *
   * An animated swap builds the incoming city only after the outgoing one has
   * shrunk away. Building is one long main-thread task (tens to hundreds of
   * ms); run then, the frame it holds back shows an empty stage instead of
   * the outgoing city frozen mid-turn.
   */
  show(build: CityBuild, mode: ShowMode, resetView: () => void): void {
    const instant = this.reducedMotion || mode === 'replace';
    if (this.pending && !instant) {
      // The outro already under way clears the stage for this city instead.
      this.pending.build = build;
      return;
    }
    this.pending = null;
    const prev = this.city;
    if (prev) {
      // Layouts are authored for the default corner; open each city from it.
      if (mode === 'animate') resetView();
      const retire = () => {
        this.root.remove(prev.holder);
        disposeTree(prev.holder);
      };
      this.transitions = this.transitions.filter((tr) => tr.obj !== prev.holder);
      this.city = null;
      if (!instant) {
        const pending = { build, cleared: false };
        this.pending = pending;
        this.tween(prev.holder, prev.holder.scale.x, 0.001, OUTRO_MS, () => {
          retire();
          pending.cleared = true;
        });
        return;
      }
      retire();
    }
    this.mount(build(), instant);
  }

  /** A swap is under way: a tile is scaling, or the stage waits to build the next one. */
  get settling(): boolean {
    return this.pending !== null || this.transitions.length > 0;
  }

  /** Finish any swap at once, so a snapshot never catches a half-scaled tile. */
  settle(): void {
    for (const tr of this.transitions) {
      tr.obj.scale.setScalar(Math.max(0.001, tr.to));
      tr.done?.();
    }
    this.transitions = [];
    if (this.pending) {
      const { build } = this.pending;
      this.pending = null;
      this.mount(build(), true);
    }
  }

  tick(now: number, t: number, dt: number): void {
    // The outro finished last frame and that empty stage is on screen: build behind it.
    if (this.pending?.cleared) {
      const { build } = this.pending;
      this.pending = null;
      this.mount(build(), false);
    }
    this.transitions = this.transitions.filter((tr) => {
      const k = THREE.MathUtils.clamp((now - tr.start) / tr.dur, 0, 1);
      const e = tr.to > tr.from ? easeOutBack(k) : k * k;
      tr.obj.scale.setScalar(Math.max(0.001, tr.from + (tr.to - tr.from) * e));
      if (k >= 1) tr.done?.();
      return k < 1;
    });
    // The one tile on stage (incoming or outgoing): its water samples the shore map in the tile's own frame.
    const holder = this.root.children[0];
    if (holder) waterShore.scale.value = Math.max(0.001, holder.scale.x);
    if (!this.reducedMotion) {
      this.city?.scene.update?.(t, dt);
      waterTime.value = t;
    }
  }

  private mount(scene: CityScene, instant: boolean): void {
    mergeStatic(scene.root);
    bakeShore(scene.root);
    waterShore.scale.value = instant ? 1 : 0.001;
    // Place every mover on its path now: with reduced motion this is the only update it gets.
    scene.update?.(0, 0);
    const holder = new THREE.Group();
    holder.add(scene.root);
    holder.scale.setScalar(instant ? 1 : 0.001);
    this.root.add(holder);
    this.city = { scene, holder };
    if (!instant) this.tween(holder, 0.001, 1, INTRO_MS);
    this.onMount(performance.now() + INTRO_MS);
  }

  private tween(obj: THREE.Object3D, from: number, to: number, dur: number, done?: () => void): void {
    this.transitions = this.transitions.filter((t) => t.obj !== obj);
    this.transitions.push({ obj, start: performance.now(), dur, from, to, done });
  }
}

function easeOutBack(k: number): number {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
}
