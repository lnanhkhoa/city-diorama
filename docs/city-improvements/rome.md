# Rome improvements

Source: `src/cities/list/rome.ts`. Part of the [city improvements](README.md) audit of 2026-10-21.

## Status

- **Budget now:** 60,028 tris, 177 draws (limits 200,000 / 300), measured 2026-10-23 after the kit tree rework.
- **Fixed 2026-10-21:** River map bugs, new bridge at x=-3.2, continuous kerbs, Trevi colours.
- **Fixed 2026-10-21, second pass:** Trevi facade: four statue niches in the wings (`trevi()`, x ±1.18/±1.5), attic block with three dark panels and a gold coat of arms under a raised pediment, lit statues. St Peter's piazza: the hidden straight `colonnade()` is gone; `colonnadeArm()` builds two elliptical arms (centre 6.9, -6.4; 2.7 x 2.8) from the facade ends round an oval with paving, obelisk ring and two fountains; statue balustrade on the facade attic (13 statues); piazza patch widened. Night lighting through `floodMat`/`lampMaterial`: Colosseum arch backing, St Peter's stone and dome, lantern, drum windows, arms, Trevi facade, rock and statues. Bridge at x=-3.2 shortened (len 2.4, z -1.1) and the east-west street now runs to x=-2.75 so the deck foot lands on the street instead of its corner.
- **Left open:** Trevi basin water does not glow; the facade wings have only the stock `building` grid windows (they do light at night); arms are two column rows, not Bernini's four; Colosseum brick and the Curia/forum notes in the Audit are untouched.
- **Next:** Colosseum brick on the cut ends and darker travertine; Pantheon brick drum; parapets and statues on the bridges; cypress along the Colosseum road.

## Audit

Original findings, written before the 2026-10-21 fix pass; line numbers refer to the code at that date. Reference: assets/rome.jpeg. Budget at audit time: ~48300 tris, 94 draws (limits 90k/220: ~40k tris and ~125 draws headroom, so heavy ideas fit).

Checked: day, night and 4x-zoom screenshots, console errors empty.

### Bugs
- **House on the river source**: `blocks` entry `[-9.0, -2.5, 1.2, 1.2, 1.5]` (x -9.6..-8.4, z -3.1..-1.9) overlaps the river mouth. The river is `R[0]=[-9.8,-1.6]`, `RW=1.5`, so it spans z -2.35..-0.85. In the zoom the green-awning shop stands in the water at the back-left. Fix: shift the house to z≈-3.4 or start the river at x≈-8.4; also check `[-9.0,-4.4]`.
- **Tree in the river**: the `pine(-4.0, -0.7, 0.9)` entry in the pine list in `build()`. The river centre at x=-4 is z≈-1.2, so the pine stands in the water; its shadow reads as a blue blob. Move it to e.g. (-4.0, 0.9)... avoid the street (z 0.1±0.5) or drop it.
- **Street covers the river**: `road(-3.2, 0.1, -3.2, -9.6, 0.8, st)` (PAVE, `lines:false`) runs straight through the river bend around (-3.2, -1.0). The grey road slab sits on top of the water and cuts it. The same grey patch shows at the bend in the crop. Fix: start the road at z≈0.1 and end it at the south bank, then add a third `bridge()` there (rotated, since `bridge` is X-axis only, add a `ry` param). Or clip the road at the bank.
- **River kerbs are broken at the bends**: the kerb box length is `len - 0.5` (`R` loop in `build()`), so there are open gaps at every joint (visible as short stubs near the Colosseum and near the first bridge), and the stub corners poke into the water. Fix: use full `len`, rotate the end segments, or add a corner cube at each bend.
- **Trevi hidden statue**: `trevi()` lines 318-320 (niche slab, `cylinder`+`sphere` "Oceanus" at z 0.7) are now fully behind the Rodin mass (z 0.77..2.23, height 1.4): dead geometry, delete it (the dark niche box at line 318 is still useful as the arch backdrop).
- **Colonnade at z=-3.5 is wasted**: `colonnade(6.4, -3.5, 5.4)` is hidden behind the houses at `[6.3,-1.9,…,2.0]` / `[7.9,-1.8,…]` (camera is +x,+z). Only a low beige stub shows near the right houses. See "Missing / sparse" for what to do with it.
- Minor: Trevi shape bottom edge (z 0.77) is 0.05 inside the front curb box at z 0.82 (`box(3.4,0.14,0.12,…,{z:0.82})`); no visible artifact, but nudge `z: 1.5 → 1.6` for clean separation.

### Landmark fidelity
- **Trevi Fountain** (`trevi()`; Rodin shape `treviSculptures`, 2 parts, 2500 tris, `height: 1.4`): fit in the basin is OK. It is inside the basin (width 2.06 vs basin 3.4, no overhang), bottom-anchored on the water patch, no z-fight. Gaps: (a) tint contrast, rock part `TRAV` (0xd3c09c) and statue part `COLUMN` (0xe8dfcc) are nearly the same cream as the facade `TRAV_L`, so at normal zoom the mass looks like a pale lump against the pale wall. In the poster the rock is darker/warmer and the statues white. Use a darker rock material e.g. `mat(0xa8957a)` for part 0 and `M.marble` for part 1. (b) The mass hugs the facade and the front 1 unit of the basin is empty water; scale `height` to ~1.7 and move to `z≈1.7`, or add 3-4 small jets/rim rocks. (c) The mass top (1.4) covers the lower half of the arch; the arch is still readable, but consider `height: 1.25`.
- **Trevi facade** (`trevi()`): flat box with a single arch; the poster shows a palace with four giant columns/statue niches, a big attic with a coat of arms and flanking wings with window rows. Fix: add two side niches (`profile` with `archAt` holes, 0.35 wide) between the column pairs, a statue-less attic block with 3 small dark panels at y≈2.3, and give the wings `windows: 'grid'` that glow at night (they use `building`, so this is mostly fine).
- **St Peter's facade and piazza** (`stPeters()`, `colonnade()`, `build()`): the facade is a flat 2.1-high box with 8 columns and a small pediment. The poster shows a very wide facade with a balustrade of statues and a long nave behind the dome. The piazza has only one straight colonnade visible, the poster has curved arms enclosing an oval. Fix: replace the straight colonnades with two quarter-ellipse arms using `prism(ellipse…, holes)` or arcs of `cylinder` columns (row over `ellipse()` points), add a balustrade row of tiny `box` statues on the facade top (cheap, ~16 boxes).
- **Colosseum** (`colosseum()`): good, reads as broken near wall with hypogeum; the poster has darker brown/grey stone with exposed brick on the broken face. Fix: use a slightly darker travertine (0xc9b48c) for the outer ring and `mat(0xb7714b)` brick on the cut-end slabs (the two `tiers < 3` zones near `near`).
- **Pantheon** (`pantheon()`): rotunda + stepped dome + oculus read well. Poster has a pronounced brick-red drum and a pediment with dark inscription band. Fix: colour `wall` toward 0xb98a64 brick; add dark frieze band `box` on the `por` architrave. The portico roof uses `LEAD` for two overlapping gables (line 177 and 185): the inner one is visible as a double-ridge in the zoom; verify the 1.4-deep and 1.2-deep profiles do not z-fight on the shared slope [unverified].
- **Roman Forum** (`forum()`): temples are small at normal zoom (about 40-60px) and read as columns only; acceptable. The "Curia" is a plain brick box with no features (`box(1.1,1.0,1.0,brick)` at line 387); it hides the Colosseum's near-left side. Add pilasters/arched door or move 0.5 left.
- **Bridges** (`bridge()`): plain slabs with a shallow arch, no parapet statues or cutwater. Poster bridges are narrow. Cheap fix: two parapet rails with posts, and a Ponte Sant'Angelo-like statue row on the one nearest St Peter's (the river there is crossed by none: no bridge near St Peter's).

### Missing / sparse
- No bridge between the Pantheon/St Peter's side and the east side along the upper river (street at x=-3.2 just ends in the river bend, see Bugs).
- Piazza di San Pietro is empty (12 umbrellas, two tiny `fountain()` 0.3 radius): add a bigger central obelisk base ring, and a visible oval of paving (`area(ellipse)` in a slightly darker `PLAZA`).
- Trevi piazza (x 4.3..9, z -0.5..3) is sealed by houses on all sides: the crowd (`scatter` at (6.6,3.5)) is mostly invisible. Open a gap at the 9.0,1.7 house or add a small steps/people cluster on the basin rim.
- Pine/tree variety is low: 10 identical pines plus one tree row; the poster has green terraces around the Forum. Add 2-3 cypress (`tree({kind:'cone'})`) along the Colosseum road.
- Street life: 5 cars on two lines, 3 boats; no scooters/people crossing at zebra crossings, no bus, no tram. Night: Trevi, Colosseum arches, Pantheon porch and St Peter's windows (only the facade windows glow) stay dark; the poster shows warm uplights. Add `lampMaterial` strips: a lit arch row in the Colosseum (`archAt` back face), a glowing Trevi basin rim, and lamps in the piazzas (only two `lamp` rows exist, both on the plinth edge streets).
- Back-left strip houses (`blocks`, first group) repeat the same house template with the same hip roof; vary with a courtyard or a church bell-tower silhouette (`house()` `kind > 0.9` is rarely hit).

### Rodin candidates
- **Trevi sculptures**: already baked, see fit notes above.
- None other: remaining landmarks are architecture/columns (stay procedural). People/boats are < ~30px. A Colosseum ruin or Forum temple stays procedural [unverified: Rodin would not give crisp arcades].

### Priority
1. Fix map bugs in one pass: house on river mouth `[-9.0,-2.5…]`, pine at (-4.0,-0.7), road x=-3.2 over water + add the missing bridge, river kerb gaps (all trivial edits in `build()`).
2. Trevi polish: darker rock / white statue materials, delete dead Oceanus geometry (lines 318-320), pull the sculpture forward a little, enrich the facade with niches/attic.
3. St Peter's piazza: curved colonnade arms (or reposition the hidden z=-3.5 colonnade as the second arm) plus statue balustrade, and night lighting for the landmarks.
