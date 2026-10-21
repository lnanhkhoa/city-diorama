import { Suspense, use, useCallback, useDeferredValue, useEffect, useEffectEvent, useLayoutEffect, useRef, useState, type Ref } from 'react';
import { useCityRegistry, type CityRegistry } from './cities/live';
import type { CityDef } from './cities/types';
import { Diorama, type DioramaHandle } from './scene/Diorama';
import type { ShowMode } from './scene/city-stage';
import { CityPicker } from './ui/CityPicker';
import { Fps } from './ui/Fps';
import { Loader } from './ui/Loader';
import { Toast, useToast } from './ui/Toast';
import { WeatherMenu, type WeatherGroup } from './ui/WeatherMenu';
import { weatherIcon } from './ui/icons';
import { POSTER_VIEW, composePoster } from './ui/poster';
import { downloadBlob, shareCity } from './ui/share';
import { applyTheme } from './ui/theme';
import { formatLocalDate, type Daytime, type Weather } from './weather/api';
import { WEATHER_LABEL, type WeatherKind } from './weather/codes';
import { applyPin, asDaytime, asWeatherKind, pinFromSearch, writePin, type WeatherPin } from './weather/pin';
import { WeatherStore, typicalWeather } from './weather/store';

const weatherStore = new WeatherStore();
const NEIGHBOUR_PREFETCH_MS = 1500;

/** A navigation: the city, how the stage swaps to it, and the registry it belongs to (a dev edit swaps the registry). */
interface Route {
  city: CityDef;
  mode: ShowMode;
  registry: CityRegistry;
}

export function App() {
  const registry = useCityRegistry();
  const [pin, setPin] = useState<WeatherPin>(() => pinFromSearch(new URLSearchParams(location.search)));
  /** City in the header and URL. */
  const [route, setRoute] = useState<Route>(() => ({ city: registry.cityFromHash(location.hash), mode: 'animate', registry }));
  /**
   * Route on stage. It lags `route` while the next city's scene module loads:
   * that render suspends in the background and React keeps the previous city
   * up. A newer navigation simply replaces the pending one.
   */
  const staged = useDeferredValue<Route | null>(route, null);
  const loading = staged !== route;
  /** Last city whose diorama made it on stage; a failed load falls back to it. */
  const [shown, setShown] = useState<CityDef | null>(null);
  const current = route.city;
  /** Bumped when live weather lands in the store, so derived weather re-reads it. */
  const [, setWeatherVersion] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const diorama = useRef<DioramaHandle>(null);

  /** Live conditions if fresh (unless the weather is pinned), otherwise the city's typical weather at its local hour. */
  const knownWeather = (city: CityDef): Weather => applyPin((pin.kind ? null : weatherStore.fresh(city)) ?? typicalWeather(city), pin);
  const weather = knownWeather(current);

  /** City `step` places from `city` in display order, wrapping around. */
  function neighbour(city: CityDef, step: number): CityDef {
    const { CITIES } = registry;
    const idx = CITIES.findIndex((c) => c.slug === city.slug);
    return CITIES[(idx + step + CITIES.length) % CITIES.length];
  }

  const go = (step: number) => {
    location.hash = `#/${neighbour(current, step).slug}`;
  };

  const onSettled = (settled: Route, ok: boolean) => {
    if (ok) {
      setShown(settled.city);
      // Fetch (not build) the previous and next cities once the intro has played, so arrow navigation is instant.
      window.setTimeout(() => {
        for (const step of [1, -1]) settled.registry.loadCity(neighbour(settled.city, step).slug).catch(() => {});
      }, NEIGHBOUR_PREFETCH_MS);
      return;
    }
    toast.show(`Couldn't load ${settled.city.name} — check your connection and reload`);
    // Put the header and URL back on the city that is still on stage, unless a newer navigation took over.
    if (settled !== route || !shown) return;
    history.replaceState(history.state, '', `#/${shown.slug}`);
    setRoute({ city: shown, mode: 'animate', registry: settled.registry });
  };

  const openPicker = () => {
    setPickerOpen(true);
    // One batched request fills the cache for every city whose weather is stale.
    if (!pin.kind) void weatherStore.prefetch(registry.CITIES).then((fetched) => fetched && setWeatherVersion((v) => v + 1));
  };

  const onWeatherChange = (group: WeatherGroup, value: string) => {
    const next = group === 'weather' ? { ...pin, kind: asWeatherKind(value) } : { ...pin, daytime: asDaytime(value) };
    setPin(next);
    const url = new URL(location.href);
    writePin(url.searchParams, next);
    history.replaceState(history.state, '', url);
  };

  const save = async () => {
    // While the next city loads, the stage still shows the previous one.
    if (loading || saving) return;
    setSaving(true);
    try {
      const css = getComputedStyle(document.documentElement);
      const read = (name: string) => css.getPropertyValue(name).trim();
      const blob = await composePoster(diorama.current!.snapshot(POSTER_VIEW.w, POSTER_VIEW.h), {
        country: current.country,
        city: current.name,
        date: formatLocalDate(current.timezone),
        temp: `${Math.round(weather.tempC)}°C`,
        iconSvg: weatherIcon(weather.kind, weather.daytime),
        ink: read('--ink'),
        bg: [read('--bg-top'), read('--bg-bottom')],
      });
      downloadBlob(blob, `${current.slug}-diorama.png`);
      toast.show('Poster saved');
    } catch (err) {
      console.error('Poster export failed', err);
      toast.show('Save failed — try again');
    } finally {
      setSaving(false);
    }
  };

  // Navigation: the hash is the source of truth; an edited registry (dev) rebuilds in place.
  const onHashChange = useEffectEvent(() => {
    const city = registry.cityFromHash(location.hash);
    setRoute((r) => (r.city === city ? r : { city, mode: 'animate', registry }));
  });
  useEffect(() => {
    addEventListener('hashchange', onHashChange);
    return () => removeEventListener('hashchange', onHashChange);
  }, []);
  useEffect(() => {
    setRoute((r) => (r.registry === registry ? r : { city: registry.cityFromHash(location.hash), mode: 'replace', registry }));
  }, [registry]);

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    if (pickerOpen || menuOpen || e.repeat || e.altKey || e.metaKey || e.ctrlKey) return;
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else if (e.key === '/') {
      e.preventDefault();
      openPicker();
    }
  });
  useEffect(() => {
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  // Live weather for the city in the header, unless the condition is pinned.
  useEffect(() => {
    weatherStore.cancel();
    if (pin.kind || weatherStore.fresh(current)) return;
    void weatherStore.load(current).then((w) => w && setWeatherVersion((v) => v + 1));
    return () => weatherStore.cancel();
  }, [current, pin.kind]);

  useLayoutEffect(() => applyTheme(current, weather.daytime), [current, weather.daytime]);

  useEffect(() => {
    document.title = `${current.name} — Cities Diorama`;
  }, [current]);

  const closePicker = useCallback(() => setPickerOpen(false), []);
  const idx = registry.CITIES.findIndex((c) => c.slug === current.slug);
  const count = registry.CITIES.length;

  return (
    <>
      <Suspense fallback={<div className="stage" />}>
        {staged ? (
          <StagedDiorama route={staged} onSettled={onSettled} kind={weather.kind} daytime={weather.daytime} handle={diorama} />
        ) : (
          <div className="stage" />
        )}
      </Suspense>
      <Loader city={loading ? current.name : null} />

      <header className="topbar">
        <div className="topbar-start">
          <a className="brand" href="#/" aria-label="Cities Diorama home">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M16 3 29 10.5v11L16 29 3 21.5v-11z" fill="currentColor" opacity=".9" />
              <path d="M16 3 29 10.5 16 18 3 10.5z" fill="var(--bg-top)" />
            </svg>
            <span>
              Cities
              <br />
              Diorama
            </span>
          </a>
          <Fps />
        </div>
        <div className="top-actions">
          <WeatherMenu
            value={{ weather: pin.kind ?? 'current', time: pin.daytime ?? 'local' }}
            onChange={onWeatherChange}
            open={menuOpen}
            onOpenChange={setMenuOpen}
          />
          <button className="menu-btn" type="button" aria-haspopup="dialog" aria-controls="city-menu" aria-keyshortcuts="/" title="Choose a city (/)" onClick={openPicker}>
            All cities
          </button>
        </div>
      </header>

      <section className="poster">
        <p className="country">{current.country}</p>
        <h1 className="city" aria-live="polite">
          {current.name}
        </h1>
        <div className="meta">
          <div className="icon" dangerouslySetInnerHTML={{ __html: weatherIcon(weather.kind, weather.daytime) }} />
          <p className="temp">{`${Math.round(weather.tempC)}°C`}</p>
          <div className="info">
            <p className="date">{formatLocalDate(current.timezone)}</p>
            <p className="condition" aria-live="polite">
              {weather.live && <span className="dot" />}
              {`${weather.live ? 'Live' : 'Typical'} · ${WEATHER_LABEL[weather.kind]}`}
            </p>
          </div>
        </div>
      </section>

      <footer className="bottombar">
        <div className="actions">
          <button type="button" onClick={() => void shareCity(current, toast.show)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M3 4l18 7-18 7 4-7z" />
            </svg>
            Share
          </button>
          <button type="button" disabled={saving} onClick={() => void save()}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 3h12v18l-6-4-6 4z" />
            </svg>
            Save
          </button>
        </div>
        <nav className="pager" aria-label="City navigation">
          <button className="round ghost" type="button" aria-label="Previous city" onClick={() => go(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
          </button>
          <span className="counter">{`${String(idx + 1).padStart(2, '0')} / ${String(count).padStart(2, '0')}`}</span>
          <button className="round" type="button" aria-label="Next city" onClick={() => go(1)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </nav>
      </footer>

      <CityPicker open={pickerOpen} onClose={closePicker} cities={registry.CITIES} current={current.slug} weatherOf={knownWeather} />
      <Toast msg={toast.msg} visible={toast.visible} />
    </>
  );
}

interface StagedProps {
  route: Route;
  /** After the route's build settles: `ok` is false when its scene module failed to load. */
  onSettled: (route: Route, ok: boolean) => void;
  kind: WeatherKind;
  daytime: Daytime;
  handle: Ref<DioramaHandle>;
}

/** Suspends until the route's scene module has loaded, then puts it on stage. */
function StagedDiorama({ route, onSettled, ...view }: StagedProps) {
  const build = use(route.registry.cityBuild(route.city.slug));
  const report = useEffectEvent(() => onSettled(route, build !== null));
  useEffect(() => report(), [route, build]);
  return <Diorama build={build} mode={route.mode} {...view} />;
}
