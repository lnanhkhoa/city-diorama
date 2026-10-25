# Dubai improvements

Source: `src/cities/list/dubai.ts`. Part of the [city improvements](README.md) audit of 2026-10-21.

## Status

- **Budget now:** 30,826 tris, 136 draws (limits 150,000 / 220), measured 2026-10-23 after the kit tree rework.
- **Fixed 2026-10-21:** Walking camel caravan in view; tower off the road; dunes inside the plinth; shorter Burj needle.
- **Fixed 2026-10-21 (second pass):** `burjKhalifa()` rebuilt as 18 thinner 0.5-high levels with a per-level twist, a tapering hex core and a lit `windowMaterial` band on every wing level. `burjAlArab()` sail is now a `floodMat` panel (pale by day, blue-violet at night), with lit atrium bands on the mast, base and restaurant bulb. `dubaiFrame()` is gold `floodMat` with lit inner legs and bridge strip; bottom cross-bar removed. `twistTower()` has a lit band per floor. New `emiratesTower()` twins (triangular plan, pyramidal crown, spire) at (1.9,-8.4) and (3.1,-6.9). New `metroLine()`: elevated viaduct on columns along the road median (z 0.9, deck top y 1.34) with a 3-car shuttle train on `anim.follow`. Camel height 0.72 → 1.0. Dark dune moved to z -6.5 so the twist tower no longer overlaps it.
- **Left open:** Dunes still lack ridge detail; sea and street life are sparse; fountains static; the Palm crescent is still made of overlapping patches; no old-town creek or Dubai Mall.
- **Next:** Animate fountains; yachts and jet-skis on the water; Palm crescent as an arc polygon; Atlantis arch; desert scrub and ridges; Dubai Mall / Souk Al Bahar beside the lake.

## Audit

Original findings, written before the 2026-10-21 fix pass; line numbers refer to the code at that date. Reference: none (compared with real landmarks). Budget at audit time: ~19,700 tris, 106 draws (limits 90k / 220: ~70k tris and ~110 draws of headroom, the most of any city).

### Bugs
- **Camels are almost invisible at the default view** (`build()` L294-295, `camel()`). At (5.2,-5.6) and (4.6,-6.3) they sit directly behind the wedge tower (6.2,-0.9, h3.8) and the twist tower (7.8,-1.5, h5.2). Screenshot crop shows only a red blanket/rump squeezed between the two towers. `ry` 2.2/2.4 also points the head away from the camera (+x,-z). Fix: move the camels to the near slope of the right dune, e.g. around (8.7,-4.6) and (9.1,-5.3) (clear of the tower line of sight) [position unverified], and use `ry` ~0.6-1.0 so the head faces the camera or the road. Walk them on a short `anim.follow` path as a caravan, which also gives the diorama some life.
- **Camels may be partly sunk in the dune** (`camel()` y=0 inside `dome(2.6,…{x:7,z:-7.2,squash:.45})`). Camel 1 at (5.2,-5.6) is ~2.4 units from the dune centre (r=2.6), so it stands on the dune skirt. [unverified: legs look half buried in the crop]. Give them an explicit `y` or move them onto flat sand.
- **Tower sits on the road and cars drive through it**: `glassTower(-9.0, 0.4, 0.8, 0.9, 2.6, …)` (build, ~L304) occupies z -0.05..0.85, x -9.4..-8.6. The road covers z -0.05..1.85 and lane 1 (`lanes[0]`, z=0.5) starts at x=-9.6. Move the tower to the sidewalk (z ≈ -1.0, like the other north-side towers) or shorten the lane start to x≈-8.4.
- **Dunes overhang the plinth**: `dome(1.6,…{x:5.4,z:-8.4})` reaches z=-10.0 (limit -9.8); `dome(1.9,…{x:8.0,z:-4.9})` reaches x=9.9. Shift them 0.2 inward.
- **Dune contrast**: dunes `DUNE 0xe3bb7c` / `DUNE_DARK` on `createBase top: SAND 0xe9cf9b` read as a flat blob in both day and night shots (the two domes merge into one shape). Distinct ridge lines or a darker leeward colour would help (see Missing / sparse).
- Dhows verified OK: orientation is correct. Crops of both boats in a loop show the pointed bow leading on the -z leg (ry=π) and on the +z leg (ry=0), with the square stern/deckhouse trailing. `follow()` heading `atan2(dx,dz)` matches the model's +z bow. Hull sits at y=0 under the sea top (0.05), so the keel is 0.05 below the water, acceptable. No bug.
- Spire of `burjKhalifa()` (tip y≈13.3) reaches the weather text in the page header at the default framing (tip touches "TYPICAL · CLEAR"). Guideline max is ~13. Lower the needle section (`cylinder(0.02,0.1,1.8…)` L51) by ~0.4.

### Landmark fidelity
- **Burj Khalifa** (`burjKhalifa()`, L29-53): reads as a stack of offset slabs, not the smooth three-wing spiral. Wings are plain boxes whose length shrinks with `k`; levels are 0.8-1.4 high so steps are coarse; a wing is "dropped" at k=7/9/10 so the profile has big blocks. Fix: use 18-20 thinner levels (`ys` spacing ~0.5), rotate each wing by a small `ry` increment per level to hint the spiral, give the wings a tapered `cylinder(..., {segments:4})`/`prism` cross-section, and make the hex core visibly taller than the wings. At night only ~3 small windows light up (`windowMaterial` boxes at odd k): add a window band per level (`w*0.8`) so the tower glows like the real one.
- **Burj Al Arab** (`burjAlArab()`, L56-106): silhouette (convex sail, X-braced teal mast, helipad, island, causeway) is good. Gaps: the sail is a smooth white slab with no translucent fabric panel/ribs (real: Teflon-glass screen with the lit blue-purple colour at night); no night lighting at all (sail, mast are unlit in the night shot). Add a `windowMaterial`/emissive sail panel (`profile(sailPts, …, windowMaterial)` slightly inset) and lit atrium bands so it glows. It also blocks part of the road and the Marina towers from the default camera; consider rotating the whole hotel group ~15° (`hotel ry`) so the sail faces the camera and the mast stops covering the crosswalk.
- **Museum of the Future** (`museumOfTheFuture()`, L118-140): ring plus eye plus green mound plus calligraphy band reads correctly and lights at night. Gap: the band is a single flat `windowMaterial` so it is uniformly lit; ring edges are a plain extrusion. Optionally vary slit lengths and add a thin base plinth so it does not sit directly on the dome. Scale is ~3x exaggerated vs the Burj (3.2 vs 12.4 tall, real ≈ 1:10); fine as a hero.
- **Dubai Frame** (`dubaiFrame()`, L142-152): proportions are close (2.8 × 4.1 vs real 93 × 150 m, slightly squat). Missing: the top glass-floor bridge span depth and the two leg tops being the same gold; at night it is completely dark. Add a `windowMaterial` strip along the inner edge or the inner blue panels so it lights up; remove the bottom bar (box at y=0) or keep it as a plinth only (real frame has no cross-bar at the base).
- **Twist tower** (`twistTower()`, L155-163): good Cayan reference. It is unlit at night (uses `GLASS_BLUE`/`SILVER`); add a `windowMaterial` edge band per floor for night glow.
- **Palm Jumeirah** (`palmJumeirah()`, L217-253): layout (trunk, 16 fronds, crescent, Atlantis) is right. Issues: fronds are flat sand rectangles with identical length profile, fronds have no taper/rounded tip, and the crescent is made of 30 overlapping `patch` rectangles (rough edge seen in screenshot). Use `area()` polygons or `tube`-like arc strip for the crescent, give each frond a small taper, and add a few small dark-roof villa variants. The Atlantis block (pink boxes at z=3.2) is tiny and blocky: add the two-tower arch with a bridge between towers and a small lit sign.
- **Generic skyline** (`glassTower()` ×8, L299-308): all share the same banded-box look; only the crown changes. Signature Dubai silhouettes are missing (see below).

### Missing / sparse
- **Missing landmarks**: Emirates Towers (twin triangular-roofed towers on Sheikh Zayed Road); Dubai Metro elevated track with a train along the road (`profile`/`box` viaduct plus an animated `follow` train); Jumeirah Beach / Marina twin high-rises (Princess Tower style); Dubai Mall / Souk Al Bahar next to the Burj lake; Al Fahidi / Creek wind-tower old town with the real abra (the two `abra()` are in open sea, not on a creek).
- **Water is empty**: right and front sea (x>8.4, and between the Palm and the Burj Al Arab, z 5-9) has only 3 dhows and 2 abra. Add yachts, a jet-ski, a luxury yacht, and a few buoys; make the shore have a small foam/white-sand edge (the white strip at z=3.45 is the only edge).
- **Street life is thin**: only 10 cars (5 per lane, same speed `1.5`), no bus, no people on motion, ~10 static `person()`s. Add a `bus`, vary lane speeds, add a few walkers on the Burj lake promenade with `anim.follow`, add a helicopter/plane or Palm monorail.
- **Fountains are static** (`cone` ×5 in `build()` L279-281). Animate them with `anim.bob` or a scaling update so the Burj fountain show feels alive; add lit water at night.
- **Desert is bare**: dunes are 3 domes with 1 palm; add ripple ridges (thin `profile` crests), a few low scrub/rocks, a 4x4 or a Bedouin tent to explain the area.
- **Night look**: glass towers glow well and the museum band lights, but Burj Khalifa (3 windows), Burj Al Arab, Dubai Frame, twist tower, Palm, lake and lamps are dark. Dubai at night is the signature: the Burj, BAA and Frame should be the brightest things.
- **Repetition/skyline density**: back-left plaza behind the Burj lake has only a lawn (`patch` at (-8.3,-8.2)) and the area between the Frame and the dunes (x 1.5..4.5, z -9..-6) is empty. Both are free spots for Emirates Towers or the Dubai Mall.

### Rodin candidates
- None new. Camel and dhow are already baked (`CAMEL`, `DHOW`). Orientation/scale check: camel head is toward +z as documented (part 1 z-profile peaks at +z, blanket centred at z≈-0.15), height 0.9 is ~3× a person and larger than a car; consider 0.65-0.75 [unverified preference]. Dhows are 1.1/1.0/0.88 units long (about 20-30 px at default zoom, below the 120 px Rodin threshold) and read as small brown flecks. A second dhow size at ~1.6 would help, and the dhow hull should bob (wrap the dhow in an inner `group` and `anim.bob` it; do not bob the same object `follow` drives or the two will fight over `position.y`).
- Burj Khalifa, Burj Al Arab, Museum of the Future, Frame, Palm: architecture/lattice, keep procedural.

### Priority
1. Fix camel visibility and placement (move to the near slope of the right dune, face the camera, add a short caravan walk, check dune burial) and fix the tower on the road at (-9.0,0.4), the two plinth overhangs of dunes 2 and 3 (cheap, clearly visible bugs).
2. Night look: light up Burj Khalifa (window band per level), Burj Al Arab sail/atrium, Dubai Frame and twist tower with `windowMaterial`; animate fountains. Big visual win for almost no triangles.
3. Replace generic skyline filler with signature Dubai: Emirates Towers, an elevated Metro track with a moving train along Sheikh Zayed Road, and refine `burjKhalifa()` into ~20 thinner spiral levels. Plenty of tri/draw headroom.

### People pass (2026-10-21)

- Pedestrians rebuilt with the new `person()`: feet at `y: 0.04` on the plaza and sidewalk paving (previously y 0, half-buried), palette of white kandura, black abaya and tourist cream / light blue / pastel pink / mint.
- Sidewalk strip north of Sheikh Zayed Road (5 people) keeps clear of the date-palm trunks; Burj plaza crowd (7) keeps off the Burj base, the lawn corner and the promenade loop; the old crowd that stood inside the Burj base is gone.
- New: 5 walkers circle the lake's north edge on a closed `anim.follow` loop (z -4.35..-4.1, plaza paving, clear of the fountain lake and the Burj base).
- Budget before / after: 22,050 tris, 117 draws -> 23,506 tris, 136 draws.
- Observation: zoom is clamped, so feet were checked from a top-down orbit only (figures sit on the pale plaza, none on water, lake or tower base); close-range foot contact was not visible at that scale.
