# London improvements

Source: `src/cities/list/london.ts`. Part of the [city improvements](README.md) audit of 2026-10-21.

## Status

- **Budget now:** 39,968 tris, 175 draws (limits 90,000 / 220).
- **Fixed 2026-10-21:** Shard rebuilt with lit bands; Tower Bridge anchors off the roads; trees and people off the lane; Big Ben ledge.
- **Fixed 2026-10-21, second pass:** Gherkin added (`gherkin()`, `lathe` hull at (4.5, -9.1), 6.5 tall, two families of helical lattice beams, lit floor bands; reuses the Shard glass/rib materials, 0 extra draws). London Eye: rim 0.03 to 0.06, spokes 0.014, bigger hub, blue egg-shaped pods, and the whole wheel on `floodMat` so it glows at night (same draw count). St Paul's scaled 1.3x via the group, moved to (2.7, -7.4), 16 dome ribs, lit attic windows, floodlit lead dome (`LEAD` is now a `floodMat`); the terrace in front moved from z -4.1 to -3.3 and the tourists to z -4.15 so the portico is clear. Shard window bands thinned (0.4 to 0.14 tall, spacing 0.7 to 0.9). Boats stop 0.2+ clear of both bridge decks (x ends -1.1, 1.3, 4.5, 6.9); Westminster Bridge piers are now two 0.32-high stone stubs per pier line flanking the road (they no longer sit under the traffic lane).
- **Left open:** Westminster Bridge is still a flat deck with rails (no arches); boats still do not pass under the bridges; Tower Bridge span/bascules unchanged; Rodin not needed.
- **Next:** Arched green fascia for Westminster Bridge (`profile` + `archHole`); widen the Tower Bridge span; office slab pair behind St Paul's; roundabout garden at the front corner.

## Audit

Original findings, written before the 2026-10-21 fix pass; line numbers refer to the code at that date. Reference: assets/london.jpeg. Budget at audit time: 33168 tris, 176 draws (headroom ~57k tris, only ~44 draws: reuse existing materials, new glass/lit materials cost draws).

### Bugs
- **Shard tip is an arrowhead** (`shard()` l.190): the cap `hipRoof(0.6, 0.6, 1.0, …, { y: 10.6 })` is 0.6 wide, but the main pyramid is only ~0.09 wide at y 10.6 (1.7·(1−10.6/11.2)), so it flares out as a flat "arrow" above the spire (visible in zoom). Drop it or make it ~0.1 wide. The three offset `hipRoof`s (l.187–189) also interpenetrate into broad flat slabs with no glazing detail.
- **Tower Bridge anchor piers block both embankment roads** (`towerBridge()` l.240: `box(1.2, 0.5, 0.3, TB_STONE, { z })` at z = RIVER_Z0−1.0 = −2.6 and RIVER_Z1+1.0 = 3.6). The roads sit at z −2.3 and 3.5 (w 0.6, `build()` l.368–369) and cars travel at z −2.45/−2.15/3.35/3.65 (l.429–432), so traffic drives through a cream block (confirmed in zoom, bus half-buried at the south end). Move the piers off the lane or make the road dip under a portal.
- **Trees on / next to the car lane**: `row(6.8, -2.1, 9.4, -2.1, 4, tree)` (l.412) is inside the road (−2.6…−2.0) where fleet z=−2.15 runs; `row(-9.2,-1.95,-6,-1.95,…, z-0.1)` (l.406) also sits at z≈−2.05 on the lane edge. Pedestrian `scatter` at z −2.0 d 0.3 (l.415) is on the lane edge too. Shift trees/people to z ≈ −1.85 (between lane and river wall at −1.67).
- **Clock-spire gold ledge is buried** (`elizabethTower()` l.135): `box(0.64, 0.05, 0.64, GOLD, { y: 6.6 })`, but the `hipRoof(0.9, 0.9, 2.1)` is already ~0.69 wide at y 6.6, so the ledge is hidden inside the spire.
- **Trees clip into houses** [unverified, from coordinates]: tree scatter (l.408, x 1.3–4.3, z 5.7–7.9) overlaps `terrace(3.4, 5.4, 3.2, 1.3)` (z up to 6.05); last tree of `row(-9.3,4.4,-9.3,9.2)` (l.410) lies inside `terrace(-8.9, 8.9, 1.4, 1.4)`; last of `row(-1.4,4.5,-1.4,9.2)` (l.411) touches `terrace(-2.2, 8.8)`. Lawn (l.362) also runs under Westminster's footprint (z −4.4…−4).
- **Boat clearance** [unverified]: boat len 0.9 (half 0.45) starting at x=0.9 / ending at 4.9 / −0.8 (l.440–443) overlaps the Westminster Bridge deck (x −0.3…0.7) and Tower Bridge base (x 5.05…) at path ends; the loop turns right next to the bridges. Boats never pass under either bridge, so the channels read as dead.
- **Westminster Bridge piers barely visible** (`westminsterBridge()` l.248): box y −0.05, h 0.18 → top at 0.13, about 0.1 above water: reads as a flat slab.

### Landmark fidelity
- **The Gherkin (30 St Mary Axe)** is on the poster (right of the Shard, ~170px) and absent from the city: add `gherkin()` at the right/back corner (~x 3…5, z −9) via `lathe()` profile (bulged, tapering to a dome) with diagonal lattice bands (`windows`-like bands in `windowMaterial` + `beam`s), ~6–7 units tall; ~1.5k tris.
- **The Shard** (`shard()`): gap → pale single-tone pyramid with no facets/ribs; poster shows dark glass, vertical fracture lines and a splintered top. Procedural change: replace the 4 hip-roofs by a stacked `cylinder(…, {segments:4, ry: π/4})` frustum chain (flat-shaded `mat(..., {flat:true})`), 5–6 shifting glass shards of different heights at the top, thin `beam` ribs, dark-blue glass (the current 0xaed0e6 reads washed-out against the sky at day). At night nothing lights it: use `windowMaterial` bands.
- **St Paul's** (`stPauls()`): dome and drum read well, but it is small (dome ~3.5 high vs Tower Bridge 6.4) and mostly occluded by Tower Bridge and the terrace at (3.0,-4.1). Poster has a big dome with a drum colonnade, bold pediment, tall west towers. Do: scale dome up ~1.3×, add ribs (thin `beam`s down the lead dome), thick drum stone cap, mid-height gallery with `windowMaterial`; move `terrace(3.0,-4.1,…)` (l.392) away from the portico (the portico face is at z −4.8, terrace back at −4.55).
- **Tower Bridge** (`towerBridge()`): towers are good, but the central span is only 1.3 between towers (towers 0.9 deep), real ratio ≈ 3× tower width; poster shows a wide opening. The walkway (l.221–223) is buried in the tower tops and is one flat blue box. The bascules are a 0.012 box with no leaves, and no road ramp rises. Do: widen `tz` to about [-0.9, 1.9] (check boat z), put the walkway on top of the gap, raise bascule leaf hint, add white/blue lattice side panels (`beam`).
- **Westminster Bridge** (`westminsterBridge()` l.244): flat slab + lamps. Real: five shallow green/steel arches. Do: use `profile()` + `archHole` for a low arched fascia in green and larger visible piers.
- **Palace of Westminster** (`westminster()`): good rhythm of bays but low (1.2 high vs the tower's 8.3) and dark window boxes are small. Poster shows taller palace with prominent central tower (Central Lobby spire) and steeper roofs. Do: add a slim central lantern spire on the roof (cone + 4 pinnacles, ~1.5 high), raise `H` to ~1.5, make the river facade face the Thames more clearly (pavilions only on +z).
- **Elizabeth Tower** (`elizabethTower()`): decent. Clock faces `M.white` do not glow at night; use `lampMaterial` for the faces so they light up (night screenshot shows them white but unlit as the facade). The shaft is plain (windows are only 0.12 wide slits): add Gothic panels/buttress ribs.
- **London Eye** (`londonEye()`): rim radius 0.03 and spokes 0.008 read as a faint white mesh, almost invisible against the pale sky/water; capsules are 0.12 white cubes (poster: bold white rim, blue egg-shaped capsules). Do: rim 0.05, tinted blue capsule material (`capMat` 0x7fb0e0) as small `cylinder` ovals, hub bigger; at night give rim/capsules `lampMaterial` so it glows (in night shot the Eye is dark).

### Missing / sparse
- **City office cluster** behind St Paul's (poster: two tall beige/grey slab towers at the back, 3–4 units): `tower()`/`building({plain:true})` pair at around (-0.5,-8) / (1,-8.8), cheap (~300 tris).
- **Roundabout with a small garden** at the front corner (poster front); currently the front is plain crossing + 4 houses. Add `ring` of `patch` + `tree` (cheap) at the (0.2,3.5) or (5.7,3.5) crossing.
- **Georgian/hotel block** (poster shows a cream corner hotel with mansard) - currently all fillers are the same `terrace()` template (gable/hip roof + shopfront on every one, brick colours cycle 5x); only 2 distinct roof styles. Use `building({ roof: 'mansard' })` for 2–3, vary heights/footprints, and drop `shop` on riverfront ones.
- **Thames isn't Thames**: the river is a straight band with a straight wall; poster has a bend and a quay (Tower Bridge pier). Optionally `area([...])` bend near Tower Bridge.
- **Street life**: no pedestrians on the bridges, none along the Eye's quay in motion (people are static scatter), no boats under the bridges, no tour-boat wake. Add `anim.follow` people on Westminster Bridge and tour boats with passage under the arches; a red double-decker count of 3-4 per lane is fine.
- **Night**: the Eye, Shard, St Paul's dome and Tower Bridge towers/chains are dark (only windows glow). Use `lampMaterial` for the Eye rim/capsules, Tower Bridge blue chains, and floodlit tower/dome rims.
- Front-corner / right area is large flat pavement (x -9…-4, z 4…9 and x 6…9.8, z 3.2…9.8): feels empty beside the dense back half.

### Rodin candidates
- None. No organic form ≥ ~120px: the landmarks are architecture, lattice and glass (Rodin pipeline doc keeps these procedural). The Gherkin is a surface of revolution, doable with `lathe()`.

### Priority
1. Add the Gherkin and fix the Shard (arrowhead tip, flat facets, dark glass, lit windows at night): the two biggest poster-vs-city gaps, ~+3k tris, +1–2 draws.
2. Fix Tower Bridge: anchor piers blocking the roads (l.240), widen the central span, and fix the trees/pedestrians sitting on the car lane (l.406/412/415); a clear correctness win.
3. Fatten and light the London Eye (rim, blue capsules, glow at night) and resize/unhide St Paul's (bigger dome, move the terrace at l.392) — the Eye and St Paul's are currently the weakest-reading landmarks.
