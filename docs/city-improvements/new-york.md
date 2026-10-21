# New York improvements

Source: `src/cities/list/new-york.ts`. Part of the [city improvements](README.md) audit of 2026-10-21.

## Status

- **Budget now:** 50,304 tris, 209 draws (limits 90,000 / 220).
- **Fixed 2026-10-21:** Brooklyn Bridge crosses an inlet; streets cleared; lanes run to the plinth edge.
- **Fixed 2026-10-21 (second pass):** `empireState()` gets two low wings (z ±2.1 of the base), five continuous piers per face on every shaft, floodlit upper shafts and a floodlit lantern with a lit band and a beacon on the mast. `oneWTC()`: glass shaft glows blue at night under 18 lit `windowMaterial` bands (level lines across the facets), lit flat-shaded crown plus a beacon at the spire foot. New `chrysler(-1, -8.2)` (setback shafts, six terraced `M.steel` arches with lit triangular windows, steel spire) replaces the third midtown `artDeco`; `artDeco` has a `finial` flag. Statue copper is floodlit and the torch has a lamp flame (position from the baked mesh's top vertex). Bridge: floodlit towers (`BRIDGE_STONE`), tower-top and deck-edge lamps. Inlet widened (x from 5.4, z 1.7..6.1). East `walkUp` row moved to x=9.0 so the fire escapes end at x≈9.72, inside the plinth.
- **Left open:** the bridge is straight along Z, not the poster's diagonal. Two `walkUp` blocks on the z=9.1 street were removed rather than moved. No Flatiron wedge or Rockefeller Center yet.
- **Next:** a `prism()` Flatiron wedge in the midtown cluster; tall stacked Times Square billboards; denser bridge stays and a promenade between the roadways.

## Audit

Original findings, written before the 2026-10-21 fix pass; line numbers refer to the code at that date. Reference: assets/new-york.jpeg. Budget at audit time: 41960 tris, 173 draws (headroom ~48k tris, ~47 draws; draws are the tighter limit).

### Bugs
- **Brooklyn Bridge runs along the river, not across it** (`build()` L273-279 river patch x 5.8..9.8 / z -2..8.6; `brooklynBridge(8.0)` L371, towers at z 6.2 and 0.2). The channel is 4 wide along Z and the bridge deck (x 7.2..8.8, z -5..9.6) lies parallel inside it with both towers standing in the water (screenshot, observed). Reads as a causeway, not a crossing. Fix: make the span cross the water. E.g. rotate `brooklynBridge` by `ry` so the towers sit on the two banks, and widen the river to a band that matches the span; the poster has the water in the front-right with the bridge crossing it diagonally.
- **Buildings sit on the z=9.1 street** (L285 `road(-4.7, 9.1, 9.8, 9.1, 0.9)` spans z 8.65..9.55). `walkUp(9.1, 9.3, 1.2, 0.8, ...)` L321 covers x 8.5..9.7 / z 8.9..9.7; `walkUp(-3.9, 9.35, 1.4, 0.8, ...)` L322 covers x -4.6..-3.2 / z 8.95..9.75. Both overlap the road, and taxi lanes L400-401 (z 9.0 and 9.25, x -4.5..9.6) drive straight through them. Move the two buildings to z ≥ 9.6 (they would overhang) or drop them and shorten the lanes.
- **Bridge ramp clips the front street and a building**: the stone approach wedge (`deckPts` L117-119, ramp from z 7.8 to 9.6) crosses the z=9.1 road at y ≈ 0.3, so lane traffic at z 9.0/9.25 passes through it (code-derived). The same ramp (x up to 8.78) overlaps `walkUp(9.1, 9.3)` (x from 8.5). Visible in the zoomed shot: the wedge pokes into the front brownstone.
- **Midtown buildings sit on the cross street** (L287 `road(-5.2, -2.2, 4.4, -2.2, 0.8)` spans z -2.6..-1.8). `timesSquare(-2.9, -2.9, 1.3, ...)` L314 reaches z -2.25 and `timesSquare(0.9, -3.2, 1.5, ...)` L313 reaches z -2.45, so both overlap the asphalt by ~0.15-0.35. In the screenshots the street is barely visible behind the brownstone row, so it reads as unused paving. Shift both buildings to z ≤ -2.7 or move the road.
- Streets and lanes dead-end at the kerb: road L282 and lanes L394-395 end at x 5.6 on the river edge, so taxis visibly loop/teleport (`lane()` L391-393, `Animator.follow`). Cap the road with a quay or make the cars turn.
- Fire-escape (`fireEscape()` L179-189) renders as scattered black "Z" strokes on the +x face (crop of left tenements); the +x face is hard to see from the default camera, so they read as dirt. Move them to the +z face or give them a lighter material.
- Water along the +x plinth side has no kerb/rim (kerbs only L277-279, on the other three sides), so the water surface runs flush to the plinth edge (observed).
### Landmark fidelity
- **Empire State Building** (`empireState()` L24-47): gap → reads as a generic stepped tower. The real tower has a wide 5-storey base with side wings, then continuous vertical piers up the shaft, and a stepped, glassed lantern before the mast. Windows come out as big sparse squares (screenshot) → use `windows: 'bands'`, or leave windows off and add full-height pier strips every ~0.3 (L34-38 only draws 2 mid piers per face). Add flanking 2-storey wings to the L27 podium and lower the 0.45 `floorH`.
- **One WTC** (`oneWTC()` L50-89): faceted taper is good, but the top is a squat dark 4-segment parapet block, and the podium box (L82, 2.7 wide) is a plain slab hidden at its base. Poster: the 45° top facets end in a thin glazed crown and the base is wider and heavier. Suggest: add a mid-height setback/vertical mullion beams (`beam`), a lit crown, and a podium with a plaza. The spire is correct in height.
- **Statue of Liberty** (`statueOfLiberty()` L93-95, Rodin `LIBERTY`): statue is good, but the granite pedestal is a lumpy beige blob (crop), not the poster's tall tiered pedestal with columns, and the star fort is flat. Cheap fix: swap the pedestal for procedural `box`/`cylinder` tiers over the shape's copper part only, or re-bake the pedestal in `scripts/rodin/assets.ts`.
- **Brooklyn Bridge** (`brooklynBridge()` L112-158): gap → towers are good (pointed arches). The two decks are separate slabs (L121-124) with only straight stays, and there is no suspension-cable sag between towers beyond the single 10-segment parabola (L138-145). Poster shows the dense diagonal-stay web plus the promenade. Add 2x denser stays (L152-155 uses 5 per side), and a central promenade box between the roadways. The approaches are granite wedges instead of ramps with a road surface (L117-118 `deckPts`, no STREET on ramps).
- **Times Square screens** (`timesSquare()` L229-239): only two screen slabs per face, all at ground level; poster shows tall stacked glowing billboards on the corner towers. Add vertical screens running up to the upper section and a few rooftop signs with `screen()`.
- **Midtown cluster / skyline** (L306-315): all `artDeco()` slabs read as the same cream box with a spike (screenshot). Poster has mixed massing: a Chrysler-like tower and a Flatiron wedge. Vary footprints with `prism()` (wedge) and give one tower a sunburst crown (`profile`/`cone` stack, silver `M.steel`).
### Missing / sparse
- No Chrysler Building, Flatiron, or Rockefeller Center in a city whose poster has a dense skyline; the left half of the back row is empty paving between Empire State and the cluster.
- Rows of brownstones (`walkUp`, L318-322) are small and all the same 1.2 wide footprint, fine as filler; adding stoops/cornices variety is cheap.
- Park (L324-368): only 16 people, 4 benches, 38 trees; no skaters on the pond, no fountain, no bridge/arches. Ground in front of pond is flat. Add a small `bob`/`follow` skater group on `POND` and a few lampposts inside.
- Street life: only 3 steam vents (L380-382), small ferries (L372-373) are plain boxes. Add a Staten Island ferry/tug with a funnel and wake and a few pedestrians on crossings.
- Taxis only; no bus (`bus()`) or yellow cab variety; no NYC yellow-taxi roof lights.
- East River quay (L275) has no piers/boats at the docks, the water is a flat strip.
### Night look
- **One WTC has no lit windows at night** (screenshot: solid navy; `GLASS_TALL`/`GLASS_DARK` L11-13 are plain `mat`). Switch to `windowMaterial` bands or add emissive strips and a lit crown.
- Empire State is only lit by its small grid windows; the real building is floodlit. Add an emissive lantern/crown (`lampMaterial`).
- Bridge, statue torch and street lamps give no visible glow; add lit bridge towers/lights and a lit torch.
- Windows are lit and screens glow well on midtown and brownstones (good).
### Rodin candidates
- Statue of Liberty already baked. Re-bake only if the pedestal/fort is regenerated (pedestal looks poor at ~100px; borderline Rodin since it's architectural). Tug/ferry boats are too small (<120px) to be worth it. Otherwise None: everything else is architecture/lattice, stays procedural.
### Priority
1. Fix the bridge orientation so it crosses the river (reshape the river L273-279 and rotate/reposition `brooklynBridge`), and remove the ramp clipping into the z=9.1 street and the building at (9.1, 9.3).
2. Remove the building/road overlaps (L321-322 on z=9.1, L313-314 on the z=-2.2 street) and fix the dead-end taxi loops.
3. Raise skyline fidelity: ESB wings/piers (`empireState`), a Chrysler-style tower in the midtown cluster, and lit One WTC at night.

### People pass (2026-10-21)
- Park crowd (14) now placed with `scatter(..., avoid)` off the pond rim, ring and cross paths, the four benches and every tree (tree positions recorded); feet at y 0.06 on the lawn.
- NY coat palette (black, charcoal, camel, navy, denim, a few red/yellow/green accents) via `person({ color })`.
- 7 animated walkers on closed loops: 2 on the park ring path (y 0.075), 1 on the park pavement frame (y 0.04), 2 on the brownstone sidewalk at z ~0.1 (y 0), and 2 skaters circling the pond ice (y 0.12, 0.7 speed).
- Left out: walkers on zebra crossings (taxi lanes run straight through all of them). Budget 179 -> 209 draws (3 more walkers/skaters would exceed the 212 cap), 49,264 -> 50,304 tris.
- Verified in one night-time browser frame at 1 FPS; zoom would not go closer, so foot contact is confirmed from the budget/heights, not a close-up.
