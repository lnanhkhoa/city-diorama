/** Mean frame interval above this (below ~52 fps) steps the resolution down. */
const SLOW_MS = 1000 / 52;
/** Mean frame interval below this (a steady 60 Hz or better) counts as headroom. */
const FAST_MS = 1000 / 58;
/** An interval this long is a pause (hidden tab, debugger), not a frame; it restarts the window. */
const PAUSE_MS = 1000;
/**
 * Slowest share of each window left out of its mean, so isolated hitches
 * (city build, shader compile) do not count as load while sustained slowness,
 * even at a few fps, still does.
 */
const TRIM = 0.1;
/** Each decision averages this much rendering time. */
const WINDOW_MS = 1000;
/** Consecutive fast windows needed before trying the next level up. */
const RAISE_AFTER = 3;
/** A level that proved too slow is not retried for this long; each further failure doubles it. */
const RETRY_AFTER_MS = 20_000;
const RETRY_MAX_MS = 5 * 60_000;

/**
 * Picks the canvas pixel ratio from measured frame intervals. The view is GPU
 * fill-bound, so frame time follows pixel count: sustained slow frames drop
 * one level at once; sustained headroom probes one level up. Levels step the
 * ratio from `maxRatio` down to `minRatio`; antialiasing stays on at every
 * level. A level that failed is retried after a delay that doubles with each
 * failure, so a GPU sitting between two levels rarely pays for a failed probe.
 */
export class ResolutionGovernor {
  /** Pixel ratios from sharpest to cheapest. */
  readonly levels: number[];
  private index = 0;
  private intervals: number[] = [];
  private elapsed = 0;
  private heldUntil = 0;
  private fastWindows = 0;
  /** Per level: time before which it is not retried, and how often it has failed. */
  private blockedUntil: number[];
  private failures: number[];

  constructor(maxRatio: number, minRatio = 1) {
    this.levels = [maxRatio, ...[1.5, 1.25, 1].filter((r) => r < maxRatio && r >= minRatio)];
    this.blockedUntil = this.levels.map(() => 0);
    this.failures = this.levels.map(() => 0);
  }

  /** Current pixel ratio. */
  get level(): number {
    return this.levels[this.index];
  }

  /**
   * Ignore frames until `untilMs` (same clock as `sample`'s `now`): the caller
   * knows it is about to cause slow frames (city swap, poster render) that say
   * nothing about steady-state load.
   */
  holdUntil(untilMs: number): void {
    this.heldUntil = Math.max(this.heldUntil, untilMs);
    this.intervals = [];
    this.elapsed = 0;
  }

  /** Feed one frame interval; returns the new pixel ratio when it should change. */
  sample(intervalMs: number, now: number): number | null {
    if (now < this.heldUntil || intervalMs > PAUSE_MS) {
      this.intervals = [];
      this.elapsed = 0;
      return null;
    }
    this.intervals.push(intervalMs);
    this.elapsed += intervalMs;
    if (this.elapsed < WINDOW_MS) return null;
    const kept = this.intervals.sort((a, b) => a - b).slice(0, this.intervals.length - Math.floor(this.intervals.length * TRIM));
    const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
    this.intervals = [];
    this.elapsed = 0;

    if (mean > SLOW_MS) {
      this.fastWindows = 0;
      if (this.index === this.levels.length - 1) return null;
      const fails = ++this.failures[this.index];
      this.blockedUntil[this.index] = now + Math.min(RETRY_AFTER_MS * 2 ** (fails - 1), RETRY_MAX_MS);
      this.index++;
      return this.level;
    }
    if (mean < FAST_MS && this.index > 0) {
      this.fastWindows++;
      if (this.fastWindows < RAISE_AFTER || now < this.blockedUntil[this.index - 1]) return null;
      this.fastWindows = 0;
      this.index--;
      return this.level;
    }
    this.fastWindows = 0;
    return null;
  }
}
