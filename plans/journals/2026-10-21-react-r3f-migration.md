# React + react-three-fiber migration (2026-10-21)

**Change.** The vanilla `main.ts` + DOM-class UI became a React 19 app (`src/App.tsx`, `src/main.tsx`) with the 3D view in a react-three-fiber `<Canvas>` (`src/scene/Diorama.tsx`). `index.html` now holds only `<main id="app">`; markup moved into JSX with the same classes, so `style.css` is unchanged.

**Scene split.** The `Stage` class was removed:
- `Diorama.tsx`: the canvas, camera fit (`manual` camera), three's own `OrbitControls`, the composer render loop (`useFrame` priority 1), and poster `snapshot` behind a `DioramaHandle` ref.
- `Atmosphere.tsx`: lights as JSX, the environment map, the shadow catcher, `WeatherFx`.
- `city-stage.ts`: the city swap, including the uncommitted "build after outro" change that was already in the working tree.
- `passes.ts` and `lighting.ts`: unchanged logic.

City scenes stay procedural builders mounted with `<primitive>`. Porting 13 cities' worth of kit code to JSX would gain nothing.

**Decisions.**
- No drei. It pulled about 58 packages, including three-stdlib, for one controls class.
- The adaptive pixel ratio is React state fed into `<Canvas dpr>`. R3F re-applies `dpr` on every configure, so calling `gl.setPixelRatio` directly would be reverted.
- HMR for city modules now goes through `src/cities/live.ts` (`useSyncExternalStore`). It is the only runtime importer of `./index`.
- `@vercel/speed-insights/next`, which the user had added in `main.tsx`, broke the Vite build. It is switched to `/react`.

**Cost.** The three chunk grew from 645 to 801 kB because R3F imports the whole namespace. The new react chunk is 394 kB (123 kB gzip).

**Verification.** typecheck, build, 109 tests. Dev browser checks:
- weather pins in the URL and the menu
- arrow navigation
- picker filter, Enter, and Esc to clear then close
- loader under a delayed chunk: show → done
- the Save PNG download and its toast
- a city-file HMR swap with no page reload

The production preview renders Tokyo at 60 FPS.
