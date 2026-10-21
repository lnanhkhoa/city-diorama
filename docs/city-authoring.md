# Authoring a city diorama

Each city has two parts:

- A `CityDef` entry (`src/cities/types.ts`) in `CITIES` in `src/cities/index.ts`:
  metadata only, in display order. It ships in the entry bundle so the header,
  picker and weather work before any scene loads.
- A scene module, `src/cities/list/<slug>.ts`, whose default export is the
  `build(): CityScene` function. The registry picks it up through a lazy
  `import.meta.glob`, so each city is its own chunk, fetched the first time it
  is shown (with a loading indicator if that takes longer than 150 ms) and
  prefetched when a neighbour in the order is on screen.

Keep scene-only code and baked shapes inside the scene module (or `src/kit/`);
importing them from the entry side would pull them back into the main bundle.
`src/cities/list/paris.ts` is the reference implementation.

## Coordinate system

- The tile is 20 × 20 units: X and Z span `[-10, 10]`, top surface at `y = 0`.
  Keep everything inside `[-9.8, 9.8]` so nothing overhangs the plinth.
- The default camera looks from the `(+x, +z)` corner. On screen:
  front corner `(+10, +10)`, back `(-10, -10)`, left `(-10, +10)`, right
  `(+10, -10)`. Put the tallest landmarks at the back or sides so they do not
  hide the rest; put low, wide landmarks (bridges, arches, harbours) in front.
- Scale: a 6-storey block is ~2.5 units; signature towers 8–12 units; nothing
  above ~13 units.

## Kit (`src/kit`)

Import from `'../../kit'`. Every primitive is bottom-anchored: `y` is where the
object stands; `Place = { x, y, z, ry }`.

| Helper | Use |
|---|---|
| `createBase({ top, side })` | Display plinth: bevelled street cap (top face at y = 0), dark seam, strata body. Always the first child of `root`. |
| `box`, `cylinder`, `cone`, `dome`, `sphere`, `lathe` | Solids. `cylinder(..., { segments: 4, ry: π/4 })` gives a square frustum, but it keeps round (smooth) normals: give glass or glossy frustums a `mat(..., { flat: true })` material so each face reads as a plane. |
| `prism(outline, h)` | Extrude an `[x, z]` footprint upward (odd-shaped buildings). |
| `profile(points, d, { holes })` + `archHole` | Extrude an `[x, y]` side profile through depth (arches, bridge spans, sails). |
| `beam(a, b, t)` | Strut between two 3D points (lattices, cables, cranes). |
| `tube(points, r)` | Curved pipe (arches, monorails). |
| `gableRoof`, `hipRoof`, `mansardRoof` | Roofs; `building({ roof })` adds them for you. |
| `building({ w, d, h, wall, trim, roof, roofMat, windows, plain, shop })` | Block with windows (glow at night), base course, sill courses, cornice, a door on the +z face, and a parapet with rooftop plant (flat roof) or chimneys (pitched). `trim` colours the cornice/sills; `plain: true` drops the clutter for glass towers, stacked sections and podiums; `shop: <awning colour>` turns the +z ground floor into a lit shopfront with fascia and awning. |
| `tower({ w, d, sections, step, spire, round })` | Skyscraper: glazed lobby, sections narrowing by `step`, a ledge at each setback, a crown, optional spire. |
| `patch`, `area(outline)`, `road(x1, z1, x2, z2, w)`, `crosswalk(x, z, roadW, { ry })` | Flat ground: plazas, lawns, water, streets, zebra crossings (`ry` 0 for a road along Z, π/2 along X). |
| `tree({ kind: 'round' \| 'cone' \| 'palm' \| 'blossom' })`, `lamp`, `bench`, `person({ color, umbrella })`, `car({ taxi })`, `bus`, `boat`, `screen` | Props. Trees vary size and tone by position; vehicles and people are pre-merged per material, so they can be animated as is. `person` is ~0.235 tall (umbrella canopy to ~0.33): set `y` to the top of the surface under it (0.04 on a default `patch`, 0.05 on a `road`), give it a city clothing palette via `color`, and it faces a position-hashed direction unless `ry` is set. |
| `rng(seed)`, `scatter(rect, n, rand, make, avoid?)`, `row(x1, z1, x2, z2, n, make)` | Deterministic placement. `avoid(x, z)` redraws points that fall on footprints (tower legs, pools, monuments) inside the rect. |
| `Animator.follow / spin / bob` | Traffic on paths, rotating things, bobbing boats. Return `anim.update` as `update`. |
| `M.*`, `mat(color, opts)` | Shared palette and cached materials. Reuse materials: identical `mat()` calls batch into one draw call. |
| `M.water`, `waterMat(color)` | Water with animated ripple shading (no UVs needed, still merges). Use for every water surface, in the city's own colour if needed. |
| `mergeStatic(group)` | Pre-merge an animated assembly per material before animating it. |
| `windowMaterial`, `lampMaterial` | Glow automatically at night. Use for any glazing/lit sign you want lit at night. |
| `floodMat(color, glow, peak)` | Surface that looks plain by day and glows `glow` at night (`peak` intensity at full night), for floodlit statues and stadium pitches. Cached like `mat()`. |
| `shape(data, materials, { height, smooth })` | Place a mesh baked from Hyper3D Rodin (`import data from '../shapes/<name>.shape'`): one palette material per part, bottom-anchored, scaled to `height`. For statues, animals, terrain; see [rodin-pipeline.md](rodin-pipeline.md). |

## Rules

- No textures, downloaded models, or network assets. Build from kit primitives;
  only organic forms they cannot express may use a baked `shape()`.
- Never create `new THREE.MeshStandardMaterial` per object; use `mat()`.
- Static meshes are merged automatically by material after `build()`. Anything
  animated must go through `Animator` (which flags it dynamic).
- `build()` must be deterministic (use `rng(seed)`, never `Math.random`).
- Budget after static merging (enforced by `tests/cities.test.ts`): under 90k
  triangles and at most 220 draw calls. Prefer `windows: 'bands'` on large
  towers and lower `segments` on small round things.
- Build each hero landmark from its identity outward: silhouette and
  proportions first, then construction (setbacks, arches, ribs, openings,
  railings) as geometry, then colour. Detail should explain the object, not
  decorate it; keep filler blocks economical.
- Animated assemblies (wheels, cable cars, rotating rides) should be merged
  per material with `mergeStatic(group)` before animating, as `car()` does;
  otherwise every spoke is a separate draw call.

## Inspecting a city

Open `http://localhost:5173/#/<slug>` after `bun run dev` and orbit/zoom with
the mouse. Saving a city file swaps the city in place and keeps the camera
(no page reload), so you can stay zoomed on a landmark while editing it. In
automated captures, bring the tab to the front and wait for the intro (≈1 s)
before capturing, otherwise the frame can be stale.

## CityDef fields

`slug` (kebab-case, matches the scene file name), `name`, `country`, `lat`,
`lon`, `timezone` (IANA), `theme.bg` (two hex colours, light poster gradient),
`theme.ink` (dark text colour readable on it), `fallback` (`kind` and `tempC`
typical for the city).
