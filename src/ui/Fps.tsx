import { useEffect, useState } from 'react';

/** Refresh interval of the readout; short enough to track load, long enough to read. */
const UPDATE_MS = 500;

/**
 * The browser's frame rate. The diorama renders once per animation frame,
 * so this is also the scene's render rate.
 */
export function Fps() {
  const [fps, setFps] = useState<number | null>(null);
  useEffect(() => {
    let frames = 0;
    let since = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      frames++;
      const elapsed = now - since;
      if (elapsed >= UPDATE_MS) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        since = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <span className="fps" aria-hidden="true">
      {fps === null ? '' : `${fps} FPS`}
    </span>
  );
}
