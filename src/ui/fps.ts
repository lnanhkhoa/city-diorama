/** Refresh interval of the readout; short enough to track load, long enough to read. */
const UPDATE_MS = 500;

/**
 * Shows the browser's frame rate in `el`. The stage renders once per
 * animation frame, so this is also the scene's render rate.
 */
export function mountFps(el: HTMLElement): void {
  let frames = 0;
  let since = performance.now();
  const tick = (now: number) => {
    frames++;
    const elapsed = now - since;
    if (elapsed >= UPDATE_MS) {
      el.textContent = `${Math.round((frames * 1000) / elapsed)} FPS`;
      frames = 0;
      since = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
