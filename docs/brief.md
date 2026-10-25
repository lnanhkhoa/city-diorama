# Cities Diorama — Project Brief

## Outcome
A browser app (Vite + Three.js + TypeScript) that renders a stylised isometric
diorama of a world city: a square tile carrying its landmarks, streets, water,
trees, traffic and people, framed by a poster-style overlay (city name, live
weather icon, local date, temperature). Visual reference: the `assets/` posters.

## Scope
- 13 cities: Paris, New York, Sydney, Rome, Kuala Lumpur, Tokyo, London,
  Dubai, Cairo, Rio de Janeiro, San Francisco, Hanoi, Ho Chi Minh City.
- All geometry is built in code (no downloaded models); organic forms may be
  Rodin meshes baked into source. Textures are allowed (the kit trees draw
  theirs in code). One module per city.
- Orbit / zoom with mouse and touch, idle auto-rotate, animated traffic/boats.
- Live weather from Open-Meteo (no API key). Falls back to a per-city default
  when offline. Weather drives particles (rain, snow), light, and day/night
  (lit windows at night).
- Navigation: prev/next buttons, keyboard arrows, city menu, `#/<slug>` deep links.
- Share (Web Share API, else copy link) and Save (PNG of the current view).

## Constraints
- Static site, no backend, no secrets. Runs offline except the weather call.
- Desktop and mobile widths; 60 fps target on a laptop iGPU.

## Non-goals
- Geographic accuracy, real map data, CMS, accounts, deployment (not requested).

## Acceptance criteria
1. `bun run dev` serves the app; every city renders with no console errors.
2. `#/<slug>` loads that city; unknown slug falls back to the first city.
3. Overlay shows city name, weather icon, local date in the city timezone, °C.
4. Rain/snow particles appear for rain/snow weather codes; night lights windows.
5. Save downloads a PNG; Share shares or copies the link.
6. `bun run test`, `bun run typecheck`, `bun run build` pass.

## Definition of done
Acceptance criteria verified locally in a real browser. No live target.

## Assumptions (auto mode)
- bun (package manager + script runner), TypeScript strict, Vitest for unit
  tests (Vite's `import.meta.glob` powers the city registry).
- Montserrat (self-hosted via Fontsource) matches the reference typography.
- Tile is 20×20 world units, top surface at y = 0.
