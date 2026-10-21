import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Loads shorter than this finish before the indicator appears, so cached cities never flash it. */
const SHOW_DELAY_MS = 150;
/** Time for the completed bar to fill and fade before the indicator resets. */
const FINISH_MS = 450;

type Phase = 'hidden' | 'show' | 'done';

/**
 * Centered "Loading <city>" pill with a progress bar, shown while `city` is
 * set. Chunk downloads report no byte progress, so the bar eases towards 90%
 * in CSS (it keeps moving on the compositor while the scene builds on the
 * main thread) and fills when `city` clears.
 */
export function Loader({ city }: { city: string | null }) {
  const [phase, setPhase] = useState<Phase>('hidden');
  const [label, setLabel] = useState('');
  const el = useRef<HTMLDivElement>(null);
  const phaseNow = useRef(phase);
  const restart = useRef(false);
  const delay = useRef(0);
  const finish = useRef(0);

  useLayoutEffect(() => {
    phaseNow.current = phase;
    if (!restart.current) return;
    // Commit the empty bar so the trickle transition starts from zero.
    restart.current = false;
    void el.current!.offsetWidth;
    setPhase('show');
  }, [phase]);

  useEffect(() => {
    clearTimeout(delay.current);
    if (city) {
      const text = `Loading ${city}`;
      // Already visible for an earlier city: keep the bar running, retarget the label.
      if (phaseNow.current === 'show') {
        setLabel(text);
        return;
      }
      delay.current = window.setTimeout(() => {
        clearTimeout(finish.current);
        setLabel(text);
        if (phaseNow.current === 'hidden') setPhase('show');
        else {
          restart.current = true;
          setPhase('hidden');
        }
      }, SHOW_DELAY_MS);
    } else if (phaseNow.current === 'show') {
      setPhase('done');
      finish.current = window.setTimeout(() => {
        setPhase('hidden');
        setLabel('');
      }, FINISH_MS);
    }
  }, [city]);

  useEffect(
    () => () => {
      clearTimeout(delay.current);
      clearTimeout(finish.current);
    },
    [],
  );

  return (
    <div ref={el} id="loader" className={phase === 'hidden' ? 'loader' : phase === 'show' ? 'loader show' : 'loader show done'}>
      <span className="loader-label" role="status">
        {label}
      </span>
      <span className="loader-bar">
        <i />
      </span>
    </div>
  );
}
