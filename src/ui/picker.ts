import type { CityDef } from '../cities/types';
import { formatLocalTime, type Weather } from '../weather/api';
import { WEATHER_LABEL } from '../weather/codes';
import { weatherIcon } from './icons';
import { themeFor } from './theme';

/** Lowercase, accent-free form so "sao", "São" and "SAO" compare equal. */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Cities matching a free-text query, best first. Ranks: name prefix, word
 * prefix in the name, initials ("kl", "sf"), country prefix, then substring
 * anywhere. Ties keep the registry order; an empty query returns every city.
 */
export function matchCities(cities: readonly CityDef[], query: string): CityDef[] {
  const q = fold(query).trim().replace(/\s+/g, ' ');
  if (!q) return [...cities];
  const scored: { city: CityDef; rank: number; i: number }[] = [];
  cities.forEach((city, i) => {
    const name = fold(city.name);
    const country = fold(city.country);
    const words = name.split(/[\s-]+/);
    const initials = words.map((w) => w[0]).join('');
    const rank = name.startsWith(q)
      ? 0
      : words.some((w) => w.startsWith(q))
        ? 1
        : q.length > 1 && initials.startsWith(q.replace(/ /g, ''))
          ? 2
          : country.startsWith(q) || country.split(/[\s-]+/).some((w) => w.startsWith(q))
            ? 3
            : name.includes(q) || country.includes(q)
              ? 4
              : -1;
    if (rank >= 0) scored.push({ city, rank, i });
  });
  return scored.sort((a, b) => a.rank - b.rank || a.i - b.i).map((s) => s.city);
}

export interface PickerOptions {
  dialog: HTMLDialogElement;
  input: HTMLInputElement;
  list: HTMLUListElement;
  empty: HTMLElement;
  /** Best known conditions for a city (live if cached, otherwise typical). */
  weather: (city: CityDef) => Weather;
  /** Called each time the picker opens, e.g. to refresh weather for every card. */
  onOpen?: () => void;
}

/**
 * "All cities" dialog: type to filter, arrow keys to move, Enter to go.
 * Each card shows the city's local time and current conditions.
 */
export class CityPicker {
  private cities: CityDef[] = [];
  private items = new Map<string, HTMLLIElement>();
  private current = '';
  private clock = 0;

  constructor(private readonly o: PickerOptions) {
    o.input.addEventListener('input', () => this.filter());
    o.input.addEventListener('keydown', (e) => this.onInputKey(e));
    o.list.addEventListener('keydown', (e) => this.onListKey(e));
    o.list.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('a')) this.close();
    });
    // Clicks on the backdrop land on the <dialog> itself, outside its box.
    o.dialog.addEventListener('click', (e) => {
      if (e.target !== o.dialog) return;
      const r = o.dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) this.close();
    });
    o.dialog.addEventListener('close', () => {
      clearInterval(this.clock);
      o.input.value = '';
      this.filter();
    });
  }

  get isOpen(): boolean {
    return this.o.dialog.open;
  }

  setCities(cities: CityDef[]): void {
    this.cities = cities;
    this.items.clear();
    this.o.list.replaceChildren();
    for (const c of cities) {
      const li = document.createElement('li');
      li.innerHTML = `<a href="#/${c.slug}" data-slug="${c.slug}"><span class="swatch"></span><span class="label"><strong>${c.name}</strong><small>${c.country}</small></span><span class="now"><b></b><small></small></span></a>`;
      this.items.set(c.slug, li);
    }
    this.markCurrent();
    this.filter();
    this.refreshLive();
  }

  setCurrent(slug: string): void {
    this.current = slug;
    this.markCurrent();
  }

  open(): void {
    if (this.isOpen) return;
    this.refreshLive();
    this.o.dialog.showModal();
    const currentLink = this.link(this.current);
    currentLink?.scrollIntoView({ block: 'nearest' });
    // A search box that summons the on-screen keyboard is unwelcome on touch.
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) this.o.input.focus();
    else currentLink?.focus();
    this.clock = window.setInterval(() => this.refreshLive(), 30_000);
    this.o.onOpen?.();
  }

  close(): void {
    this.o.dialog.close();
  }

  /** Re-read time and weather into every card without disturbing focus. */
  refreshLive(): void {
    const now = new Date();
    for (const c of this.cities) {
      const a = this.link(c.slug)!;
      const w = this.o.weather(c);
      const theme = themeFor(c, w.daytime);
      const swatch = a.querySelector<HTMLElement>('.swatch')!;
      swatch.style.background = `linear-gradient(${theme.bg[0]},${theme.bg[1]})`;
      swatch.style.color = theme.ink;
      swatch.innerHTML = weatherIcon(w.kind, w.daytime);
      const time = formatLocalTime(c.timezone, now);
      const temp = `${Math.round(w.tempC)}°`;
      const reading = a.querySelector('.now')!;
      reading.classList.toggle('typical', !w.live);
      reading.querySelector('b')!.textContent = temp;
      reading.querySelector('small')!.textContent = time;
      const label = `${WEATHER_LABEL[w.kind]}${w.live ? '' : ' (typical)'}`;
      a.setAttribute('aria-label', `${c.name}, ${c.country}. ${temp}C, ${label}, ${time} local time`);
      a.title = label;
    }
  }

  private link(slug: string): HTMLAnchorElement | null {
    return this.items.get(slug)?.querySelector('a') ?? null;
  }

  private markCurrent(): void {
    for (const [slug, li] of this.items) {
      const a = li.querySelector('a')!;
      if (slug === this.current) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
  }

  private filter(): void {
    const q = this.o.input.value;
    const hits = matchCities(this.cities, q);
    this.o.list.replaceChildren(...hits.map((c) => this.items.get(c.slug)!));
    for (const li of this.items.values()) li.classList.remove('hit');
    // Mark the result Enter would open while a query is typed.
    if (q.trim() && hits[0]) this.items.get(hits[0].slug)!.classList.add('hit');
    this.o.empty.hidden = hits.length > 0;
    if (!hits.length) this.o.empty.textContent = `No city matches “${q.trim()}”.`;
  }

  private links(): HTMLAnchorElement[] {
    return [...this.o.list.querySelectorAll('a')];
  }

  private onInputKey(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      this.links()[0]?.click();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.links()[0]?.focus();
    } else if (e.key === 'Escape' && this.o.input.value) {
      // First Escape clears the query; the next one closes the dialog.
      e.preventDefault();
      this.o.input.value = '';
      this.filter();
    }
  }

  private onListKey(e: KeyboardEvent): void {
    const links = this.links();
    const i = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (i < 0) return;
    // Cards flow in a grid; a row is every card sharing the first card's top.
    const cols = Math.max(1, links.filter((a) => a.offsetTop === links[0].offsetTop).length);
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key];
    if (step !== undefined) {
      e.preventDefault();
      const next = i + step;
      if (next < 0) this.o.input.focus();
      else links[Math.min(next, links.length - 1)].focus();
    } else if (e.key.length === 1 && !e.altKey && !e.ctrlKey && !e.metaKey) {
      // Typing from a card goes straight to the search box.
      this.o.input.focus();
    }
  }
}
