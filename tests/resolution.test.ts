import { describe, expect, it } from 'vitest';
import { ResolutionGovernor } from '../src/scene/resolution';

/** Feed `seconds` of frames at a fixed interval starting at `t0`; returns ratio changes and end time. */
function run(g: ResolutionGovernor, frameMs: number, seconds: number, t0 = 0): { changes: number[]; t: number } {
  const changes: number[] = [];
  let t = t0;
  for (let elapsed = 0; elapsed < seconds * 1000; elapsed += frameMs) {
    t += frameMs;
    const ratio = g.sample(frameMs, t);
    if (ratio !== null) changes.push(ratio);
  }
  return { changes, t };
}

describe('ResolutionGovernor', () => {
  it('steps the ratio down from the cap to the floor', () => {
    expect(new ResolutionGovernor(1.75).levels).toEqual([1.75, 1.5, 1.25, 1]);
    expect(new ResolutionGovernor(1.25).levels).toEqual([1.25, 1]);
    expect(new ResolutionGovernor(1, 1).levels).toEqual([1]);
    expect(new ResolutionGovernor(0.8, 0.8).levels).toEqual([0.8]);
  });

  it('steps down one level per slow second until the cheapest, then holds', () => {
    const g = new ResolutionGovernor(1.75);
    expect(run(g, 33.3, 8).changes).toEqual([1.5, 1.25, 1]);
    expect(g.level).toBe(1);
  });

  it('keeps full quality while frames make the 60 Hz budget', () => {
    const g = new ResolutionGovernor(1.75);
    expect(run(g, 16.7, 10).changes).toEqual([]);
  });

  it('ignores isolated hitches such as a city build, and pauses such as a hidden tab', () => {
    const g = new ResolutionGovernor(1.75);
    let t = 0;
    for (let i = 1; i <= 600; i++) {
      // A 60 Hz stream with a 400 ms hitch every 2 s and a 5 s pause every 4 s.
      const ms = i % 240 === 0 ? 5000 : i % 120 === 0 ? 400 : 16.7;
      expect(g.sample(ms, (t += ms))).toBeNull();
    }
    expect(g.level).toBe(1.75);
  });

  it('still steps down when every frame is very slow', () => {
    // Weak GPUs can run at a few fps; long frames there are load, not hitches.
    const g = new ResolutionGovernor(1.75);
    expect(run(g, 150, 5).changes).toEqual([1.5, 1.25, 1]);
  });

  it('ignores frames inside a hold, then resumes judging', () => {
    const g = new ResolutionGovernor(1.75);
    g.holdUntil(3000);
    let { t, changes } = run(g, 50, 2.9);
    expect(changes).toEqual([]);
    ({ changes } = run(g, 50, 1.2, t));
    expect(changes).toEqual([1.5]);
  });

  it('probes back up after sustained headroom', () => {
    const g = new ResolutionGovernor(1.75);
    const slow = run(g, 33.3, 4.5);
    expect(slow.changes).toEqual([1.5, 1.25, 1]);
    // Load drops (e.g. a lighter weather state): wait out the retry blocks, then climb back.
    const fast = run(g, 8.3, 35, slow.t);
    expect(fast.changes).toEqual([1.25, 1.5, 1.75]);
  });

  it('does not retry a level that just proved too slow', () => {
    const g = new ResolutionGovernor(1.75);
    let { t } = run(g, 33.3, 1.1); // 1.75 too slow → 1.5
    expect(g.level).toBe(1.5);
    // Plenty of headroom at 1.5, but 1.75 stays blocked for 20 s.
    ({ t } = run(g, 16.7, 15, t));
    expect(g.level).toBe(1.5);
    run(g, 16.7, 8, t);
    expect(g.level).toBe(1.75);
  });

  it('doubles the wait after each failed probe of the same level', () => {
    const g = new ResolutionGovernor(1.75);
    let { t } = run(g, 33.3, 1.1); // fail 1 at 1.75 → blocked 20 s
    ({ t } = run(g, 16.7, 22, t)); // probe back up to 1.75
    expect(g.level).toBe(1.75);
    ({ t } = run(g, 33.3, 1.1, t)); // fail 2 → blocked 40 s
    expect(g.level).toBe(1.5);
    ({ t } = run(g, 16.7, 35, t));
    expect(g.level).toBe(1.5);
    run(g, 16.7, 8, t);
    expect(g.level).toBe(1.75);
  });
});
