# Hanoi improvements

Source: `src/cities/list/hanoi.ts`. Part of the [city improvements](README.md) audit of 2026-10-21.

## Status

- **Budget now:** 108,030 tris, 202 draws (limits 200,000 / 300), measured 2026-10-23 after the kit tree rework (53 round trees, ~33k tris). The motorbikes take about 47k tris; about 92k tris of headroom since the limit rose to 200k on 2026-10-25.
- **Reworked 2026-10-21 from `assets/hanoi.png`:** the scene now follows the poster layout. Long Bien runs along the left edge (x = -8.9) as five pointed cantilever truss spans on twin stone piers, with a three-car train shuttling on the deck. The Flag Tower stands on the left (three crenellated brick terraces with arched gates, a stair, an octagonal shaft, a lit lantern storey and a flag). Hoan Kiem Lake sits in the middle with the Turtle Tower on a green island, reached by the red Huc bridge from the south-west shore. The Opera House and one long row of 18 Old Quarter tube houses line the back edge. The Mausoleum stands in front on Ba Dinh plaza with its lawn grid. There are three colonial villas and a lakefront flagpole. Trees fill the open ground on a jittered grid that keeps clear of `ROADS`, the lake and building footprints. Removed because they are not in the poster: the Red River, Van Mieu, One Pillar Pagoda, Ngoc Son temple, the Lotte tower, overhead wires and flame trees.
- **Detail pass 2026-10-21, checked region by region against `assets/hanoi.png`:**
  - **Long Bien:** the truss is now deepest over the solid stone piers and dips at mid-span, as in the poster. The bridge ends at z = 6.4 and slopes down to the deck, leaving the front-left corner for a small house with a café parasol. The deck has sleepers.
  - **Flag Tower:** continuous parapets with posts, brick-paved walks, two arched gates per face below and a framed gate on the middle tier. The stair is on the +x side, the shaft has rows of windows, and the lantern head is wider than the shaft with an overhanging cap.
  - **Opera House:** a grey slate roof with two domed turrets with spires, replacing the green dome. A central bay of tall arches with a pediment.
  - **Mausoleum:** a broad three-step podium, square columns in front of dark red walls, a lettered band, a stepped roof and a side stair. Lawns with white edges on three sides, plus potted shrubs.
  - **Lake:** the Huc bridge is flatter, with red posts standing in the water. The Turtle Tower is pale stone on a faceted, shrub-lined island.
  - **Streets:** the lake road now bends away from Ba Dinh and runs up the east shore to the Old Quarter street.
  - **Old Quarter:** the houses vary in width and are taller.
- **Layout pass 2026-10-21:** positions are now read off the poster through a homography fitted to the plinth corners (the poster is in perspective, so the earlier eyeballed iso mapping put the far side too close). Changes:
  - **Lake:** bigger and moved toward the front (x -2.6..6.7, z -5.8..2.0), with the island at (2.4, -1.4). This shrinks the left side.
  - **Long Bien:** six spans along the whole left edge, corner to corner. The small corner house sits between the bridge and its road.
  - **Ba Dinh (at the user's request):** the Flag Tower (x -4) and the Mausoleum (x 4.2, scaled to 0.88) form a pair of the same size, centred at the same distance from the front edge (z 7.3). The Mausoleum now faces the lake road across a courtyard, with the flagpole on its axis and lawns on both sides of the central walk.
- **Motorbikes 2026-10-21:** re-baked from `.rodin/motorbike.glb` at 1,500 tris (it was 500), which gives the scooter body 170 tris and the hat 42 (they were 62 and 5). The bikes are now painted like the asset: charcoal tyres, seat and rider (`BIKE_DARK`), a straw conical hat (`BIKE_HAT`), and only the scooter body tinted per mover. The asset's red is weighted first in `BIKE_COLORS`. Previously the red body was painted charcoal and the clothes and hat took the bike colour. That costs 4 draws per mover.
- **Hoan Kiem pass 2026-10-21 (against the lake detail of the poster):**
  - **Turtle Tower:** rebuilt as a square three-storey tower narrowing upward, with tall arched openings (two per face on the lower storeys, one on the third), corner pilasters, two-step cornices with corner finials, and a crenellated top storey under a crown. It is floodlit warm at night.
  - **Island:** an irregular stone-edged polygon, with the tower toward its back, round shrubs along the rim and small trees.
  - **Huc bridge:** post-and-rail balustrade, water posts with knee braces, and lamps at both ends. The shore gate was dropped because it is not in the poster. The bridge glows red at night.
  - **Lake:** the water now sits below a raised sandstone curb (`prism` with the lake as a hole). The grass verge is lined with a clipped hedge and round shrubs, opening where the bridge lands.
  - **Swans:** the swan pedal boats were removed from the lake at the user's request (2026-10-21).
- **Left open:** the Ngoc Son temple and the Old Quarter wires are gone with the rework. The poster puts the Mausoleum in the front corner; it was moved into the balanced pair at the user's request.

## Audit

Original findings, written before the 2026-10-21 fix pass; line numbers refer to the code at that date. Reference: none (judged against real Hanoi). Budget at audit time: 61894 tris, 172 draws.

Headroom: ~28k tris, ~48 draws. Draws are the tighter limit only if new materials are added; reuse existing `mat()` colours.

### Bugs
- **Motorbike colour is lost** (`motorbikePair()`, l.50-58): `motorbike.shape.ts` parts are 0 = dark (412 tris, tyres + clothes + most of the bike), 1 = `#cb2e20` body (63 tris), 2 = straw (5 tris). `BIKE_COLORS` is only applied to part 1, so in the zoomed screenshot nearly every rider reads as a black blob with a small yellow/red/white speck. The straw hat (5 tris, ~0.01 units) is invisible. Fix: re-bake with a larger colour region (jacket/body), or recolour part 0 to a per-bike `mat()` from `BIKE_COLORS` and keep tyres dark through a separate part.
- **Orientation is correct but unreadable.** I decoded the baked verts: long axis is z, rider mass peaks at z -0.22..0.1 (hat at z ≈ -0.07), the low part is at +z, so +z is the front and `Animator.follow` (`atan2(dx, dz)`, motion.ts l.49) rides front-first. At default zoom a bike is ~15-20 px and the front/back cannot be seen; zoomed in one bike showed a red nose leading. No bug in direction; the problem is size/contrast. Fix: raise `height` 0.26 → ~0.34 (bike ≈ 0.37 long vs lane width 0.45) and the pair offsets `[-0.07, 0.12]`/`[0.08,-0.1]` to ~±0.1 so the two riders separate visually.
- **Two bikes merge into one clump:** the offsets in `motorbikePair()` are 0.15 apart in x and 0.22 in z with a 0.12 wide bike, so the silhouette is a single dark mass. Offset the second one by ≥ 0.2 in z and let them overlap less.
- **Lane ends pop mid-street:** `lane()` calls end at x = 6.5 (z = 8.2, 8.6, -1.15, -0.85) and wrap back to x = -9.6 (l.554-559), so bikes vanish in the middle of the junction with the x = 7 road. Extend the horizontal lanes to x = 6.9 to match the north-south bikes, or end them at the plinth edge.
- **Long Bien bridge does not cross the river** (`longBien()`, l.366-412): it runs along the full edge parallel to the river at x = 8.6 (z -9.6..9.6), above `RIVER` (x 7.6-9.8). The deck sits at y 0.7 and ends in mid-air at both z ends with no abutment or ramp. The river is almost hidden behind the truss; the sampan (`anim.follow`, x = 8.0, l.545) sails under the deck and is only partly visible. Fix: widen the river visible area (move bridge to x ≈ 9.0 or shift `longBien` and `RIVER` so 1 unit of water shows on the city side), add ramp/abutment boxes at both z ends, or turn the bridge 90° so it spans the river (`[unverified]` as a layout change, since the river is only 2.2 wide).
- **Fixed (2026-10-23): white streaky `waterMat` glints that read as a frosted slab.** They were the studio environment map's light panels and broad rim-light highlights. `waterMat` now mirrors a sky gradient through Fresnel and breaks direct highlights into small glitter points. Hoan Kiem `LAKE` is now jade (`0x6f9e72`) instead of turquoise.
- **Shadow acne on the mausoleum wall** (`mausoleum()`, l.241): the granite wall between the colonnade columns looks speckled in the zoomed day shot. `[unverified]` whether caused by the coplanar red band `box(1.6,0.14,0.04,...)` at z 0.96 or by shadow bias on the large box; try `receiveShadow` off for that wall or a slight inset.
- **Title text covers the Lotte tower at default zoom** (`build()`, tower at (-8.6,-8.5), crown y 12.4 at l.484-487): the spire crosses the "HANOI"/temperature UI at the default camera. Lower the shaft section list `[5.5, 3.5, 2.2]` slightly (~11 total) or move the tower; keep the 13-unit cap in mind.

### Landmark fidelity
- **Ho Chi Minh Mausoleum** (`mausoleum()`): good colonnade and stepped roofs, but the whole building is one grey with no contrast; real one has a darker grey-red granite podium and a gold star. Fix: give the lower podium tiers `RUST_DARK`/dark granite, add the star `sphere`/low pyramid on the front pediment strip at l.243-244, and a pair of guard-post boxes at the steps.
- **Long Bien Bridge** (`longBien()`): cantilever profile reads well; the deck is a single 1.0 wide slab so the train and road lanes are hidden, and there are no stone arches at the approaches. Add `profile(archHole(...))` arched approach viaduct at both ends of the deck and a visible rail track (two thin `M.steel` beams along the deck).
- **Thap Rua / Turtle Tower** (`turtleTower()`): OK; three tiers, but the real tower is slender with a clear moss-grey tone; scale is small (0.34 wide on screen ≈ 20 px). Nudge to 1.3x for readability. No change in construction needed.
- **Huc Bridge** (`theHucBridge()`): reads as a red arch; the real bridge is a flat-ish curved span; fine. Add a small gate with two roof tiers over `x0 + 0.1` (l.198-200 is a bare lintel).
- **Ngoc Son Temple** (`nguocSon()`): reads as a roofed pavilion; good colour. Missing the real pagoda gate and the pen tower is not part of it (the pen tower is a bare pole at l.460-462, 0.1 wide: reads as a stick). Fix: replace with a stacked brick pillar (tapering `cylinder` segments 4) and a flat brush tip, scale up ~1.5x; add a short stone gate (`Dai Nghien`) on the lake shore at (3.9, 1.0).
- **Van Mieu** (`vanMieu()`): strong, includes Khue Van Cac. No change needed except the entry court lacks the stele-turtle rows; add 6-8 small boxes in the courtyard for stelae at (±0.9, z -0.9..-0.4) if budget allows.
- **Opera House** (`operaHouse()`): good (dome, portico, turrets). Fine.
- **One Pillar Pagoda** (`onePillar()`): good; pillar is 0.11 radius and might be too fat vs the real one; fine.
- **Lotte Center** (l.482-487): glass shaft with a four-sided pyramid crown; the real one has a distinct tapered silhouette with a rounded crown and a rooftop skybridge. Add one setback band (`windows: 'bands'` sections already) and slender ribs; low priority.

### Missing / sparse
- **Motorbike density is low** for Hanoi: 8 lanes × 2-3 movers = 19 movers (38 riders) (`lane()` calls l.554-561). Each mover costs ~2 draws (merged per material pair) but is only 3 materials after merge; adding 10 more movers costs ~500 tris each (≈ 5k tris) and ~0 draws if materials are shared. Raise to ~30 movers and add one lane on the lake road x = 3.3.
- **Street life is thin on the main arteries:** `vendor()` rows (l.507-510) are 0.3 units high and read as dots; add a few cyclos or conical-hat vendors with carrying poles near Hang Dao (the `-5.0` row) at larger scale, and market stall awnings along the low front row.
- **Old Quarter is the same extruded tube house everywhere** (`tubeRow()` x5, l.491-497): there are no overhead wire tangles, no signboards sticking out, and only 4 awning colours. Add small `box` signs on a few facades (`AWNINGS` already exists) and a power-line `beam` swag between rows; one narrow “train street” gap with a short train and café chairs would be the strongest Hanoi cue.
- **Empty areas:** the NE corner (x 0..6, z -2.2..-1, around the lawn at (5.0,-2.6)) and the SW pavement between the lake and the plinth edge have only scattered people; plaza east of the mausoleum (x 3..6.5, z -9.5..-6) is bare. Place a market block (Dong Xuan hall: long low box with arched roof) there.
- **River** has only one sampan hidden under the bridge; there are no boats on the visible side and no sand-bar life.
- **Night look (screenshot):** tube houses, towers and the Opera House glow well, but the lake, lamps and streets are dark; lamps (`lamp()` row at z 7.7) produce no visible pool of light. The bridge is a dark mass; add `lampMaterial` globes along the bridge deck, and a string of lit lanterns across the Huc bridge and the temple roofs (`TEMPLE_RED` is not emissive). Motorbikes have no headlights; add a 0.02 `lampMaterial` box at the front (+z) of each pair to make the swarm readable at night.

### Rodin candidates
- None beyond the motorbike (already baked, `motorbike.shape.ts`). Remaining organic forms (Turtle Tower's turtle, sampan, flame trees) are under ~60 px on screen at default zoom, below the ~120 px threshold. If the motorbike is rebaked, ask Rodin for a stronger colour-block (body/jacket) split, not a new subject.

### Priority
1. Make the motorbikes readable: bigger (`height` 0.26 → ~0.34), apply `BIKE_COLORS` to a bigger part (re-bake or recolour part 0), separate the two riders, add a night headlight; then raise the swarm to ~30 movers (`motorbikePair()`, `lane()`).
2. Fix the Long Bien/river layout: add approach ramps/abutments, show real water on the city side and keep the sampan visible (`longBien()`, l.446-447 river, l.545 sampan).
3. Old Quarter and night identity: signboards, wires, a train street slot and lit lanterns/lamps (`tubeRow()`, `tubeHouse()`, l.491-497; lamp row l.506); also move/shorten the Lotte tower so it stops colliding with the title (l.484-487).
