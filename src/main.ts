import * as cityRegistry from './cities';
import type { CityDef } from './cities/types';
import { Stage } from './scene/stage';
import { DAYTIME_LABEL, fetchWeather, fetchWeatherMany, formatLocalDate, localDaytime, type Daytime, type Weather } from './weather/api';
import { WEATHER_LABEL, type WeatherKind } from './weather/codes';
import { mountFps } from './ui/fps';
import { weatherIcon } from './ui/icons';
import { CityPicker } from './ui/picker';
import { LoadingIndicator } from './ui/loader';
import { WeatherMenu } from './ui/weather-menu';
import { POSTER_VIEW, composePoster } from './ui/poster';
import { themeFor } from './ui/theme';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const stage = new Stage($('stage'));
const loader = new LoadingIndicator($('loader'), $('loader-label'));
mountFps($('fps'));
const els = {
  country: $('country'),
  city: $('city'),
  icon: $('icon'),
  date: $('date'),
  temp: $('temp'),
  condition: $('condition'),
  counter: $('counter'),
  toast: $('toast'),
};

/** City in the header and URL; while its scene module loads, `shown` is still the previous one. */
let current: CityDef | null = null;
/** City whose diorama is on stage. */
let shown: CityDef | null = null;
/** Bumped on every navigation so a slow load cannot overwrite a newer choice. */
let navigation = 0;
let weather: Weather | null = null;
let weatherAbort: AbortController | null = null;
const weatherCache: Record<string, { at: number; w: Weather }> = {};
const WEATHER_TTL_MS = 10 * 60 * 1000;
const params = new URLSearchParams(location.search);
const weatherParam = params.get('weather') ?? '';
const timeParam = params.get('time');
/**
 * Overrides from the weather menu, seeded from the URL. `?weather=<kind>`
 * (clear, partly, cloudy, fog, drizzle, rain, snow, storm) pins every city to
 * that condition at its typical temperature; live weather is then not fetched,
 * so nothing is labelled "Live". `?time=<phase>` (dawn, day, dusk, night, dark)
 * pins the lighting instead of following each city's clock.
 */
const pin: { kind: WeatherKind | null; daytime: Daytime | null } = {
  kind: Object.hasOwn(WEATHER_LABEL, weatherParam) ? (weatherParam as WeatherKind) : null,
  daytime: timeParam && Object.hasOwn(DAYTIME_LABEL, timeParam) ? (timeParam as Daytime) : null,
};

function pinned(reported: Weather): Weather {
  return { ...reported, ...(pin.kind ? { kind: pin.kind } : {}), ...(pin.daytime ? { daytime: pin.daytime } : {}) };
}

/** Cached live conditions younger than the TTL, else null. */
function freshWeather(city: CityDef): Weather | null {
  const cached = weatherCache[city.slug];
  return cached && Date.now() - cached.at < WEATHER_TTL_MS ? cached.w : null;
}

/** Live conditions if fresh (unless the weather is pinned), otherwise the city's typical weather at its local hour. */
function knownWeather(city: CityDef): Weather {
  const reported = (pin.kind ? null : freshWeather(city)) ?? { ...city.fallback, daytime: localDaytime(city.timezone), live: false };
  return pinned(reported);
}

function applyTheme(city: CityDef, daytime: Daytime): void {
  const root = document.documentElement.style;
  const theme = themeFor(city, daytime);
  root.setProperty('--bg-top', theme.bg[0]);
  root.setProperty('--bg-bottom', theme.bg[1]);
  root.setProperty('--ink', theme.ink);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.bg[0]);
}

function renderWeather(city: CityDef, reported: Weather): void {
  const w = pinned(reported);
  weather = w;
  els.icon.innerHTML = weatherIcon(w.kind, w.daytime);
  els.temp.textContent = `${Math.round(w.tempC)}°C`;
  els.condition.innerHTML = w.live ? `<span class="dot"></span>Live · ${WEATHER_LABEL[w.kind]}` : `Typical · ${WEATHER_LABEL[w.kind]}`;
  applyTheme(city, w.daytime);
  stage.setWeather(w.kind, w.daytime);
}

async function loadWeather(city: CityDef): Promise<void> {
  weatherAbort?.abort();
  const known = knownWeather(city);
  renderWeather(city, known);
  if (known.live || pin.kind) return;
  const ctrl = new AbortController();
  weatherAbort = ctrl;
  try {
    const w = await fetchWeather(city.lat, city.lon, ctrl.signal);
    weatherCache[city.slug] = { at: Date.now(), w };
    if (current === city) renderWeather(city, w);
    picker.refreshLive();
  } catch (err) {
    if ((err as Error).name !== 'AbortError') console.warn(`Live weather unavailable for ${city.name}; showing typical conditions.`, err);
  }
}

let prefetching = false;
/** One batched request fills the cache for every city whose weather is stale. */
async function prefetchWeather(): Promise<void> {
  const stale = registry.CITIES.filter((c) => !freshWeather(c));
  if (pin.kind || prefetching || stale.length === 0) return;
  prefetching = true;
  try {
    const results = await fetchWeatherMany(stale);
    const at = Date.now();
    results.forEach((w, i) => {
      if (w) weatherCache[stale[i].slug] = { at, w };
    });
    picker.refreshLive();
    const fresh = current && !weather?.live ? freshWeather(current) : null;
    if (fresh) renderWeather(current!, fresh);
  } catch (err) {
    console.warn('Live weather unavailable for the city list; showing typical conditions.', err);
  } finally {
    prefetching = false;
  }
}

/** Replaced in place when a city module is edited during development. */
let registry = cityRegistry;

function renderHeader(city: CityDef): void {
  const { CITIES } = registry;
  const idx = CITIES.indexOf(city);
  els.country.textContent = city.country;
  els.city.textContent = city.name;
  els.date.textContent = formatLocalDate(city.timezone);
  els.counter.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(CITIES.length).padStart(2, '0')}`;
  document.title = `${city.name} — Cities Diorama`;
  picker.setCurrent(city.slug);
}

async function show(city: CityDef, mode: 'animate' | 'replace' = 'animate'): Promise<void> {
  if (current === city) return;
  current = city;
  const nav = ++navigation;
  renderHeader(city);
  void loadWeather(city);
  let build = registry.loadedCity(city.slug);
  if (!build) {
    loader.start(city.name);
    try {
      build = await registry.loadCity(city.slug);
    } catch (err) {
      if (nav !== navigation) return;
      loader.done();
      console.error(`Could not load ${city.name}`, err);
      toast(`Couldn't load ${city.name} — check your connection and reload`);
      // Put the header and URL back on the city that is still on stage.
      current = shown;
      if (shown) {
        history.replaceState(history.state, '', `#/${shown.slug}`);
        renderHeader(shown);
        void loadWeather(shown);
      }
      return;
    }
    // A newer navigation took over; it owns the stage and the indicator.
    if (nav !== navigation) return;
  }
  stage.show(build(), mode);
  shown = city;
  loader.done();
  prefetchNeighbours(city);
}

/** Fetch (not build) the previous and next cities once the intro has played, so arrow navigation is instant. */
function prefetchNeighbours(city: CityDef): void {
  const { CITIES } = registry;
  const idx = CITIES.indexOf(city);
  window.setTimeout(() => {
    for (const step of [1, -1]) {
      const next = CITIES[(idx + step + CITIES.length) % CITIES.length];
      registry.loadCity(next.slug).catch(() => {});
    }
  }, 1500);
}

function go(step: number): void {
  const { CITIES } = registry;
  const idx = current ? CITIES.findIndex((c) => c.slug === current!.slug) : 0;
  location.hash = `#/${CITIES[(idx + step + CITIES.length) % CITIES.length].slug}`;
}

let toastTimer = 0;
function toast(msg: string): void {
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove('show'), 2200);
}

// City picker --------------------------------------------------------------
const picker = new CityPicker({
  dialog: $<HTMLDialogElement>('city-menu'),
  input: $<HTMLInputElement>('city-search'),
  list: $<HTMLUListElement>('city-list'),
  empty: $('city-empty'),
  weather: knownWeather,
  onOpen: () => void prefetchWeather(),
});
picker.setCities(registry.CITIES);
$('menu-btn').addEventListener('click', () => picker.open());

// Weather menu -------------------------------------------------------------
/** Condition: `current` follows live/typical weather, a kind pins it. Time: `local` follows each city's clock, a phase pins it. */
const weatherMenu = new WeatherMenu({
  button: $<HTMLButtonElement>('weather-btn'),
  list: $('weather-list'),
  onChange: (group, v) => {
    const url = new URL(location.href);
    if (group === 'weather') {
      pin.kind = Object.hasOwn(WEATHER_LABEL, v) ? (v as WeatherKind) : null;
      if (pin.kind) url.searchParams.set('weather', pin.kind);
      else url.searchParams.delete('weather');
    } else {
      pin.daytime = Object.hasOwn(DAYTIME_LABEL, v) ? (v as Daytime) : null;
      if (pin.daytime) url.searchParams.set('time', pin.daytime);
      else url.searchParams.delete('time');
    }
    history.replaceState(history.state, '', url);
    picker.refreshLive();
    if (current) void loadWeather(current);
  },
});
weatherMenu.set('weather', pin.kind ?? 'current');
weatherMenu.set('time', pin.daytime ?? 'local');

// Navigation ---------------------------------------------------------------
$('prev-btn').addEventListener('click', () => go(-1));
$('next-btn').addEventListener('click', () => go(1));
addEventListener('keydown', (e) => {
  if (picker.isOpen || weatherMenu.isOpen || e.repeat || e.altKey || e.metaKey || e.ctrlKey) return;
  if (e.key === 'ArrowRight') go(1);
  else if (e.key === 'ArrowLeft') go(-1);
  else if (e.key === '/') {
    e.preventDefault();
    picker.open();
  }
});
addEventListener('hashchange', () => void show(registry.cityFromHash(location.hash)));

// Share & save -------------------------------------------------------------
$('share-btn').addEventListener('click', async () => {
  if (!current) return;
  const data = { title: `${current.name} — Cities Diorama`, text: `A miniature ${current.name} in 3D`, url: location.href };
  if (navigator.share) {
    try {
      await navigator.share(data);
      return;
    } catch (err) {
      // Dismissing the sheet is not an error; anything else falls back to copying.
      if ((err as Error).name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Link copied');
  } catch {
    toast('Copy failed — use the address bar');
  }
});

const saveBtn = $<HTMLButtonElement>('save-btn');
saveBtn.addEventListener('click', async () => {
  // While the next city loads, the stage still shows the previous one.
  if (!current || current !== shown || !weather || saveBtn.disabled) return;
  const city = current;
  saveBtn.disabled = true;
  try {
    const css = getComputedStyle(document.documentElement);
    const read = (name: string) => css.getPropertyValue(name).trim();
    const blob = await composePoster(stage.snapshot(POSTER_VIEW.w, POSTER_VIEW.h), {
      country: city.country,
      city: city.name,
      date: els.date.textContent ?? '',
      temp: els.temp.textContent ?? '',
      iconSvg: weatherIcon(weather.kind, weather.daytime),
      ink: read('--ink'),
      bg: [read('--bg-top'), read('--bg-bottom')],
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${city.slug}-diorama.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Poster saved');
  } catch (err) {
    console.error('Poster export failed', err);
    toast('Save failed — try again');
  } finally {
    saveBtn.disabled = false;
  }
});

void show(registry.cityFromHash(location.hash));

// Dev: an edited city module rebuilds the scene in place (camera kept)
// instead of reloading the page.
if (import.meta.hot) {
  import.meta.hot.accept('./cities', (mod) => {
    if (!mod) return;
    // Vite types accepted modules as a loose namespace; this is our own registry module.
    registry = mod as unknown as typeof cityRegistry;
    picker.setCities(registry.CITIES);
    current = null;
    void show(registry.cityFromHash(location.hash), 'replace');
  });
}
