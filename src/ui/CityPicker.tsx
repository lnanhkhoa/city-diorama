import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import type { CityDef } from '../cities/types';
import { formatLocalTime, type Weather } from '../weather/api';
import { WEATHER_LABEL } from '../weather/codes';
import { weatherIcon } from './icons';
import { matchCities } from './match';
import { themeFor } from './theme';

const CLOCK_MS = 30_000;

interface Props {
  open: boolean;
  onClose: () => void;
  cities: readonly CityDef[];
  /** Slug of the city in the header. */
  current: string | null;
  /** Best known conditions for a city (live if cached, otherwise typical). */
  weatherOf: (city: CityDef) => Weather;
}

/**
 * "All cities" dialog: type to filter, arrow keys to move, Enter to go.
 * Each card shows the city's local time and current conditions.
 */
export function CityPicker({ open, onClose, cities, current, weatherOf }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(() => new Date());
  const hits = useMemo(() => matchCities(cities, query), [cities, query]);

  useEffect(() => {
    const d = dialog.current!;
    if (!open) {
      if (d.open) d.close();
      return;
    }
    if (d.open) return;
    setNow(new Date());
    d.showModal();
    const currentLink = list.current!.querySelector<HTMLAnchorElement>('a[aria-current="page"]');
    currentLink?.scrollIntoView({ block: 'nearest' });
    // A search box that summons the on-screen keyboard is unwelcome on touch.
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) input.current!.focus();
    else currentLink?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const clock = window.setInterval(() => setNow(new Date()), CLOCK_MS);
    return () => clearInterval(clock);
  }, [open]);

  const links = () => [...list.current!.querySelectorAll('a')];

  // Clicks on the backdrop land on the <dialog> itself, outside its box.
  const onDialogClick = (e: MouseEvent<HTMLDialogElement>) => {
    const d = dialog.current!;
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      links()[0]?.click();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      links()[0]?.focus();
    } else if (e.key === 'Escape' && query) {
      // First Escape clears the query; the next one closes the dialog.
      e.preventDefault();
      setQuery('');
    }
  };

  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    const all = links();
    const i = all.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    // Cards flow in a grid; a row is every card sharing the first card's top.
    const cols = Math.max(1, all.filter((a) => a.offsetTop === all[0].offsetTop).length);
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      const next = i + step;
      if (next < 0) input.current!.focus();
      else all[Math.min(next, all.length - 1)].focus();
    } else if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
      // Typing from a card goes straight to the search box.
      input.current!.focus();
    }
  };

  const typed = query.trim();
  return (
    <dialog
      ref={dialog}
      id="city-menu"
      className="city-menu"
      aria-label="Choose a city"
      onClick={onDialogClick}
      onClose={() => {
        setQuery('');
        onClose();
      }}
    >
      <form method="dialog" className="menu-head">
        <h2>Choose a city</h2>
        <button className="close" aria-label="Close">
          ×
        </button>
      </form>
      <label className="search">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4.5 4.5" />
        </svg>
        <input
          ref={input}
          type="search"
          placeholder="Search city or country"
          aria-label="Search cities"
          aria-controls="city-list"
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="go"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onInputKey}
        />
        <kbd aria-hidden="true">Enter</kbd>
      </label>
      <ul ref={list} id="city-list" aria-label="Cities" onKeyDown={onListKey}>
        {hits.map((c, i) => {
          const w = weatherOf(c);
          const theme = themeFor(c, w.daytime);
          const time = formatLocalTime(c.timezone, now);
          const temp = `${Math.round(w.tempC)}°`;
          const label = `${WEATHER_LABEL[w.kind]}${w.live ? '' : ' (typical)'}`;
          return (
            // Mark the result Enter would open while a query is typed.
            <li key={c.slug} className={typed && i === 0 ? 'hit' : undefined}>
              <a
                href={`#/${c.slug}`}
                aria-current={c.slug === current ? 'page' : undefined}
                aria-label={`${c.name}, ${c.country}. ${temp}C, ${label}, ${time} local time`}
                title={label}
                onClick={() => dialog.current!.close()}
              >
                <span
                  className="swatch"
                  style={{ background: `linear-gradient(${theme.bg[0]},${theme.bg[1]})`, color: theme.ink }}
                  dangerouslySetInnerHTML={{ __html: weatherIcon(w.kind, w.daytime) }}
                />
                <span className="label">
                  <strong>{c.name}</strong>
                  <small>{c.country}</small>
                </span>
                <span className={w.live ? 'now' : 'now typical'}>
                  <b>{temp}</b>
                  <small>{time}</small>
                </span>
              </a>
            </li>
          );
        })}
      </ul>
      <p className="empty" role="status" hidden={hits.length > 0}>
        {hits.length ? '' : `No city matches “${typed}”.`}
      </p>
    </dialog>
  );
}
