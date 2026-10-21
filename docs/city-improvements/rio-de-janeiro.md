# Rio de Janeiro improvements

Source: `src/cities/list/rio-de-janeiro.ts`. Part of the [city improvements](README.md) audit of 2026-10-21.

## Status

- **Budget now:** 30,428 tris, 152 draws (limits 90,000 / 220).
- **Fixed 2026-10-21:** Visible bay with boats; cable car clears the rock; pitch lines. Night lighting: Christ floodlit (`floodMat`), lit favela windows, Maracanã floodlights and lit pitch, lit cable-car cabins and stations, floodlight masts on the beach.
- **Left open by the fix:** the Sugarloaf is smaller (height 4.4) and sits in the back-right corner. The boat at (3.8, -5.8) is close to the rock.
- **In progress:** Corcovado via Rodin. The manifest entry `corcovado` is in `scripts/rodin/assets.ts` and `bun run rodin brief corcovado` writes its Gemini prompt; it needs the reference image, then the Rodin GLB.
- **Next:** after the Corcovado bake, a tiered pedestal and viewing platform for Christ; then the missing items below (favela strip on the right edge, Copacabana Palace, street life).

## Audit

Original findings, written before the 2026-10-21 fix pass; line numbers refer to the code at that date. Reference: assets/rio-de-janeiro.jpeg. Budget at audit time: 29576 tris, 152 draws (headroom ~60k tris, ~68 draws).

Checked: day + night screenshots, crops of Sugarloaf/cable car and Christ, and a script that decodes `sugarloaf.shape.ts` into world space (centre (6.7,-5.5), ry=π, height 5.6, y0 0.04). No console errors. Baked terrain bbox is x 3.60..9.78, z -9.75..-1.23 (inside the plinth margin) but only vertices were sampled, so terrain heights below are approximate (±0.3).

### Bugs
- **Boats buried under Sugarloaf** (`build()` boats list, lines ~310-316): terrain top at the boat positions is (4.6,-4.4) 1.25, (6.0,-8.8) 1.10, (9.0,-9.0) 0.49, and (8.6,-3.0) 0.87. The boat sits at y 0.07, so these four are inside the forest skirt (the two back ones are also hidden behind the massif from the camera). Only one boat is visible on the right (near the plinth edge, partly clipped by the skirt). Fix: drop or move the buried ones onto open water, e.g. the strip by the plinth edge at x 9.3-9.7, z -2..-3.5 (the only visible bay water), and add a couple of boats on the Atlantic side instead.
- **Bay water is almost entirely covered**: the `area([[3.4,-9.8],...])` bay polygon (line 217) lies under the Sugarloaf footprint (x 3.6-9.8, z -9.8..-1.2). Only a thin sliver at the right edge (x>8.5, z>-3) is seen. It is wasted geometry and kills the poster's key read, a bay between Corcovado and Sugarloaf. Fix: shrink the shape (`height`/scale) or move `sugarloaf({x,z})` back-right, or reshape the water to the visible strip and add open water between the favela hill and Sugarloaf.
- **Cable car hugs the rock**: `cableCar()` / `gondola()` hang the cabins 0.32 below the line, but the line is laid on the slope (first span lowest clearance ~0.26 at the base, second span ~0 near the summit). In the crop the cabins at the lower span visibly sink into the granite and the rope runs along the surface. The Urca station box (`box(0.5,0.3,0.5)` at (6.0, 3.6, -3.6)) is a floating-looking box on the rock face (terrain ≈3.0 there) [unverified exact gap]. Fix: raise the line ends by ~0.4-0.5 and add 1-2 small pylons (`beam`/`box`) so the span reads as a real cable, or lift the gondola hang point so cabins clear the surface.
- **Christ orientation**: arms span x, the figure faces roughly toward the camera (+z), face and chest are visible in the crop, so it passes. No fix needed.
- **Coplanar pitch lines in the stadium** (`maracana()` lines 145-146): `patch(0.05,1.7,white,{y:0.04,h:0.01})` and `patch(1.0,0.7,grassDark,{y:0.04,h:0.01})` share the same y/h, so the centre line and centre circle z-fight. Mostly hidden by the stands [unverified visually]. Fix: raise the line to y 0.05.
- **Favela roof caps** (`favelaHill()` line 125): random overlapping houses on adjacent levels can have equal-height roof slabs [unverified].

### Landmark fidelity
- **Corcovado** (`corcovado()` lines 52-75): now the weak link beside the Rodin Sugarloaf. A smooth lathe cone plus 4 rectangular boxes reads as pipes/organ pillars, not as a cliff face, and it is stylistically unlike the crumpled baked Sugarloaf. The poster mountain is a rounded rocky dome with a dark granite face and dense forest. Fix: Rodin (see below), or at minimum replace the buttress boxes with a faceted `prism`/`profile` cliff and add forest patches climbing the granite.
- **Christ the Redeemer** (`christ()`, `shape(CHRIST)` 2.3 tall): reads clearly from the base screenshot (~35px wide, arms and head visible). The pedestal is a blunt white block on a flat disc. Add a tiered pedestal/terrace ring (`box`/`cylinder`) and a small viewing platform to match the poster.
- **Sugarloaf** (`sugarloaf()`): good silhouette, but the granite is flat grey with faint facets and the forest skirt is noisy crumpled facets; poster rock is darker brown-grey with vegetation streaks. Cheap tweak: darker `GRANITE`, a second granite tone part, `smooth` on the forest part. The Urca "shoulder" is not distinguishable from the skirt.
- **Maracanã** (`maracana()`): reads as a white ring with a blue band; poster has a deep tiered bowl, visible green pitch and a roof canopy with a rim ring. Add inner seating rake colour bands and a visible pitch (lower the stands wall facing the camera or raise the pitch), and a floodlit look at night.
- **Selarón steps** (`selaron()`): fine, small. Could add mosaic chips; low value.

### Missing / sparse
- The left-rear forest between Corcovado and the favela has no road or bridge; the poster has the central road running up into the hills between them (`road(-1,1.6,-1,-3,...)` stops at z -3).
- Favela: only one cone hill; poster has favela cascading along the right-hand plinth edge as well. Add a strip of coloured boxes along x 8.5-9.7, z 1..5 (`favelaHill`-style rows).
- Apartments: only 7 uniform pastel blocks along the avenue plus 5 loose ones; no taller hotel tower (Copacabana Palace) and no distinct skyline at the avenue ends.
- The front-right corner is an empty grass field (pitch, a few palms, two houses); poster has dense blocks there.
- Street life: cars on the avenue and cross street, bobbing boats, 4 cabins. Missing: moving beachgoers/volleyball, a tram (bonde) or bus on the cross street, flying helicopter near Christ.
- Night (screenshot): building windows lit, avenue lamps present, but Christ is unlit (poster/reality shows a floodlit statue), favela, stadium and cable-car cabins have no emissive lights, and the beach is dark. Use `windowMaterial`/`lampMaterial` for favela windows, stadium ring and a statue spotlight.

### Rodin candidates
- **Corcovado massif** (`corcovado()`, ~8.6 tall, ~350px on screen): yes. Bake a forested-rock mountain with the same pipeline as Sugarloaf (parts forest + granite), then keep `christ()` on top at y ≈ summit. Removes the style mismatch.
- **Favela hill terrain**: optional; the coloured boxes should stay procedural, only the green hill shell is organic (~200px). Low priority.
- Boats, palms, people: too small (<60px); keep procedural.

### Priority
1. Fix the buried boats and the mostly-covered bay (`boats` list and `sugarloaf({x,z})`/bay `area`): make a visible stretch of water between the favela hill and Sugarloaf, as in the poster.
2. Lift the cable car off the rock (raise endpoints, add pylons, check cabin hang) so gondolas stop clipping into the baked terrain.
3. Replace `corcovado()` with a Rodin-baked massif to match the new Sugarloaf, then add night lighting (Christ spotlight, favela/stadium windows).
