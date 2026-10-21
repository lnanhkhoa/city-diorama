# Kuala Lumpur improvements

Source: `src/cities/list/kuala-lumpur.ts`. Part of the [city improvements](README.md) audit of 2026-10-21.

## Status

- **Budget now:** 53,896 tris, 139 draws (limits 90,000 / 220).
- **Fixed 2026-10-21:** `archBridge()`, road/bank overlaps, lamps and shophouses off the lanes, monorail end.
- **Fixed 2026-10-21, second pass:** `masjidJamek()` added on a pavement forecourt at (-0.95,-2.2) beside the confluence (2 white onion domes, red-banded arcade, 2 banded minarets). Suria KLCC podium replaces the thin box at the tower bases (4.0x2.2, glass-domed atrium, fountain pool). Night glow: Samad arches (`archWin`), shophouse and old-block openings, a third of the Merdeka facets now use `windowMaterial`. KL Tower: red bands around the cabin ring, lit upper cabin band, taller red tip, three splayed legs. Murugan moved to the cave foot (7.0,-5.7), statue and cave mouth now `floodMat` (floodlit at night), stairs rebuilt to climb 10 steps to a lit cave mouth with portico and rails. East tree row at x=9.3 moved to z 0..2.2, clear of the shophouses. Forecourt people scatter moved off the podium.
- **Left open:** the arch bridges stay shallow, and both boats (main leg, east leg) still pass through them because open paths loop and the arch only peaks at 0.11. The Batu cliff and the Murugan statue remain the procedural placeholders until the Rodin assets are baked. Masjid Negara (blue folded roof) and the empty back-right/front-left quarters are untouched.
- **Next:** bake and swap in the Rodin Batu cliff and Murugan statue (keep stairs and cave mouth procedural, re-fit them to the baked cliff); shorten the boat paths to stop short of the bridges or raise the arch; Masjid Negara; park paths/pond around the KL Tower.

## Audit

Original findings, written before the 2026-10-21 fix pass; line numbers refer to the code at that date. Reference: assets/kuala-lumpur.jpeg (+ assets/kuala-lumpur-2.jpeg). Budget at audit time: ~51000 tris, 136 draws (headroom ~39k tris / ~84 draws).

Observed in day + night screenshots at 1400x1100; no console errors.

### Bugs
- **Bridges render as a giant white hump, not a bridge** (`archBridge()`, lines 308-314; used at 353-354). The deck profile is only 0.24 high but `archHole(0, len*0.8, 0.02, 12)` is a 2.4-wide semicircle reaching y≈1.22, so the hole pokes far outside the outline and the extrusion triangulates into a ~1.2-high white shell over the river (visible at the river crossing next to the Samad block and next to the Murugan statue). Fix: give the profile real arch height (outline up to ~0.5-0.6, hole `springY` ~0.05 with `width` such that spring+r < outline top) or build the arch as shallow segmental points; keep the deck box at the top.
- **Lamps stand in the traffic lane** (lines 404-405). `row(-0.9, 1.0, -0.9, 9.4, …)` vs the lane at x=-1.0 (line 413): cars drive through the lamp poles. Same for the z=2.2 lamp row vs the lane at z=2.35 (lines 404, 414). Move lamps to the kerb (x≈-0.75 / z≈2.8) or shift the lanes. [lamp/car clip not zoomed; derived from coordinates]
- **Coplanar strips on the east road** (`road(2.0, 6.0, 9.7, 6.0, 1.1)` line 356 vs `bank(2.18, -1.6, 2.18, 9.95)` line 346): both tops are y=0.05 and the 0.14-wide bank crosses the road at z≈6 (asphalt vs BANK z-fight stripe). Also `road(-2.2, 6.0, 0.4, 6.0, 1.1)` (355) ends at x=0.4 and overlaps the main water (x 0.3-2.1, top 0.05) by 0.1 (hidden under the bridge deck today, but it will show once the bridge is fixed). Fix: stop roads at the bank (x 2.25 / x 0.15) or lift roads to y 0.06.
- **Near-coplanar ground blocks** (lines 325 and 327): grass top 0.05 vs grassDark top 0.045 overlap by 0.35 in x (x≈-5.8…-5.45) - 5 mm apart, will flicker at distance. Give one of them 0.055. `block(3.9,-7,4,5.2)` and `block(5.6,-4.6,2.6,2.2)` (331, 335) overlap at identical h=0.04 and same material (invisible but wasteful). [unverified flicker]
- **Shophouse backs poke into the z=6 road** (`shophouse(4.3+i*1.05, 7.2, i)` line 383): footprint back wall at z=6.3, road lane at z=6.45 (line 420) - eastbound car clips the back wall. Move row to z≈7.5 or lane to 6.0. [derived from coordinates]
- **Monorail dead-ends in mid-air at x=9.0** (path line 388, the pillars loop in `monorail()` line 291); the viaduct just stops 0.8 from the plinth edge with the train following a back-and-forth path. Extend to x=9.7 with an end pylon, or loop it behind the Batu rock.
- **Statue is detached from the cave** (`murugan({x:6.2,z:-5.0})` line 373 vs `batuCaves(8.0,-7.4)`): statue sits ~3.5 units away at Merdeka's foot, reads as part of the Merdeka plaza. Poster has it right at the cave foot beside the stairs.

### Landmark fidelity
- **Batu Caves + Murugan** (`batuCaves()`, `murugan()`): rock is three stacked flat-shaded frustums (plain tan cylinders), statue is a column of cylinders ~4.6 tall - almost as tall as the 5.6-tall cliff (real ratio 42 m vs ~100 m). Cave mouth is a dark box at ground level, rainbow stairs climb only 1.8 up the *front* of the cliff and lead nowhere; poster has a long stairway to a cave high on a jungle-covered cliff with dense trees. Do: scale statue to ~3.0, put it at (≈7.1,-5.9) in front-left of the cliff, run the 14+ steps up the cliff face to a cave arch near y≈3.5, add a temple-front portico, add 3-4 more trees/bushes on cliff ledges (see Rodin).
- **Petronas Towers** (`petronas()`): good silhouette, star plan, bridge and spires; but tiers are 7 stepped prisms with hard ledges and the window bands are 0.17 prisms at R*1.012 (z-fight risk at distance [unverified]). Poster: tower base wrapped by the Suria KLCC podium with a glass ring/dome and the shaft capped with a pointed pinnacle ~1.3x. Do: add the podium (`building` 5x3 low, glass roof, central round pavilion + fountain ring) at the tower base (the current 4.2x1.5x0.65 box between towers is nearly invisible); make the skybridge (`skybridge()` y=5.5) more dominant (higher, ~0.2 thicker) - it reads as a thin line at the default zoom.
- **KL Tower** (`klTower()`): thin shaft, white pod and cream band; poster 2 shows the pod banded red/white with a lit observation cabin and a lattice mast. Do: add a red band `lathe` ring, a darker window band at the cabin (use `windowMaterial`), 3 radial support legs at the base. The red tip at line 86 is a tiny stub.
- **Merdeka 118** (`merdeka()`): twisted, faceted - matches poster well; height ~12.8 vs Petronas ~11.5 (real ratio 1.5). Cap-limited; fine. Fix night: glass is `BLUE_GLASS_*` (no emissive) so it is a dark silhouette at night; add a few `windowMaterial` triangle bands or swap alternate facets to `windowMaterial`.
- **Sultan Abdul Samad** (`sultanAbdulSamad()`): good (clock tower, copper domes, arches). Gaps: front arcade is flat dark arch boxes, no colonnaded loggia, the hip roof (`roofH 0.5`) is a heavy terracotta pyramid; poster shows a long arched loggia in front and a second wing. Night: no lit windows (windows 'none', arches use `M.dark`); swap `archWin` recess material to `windowMaterial` for a subset so the building glows at night.
- **Old blocks** (`oldBlock()`, lines 378-379): plain boxes with dark rectangles and giant hip pyramid roofs - the most generic buildings in the scene; the poster has an arcaded colonial block with a clear colonnade. Do: reuse the shophouse arch loop and shallow the roof (`roofH` 0.35).
- **Small gable house at (3.7,-4.6)** (line 385): generic `building` straddling the pavement/asphalt edge (block ends z=-4.4) so half hangs over road. Turn into a recognisable item (Masjid Jamek pavilion / pump house) or remove.
- **Office towers** (`officeTower()`): repeating `bands` + shop; the terracotta one (-8.1,6.6) matches poster. OK.

### Missing / sparse
- Poster 2 landmarks absent: **Masjid Jamek** (white domes + minarets at the confluence, bottom-left; the confluence geometry already exists at (1.2,-3.5)/(0.3..9.9,-2.6)), **Masjid Negara** (blue folded-plate roof + tall minaret) and **Suria KLCC podium/park fountain**. Masjid Jamek on the (−2.2…0.2, -3.6…-1.7) corner near the confluence is the best fit: 2 `onion`-style domes (reuse `onion()`), 2 slim minarets (`cylinder` + `cone`), arcade. ~2k tris.
- Back-right quarter (x 3-9, z -10…-5) outside of Merdeka/Batu and the whole front-left (x -6…-1, z 6…9.7) are low-detail: big empty asphalt and a bare lawn.
- KL Tower park (`block(-3.1,-6,5.4,7.2)` grassDark, line 327) is a flat lawn with ~9 scattered trees: no paths, pond, or tree density like poster 2's canopy. Add a path `road()`, a small `waterMat` pond, a footbridge, 10-15 more trees (low segment count).
- Street life: only 11 cars on 5 lanes (417-420), all concentrated west; no traffic east/south, no monorail station, no pedestrians around Merdeka/Batu/Samad (people scatters at 406-408 only). Add 3-4 cars on x≈5…9,z≈5.55 and z≈9; a boat in the east leg already exists (362) but only one; add 1-2 pedestrians scatters at the Batu foot and a station box on the monorail (line 388).
- Night: Petronas, towers and KL Tower pod glow well; but shophouses show no lit shopfront (shop arches use `M.dark` lines 210-216), Merdeka/Samad/Batu are black. Lamps (`lamp`) are tiny; no uplight on Petronas.

### Rodin candidates
- **Batu Caves cliff** (`batuCaves()` rock): ~250 px tall on screen, genuinely organic limestone with vegetation → `shape()` baked as a jungle cliff with palette parts (rock, moss, cave mouth); keep the rainbow stairs procedural.
- **Murugan statue** (`murugan()`): ~110 px tall, organic figure with crown, spear and drapery; the current boxy gold column is the weakest piece vs the poster. Border-line size but worthwhile (largest, most photographed icon besides Petronas).
- Not Rodin: Petronas, KL Tower, Merdeka, Samad, bridges, monorail (architecture/lattice stays procedural).

### Priority
1. Fix `archBridge()` (giant white hump over the river) and the coplanar road/bank overlaps (356, 346): quick, visible, no budget.
2. Rebuild the Batu Caves + Murugan ensemble (Rodin cliff + statue, move statue to cave foot, stairs climbing to a cave mouth): largest fidelity gap vs both posters.
3. Add Masjid Jamek (at the existing confluence) and the Suria KLCC podium at the Petronas base, plus night-glow fixes (Merdeka/Samad/shop windows → `windowMaterial`): fills the missing landmarks of poster 2 within the ~39k tris / ~84 draw headroom.
