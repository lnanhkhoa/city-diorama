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
| `tree({ kind: 'round' \| 'cone' \| 'palm' \| 'blossom' \| 'umbrella' })`, `lamp`, `bench`, `person({ color, umbrella })`, `car({ taxi })`, `bus`, `boat`, `screen` | Props. Trees (`src/kit/trees.ts`) vary size, tone, lean and crown layout by position. They use three shared textured materials (canopy, frond, bark) with the colour in vertex colours, so all trees in a city, of every kind, cost three draw calls. Build tree-like props through `tree()` rather than flat `M.leaf` primitives, or they lose the leaf texture. A palm is ~830 tris and its fronds reach ~0.53·`s` from the trunk; a round or blossom tree is ~620 tris, an umbrella (Italian stone pine: tall bare trunk, flat lobed crown reaching ~0.5·`s`) ~580, a cone tree ~80. Budget dense groves accordingly. Vehicles and people are pre-merged per material, so they can be animated as is. `person` is ~0.235 tall (umbrella canopy to ~0.33): set `y` to the top of the surface under it (0.04 on a default `patch`, 0.05 on a `road`), give it a city clothing palette via `color`, and it faces a position-hashed direction unless `ry` is set. |
| `rng(seed)`, `scatter(rect, n, rand, make, avoid?)`, `row(x1, z1, x2, z2, n, make)` | Deterministic placement. `avoid(x, z)` redraws points that fall on footprints (tower legs, pools, monuments) inside the rect. |
| `Animator.follow / spin / bob` | Traffic on paths, rotating things, bobbing boats. Return `anim.update` as `update`. |
| `M.*`, `mat(color, opts)` | Shared palette and cached materials. Reuse materials: identical `mat()` calls batch into one draw call. |
| `M.water`, `waterMat(color)` | Water with animated ripples, wind patches, glitter and a Fresnel sky reflection that follows the weather and time of day (no UVs needed, still merges). The shader deepens and slightly desaturates `color` as the body colour and darkens it at night, so pick the water's daylight hue. When a city mounts, the stage bakes top-view shore maps from the scene's geometry (`src/kit/shore.ts`, ~10–40 ms): every shore gets a thin lapping foam line, and a beach or low bank (the dry cells touching the water lie no more than 0.03 above it, with no wall beside them) also gets a lighter, greener shallow margin about 0.4 wide and a surf zone, where small waves roll in toward the beach with broken, foaming crests. Surf needs open water: where another shore lies within ~0.9 offshore (a lagoon, the gaps between the Palm's fronds, a narrow river) it drops to a faint lap. Do not paint a static white surf strip along a beach: the shader draws the surf, and a strip standing in the water would itself become shore. Seawalls, quays and kerbs keep deep water right up to them, so model a wall as a solid that stands above the water and a beach as ground at or below water level. Ground standing in the water (islands, piers, bridge piers) counts as shore. A bridge deck or arch does not when its underside sits more than 0.01 above the water, so give a low bridge a real soffit rather than running the road through the river; decks 0.6 or more above the water never count. Static props smaller than 0.35 units² out on open water (moored boats) leave the water open around them. Dry ground within 0.4 of the tile rim counts as plinth curb, not shore. Use for every water surface, in the city's own colour if needed. |
| `mergeStatic(group)` | Pre-merge an animated assembly per material before animating it. |
| `windowMaterial`, `lampMaterial` | Glow automatically at night. Use for any glazing/lit sign you want lit at night. |
| `floodMat(color, glow, peak)` | Surface that looks plain by day and glows `glow` at night (`peak` intensity at full night), for floodlit statues and stadium pitches. Cached like `mat()`. |
| `floorLinesGlass(color, { height, first, step, count, width }, { roughness, metalness, line, glow, peak, crown })` | Tower glass whose shader paints floor lines across the walls, at no triangle cost: window glass by day, lit floors at night like `windowMaterial`; flat decks and roofs stay plain. Line heights are fractions of `height` in the mesh's own frame, which for a `shape()` are the bake's normalised levels. `line` tints the lines by day for glass of another hue (Bitexco's blue-green). `glow`/`peak` add a night wash like `floodMat`. `crown: { from, color, glow, peak }` colours everything above `from` (same fraction) without lines: `color` by day, lit `glow` at night (Landmark 81's red LED crown). One per tower (the lines live in its uniforms); its meshes stay out of static merging (`userData.objectSpace`), so each part of the shape is a draw call. |
| `shape(data, materials, { height, smooth })` | Place a mesh baked from Hyper3D Rodin (`import data from '../shapes/<name>.shape'`): one palette material per part, bottom-anchored, scaled to `height`. For statues, animals, terrain; see [rodin-pipeline.md](rodin-pipeline.md). |
| `vietnamFlag({ h, s })` | Flag of Vietnam on a pole of height `h`, scaled by `s`: official 2:3 red field and centred five-pointed yellow star, flying toward +x. Shared by Hanoi and Ho Chi Minh City. |

## Rules

- No downloaded models or network assets. Build from kit primitives;
  only organic forms they cannot express may use a baked `shape()`. When a Rodin
  tower needs storeys its bake cannot carry, give it `floorLinesGlass()` rather
  than geometry. `shape()` takes `xzScale` to narrow a stocky Rodin footprint
  without losing height.
- Textures are allowed. Share one material per texture across every mesh that
  uses it, and give those meshes `uv`, so the static merger still folds them into
  one draw call (it keeps `uv` and vertex `color` where the material reads them).
  The kit trees (`src/kit/trees.ts`) show the pattern: textures drawn in code,
  hue in vertex colours.
- Never create `new THREE.MeshStandardMaterial` per object; use `mat()`, or for a
  texture one cached material built once (as `treeMaterials()` does).
- Static meshes are merged automatically by material after `build()`. Anything
  animated must go through `Animator` (which flags it dynamic).
- `build()` must be deterministic (use `rng(seed)`, never `Math.random`).
- Budget after static merging (enforced by `tests/cities.test.ts`): under 150k
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
