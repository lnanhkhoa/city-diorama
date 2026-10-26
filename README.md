# Cities Diorama

Miniature 3D city dioramas in the browser. Each city is a hand-built,
procedural Three.js scene on a 20 × 20 display plinth (landmarks, streets,
water, traffic, people), framed like a collectible poster with the city's live
weather, local date and temperature. The app is React (Vite) with the 3D view
in [react-three-fiber](https://r3f.docs.pmnd.rs/).

Cities: Hanoi, Ho Chi Minh City, Paris, New York, Sydney, Rome, Kuala Lumpur,
Tokyo, London, Dubai, Cairo, Rio de Janeiro, San Francisco.

## Run

```sh
bun install
bun run dev        # http://localhost:5173
bun run test       # Vitest: weather mapping, kit merging/animation, per-city invariants
bun run typecheck
bun run build      # static site in dist/
bun run rodin      # Rodin asset batch: status | brief | bake (docs/rodin-pipeline.md)
```

## Using it

- Drag to orbit, scroll or pinch to zoom; the view auto-rotates when idle.
- ← / → (keys or buttons) switch cities; `#/<slug>` deep-links a city
  (unknown slugs fall back to Hanoi).
- The **weather menu** in the top bar has two independent columns.
  *Condition*: *Current* follows each city's live (or typical) weather; a
  condition (Clear, Partly cloudy, Overcast, Fog, Drizzle, Rain, Snow, Storm)
  pins it for every city at its typical temperature and skips live weather.
  *Time of day*: *Local time* follows each city's clock (dawn before 08:00,
  dusk from 17:00 while the sun is up, dark 23:00–04:00); Dawn, Day, Dusk,
  Night or Dark pins the lighting, palette and city lights for every city.
  The choice is kept in the URL, so shared links carry it. The same pins work as URL params:
  `?weather=<kind>` (`clear`, `partly`, `cloudy`, `fog`, `drizzle`, `rain`,
  `snow`, `storm`) and `?time=dawn|day|dusk|night|dark`, which combine, e.g.
  `http://localhost:5173/?time=dusk&weather=rain#/sydney`.
- **All cities** (or `/`) opens the picker. Each card shows the city's local
  time and current weather (fetched for all cities in one request; grey
  temperatures are typical values). Type to filter by city, country or
  initials (`kl`, `sf`; accents optional), ↑ ↓ ← → to move, Enter to open the
  top match, Esc to clear then close.
- **Save** downloads a 1080 × 1350 PNG poster of the current view.
  **Share** uses the system share sheet, or copies the link.
- Weather comes from [Open-Meteo](https://open-meteo.com/) (no key). Rain,
  drizzle, storms and snow add particles; overcast light is soft; at the city's
  night-time, windows and street lamps light up. Offline, each city shows a
  typical condition marked "Typical".
- `prefers-reduced-motion` disables the intro, auto-rotation, traffic and
  particles.

## How it is built

| Path | Role |
|---|---|
| `src/App.tsx` | App shell: hash routing, weather state and pins, header, picker, save/share. The stage renders a deferred copy of the route and suspends on the city's module, so the previous city stays up (with the loading indicator) until the next one is ready |
| `src/scene/Diorama.tsx` | `<Canvas>`: camera fit, orbit controls, adaptive pixel ratio, composer render loop with the per-frame TAA jitter (history reset while a city swaps), poster snapshots (`DioramaHandle`) |
| `src/scene/Atmosphere.tsx` | Environment map, key/rim/hemisphere lights per weather and time of day, shadow catcher, weather particles |
| `src/scene/city-stage.ts` | Displayed city and the shrink/grow swap; builds the incoming city after the outgoing one has left |
| `src/scene/passes.ts` | Half-resolution GTAO ambient occlusion, MSAA on the scene pass only, straight-alpha output, temporal antialiasing (jittered projection, depth reprojection, neighbourhood-clamped history) that steadies sub-pixel details while the camera turns |
| `src/scene/resolution.ts` | Adaptive quality: drops the pixel ratio (1.75 → 1.5 → 1.25 → 1) when frames fall below ~52 fps, with MSAA kept at every level; probes back up with headroom; failed levels are retried after a doubling delay. Isolated hitches, pauses, city swaps and poster renders do not count |
| `src/scene/weatherFx.ts` | Rain, snow and lightning |
| `src/kit/` | Shared construction kit: primitives, buildings and towers with real construction detail, props, display plinth, cached materials, static-geometry merger, path animator, baked-shape loader |
| `src/cities/shapes/` | Sculptural forms baked from Hyper3D Rodin models by `bun run rodin bake`; batch manifest in `scripts/rodin/assets.ts` ([docs/rodin-pipeline.md](docs/rodin-pipeline.md)) |
| `src/cities/index.ts` | City metadata in display order, plus `loadCity`: each scene is a lazily fetched chunk (neighbours prefetched). `cityBuild` wraps it for `use()`: one stable promise per city that resolves null on failure |
| `src/cities/list/<slug>.ts` | One scene module per city, default-exporting its `build()` |
| `src/cities/live.ts` | `useCityRegistry`: the registry, swapped in place when a city module is edited in dev |
| `src/weather/` | Open-Meteo client, WMO code mapping, city-local date/day-night, live-weather cache, menu/URL pins |
| `src/ui/` | React components (city picker, weather menu, loader, toast, FPS), search ranking, weather icons, night palette, poster composer |

Geometry is built in code: no models are downloaded. Organic forms
that primitives cannot express (statues, animals, terrain) are generated with
Hyper3D Rodin offline and baked into source as quantised, untextured meshes.
Textures are allowed; the kit trees draw theirs in code when the app loads
(`src/kit/trees.ts`).
After a city builds, static meshes are merged per material, so each city
renders in under 300 draw calls and 200k triangles (a test enforces both). In
`bun run dev`, saving a city file swaps it in place and keeps the camera.

To add or change a city, follow [docs/city-authoring.md](docs/city-authoring.md).
The product brief is in [docs/brief.md](docs/brief.md); the reference posters
the look is based on are in `assets/`. Known bugs and improvement ideas for
every city, with priorities, are in [docs/city-improvements/](docs/city-improvements/README.md), one file per city.
