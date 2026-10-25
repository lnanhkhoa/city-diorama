# Paris improvements

Source: `src/cities/list/paris.ts`. Part of the [city improvements](README.md) audit of 2026-10-21.

## Status

- **Budget now:** 64,890 tris, 159 draws (limits 150,000 / 220), measured 2026-10-23 after the kit tree rework. Before the people pass: 52,242 / 109.

Reference: assets/paris.jpeg.

## Done (2026-10-21)
- The Champ de Mars lawn z-fought with the pavement under it; it is now raised 0.01.
- Louvre: a ground-floor arcade along the three courtyard faces, and a square dome with a lantern on the Pavillon de l'Horloge.
- Sacré-Cœur: a three-arch portico over a dark loggia, 12 drum windows, a dome cornice, finials, and a terrace balustrade.
- Wet ground (`WET_COBBLE`, `WET_ROAD`, `WET_PAVING`): lower roughness picks up the environment like the poster's rain-slick stone.

### Second pass (2026-10-21)
- Horloge dome: flat-shaded `DOME_SLATE`, so the four-segment dome reads faceted and square instead of round.
- Puddles: eight irregular `PUDDLE` (`waterMat(0x8fb7cf)`, same material as the Louvre pools, no extra draw) patches on the Champ de Mars and the Cour Napoléon, clear of the tower legs. They show in clear weather too.
- Sacré-Cœur: paired side stairs (`STAIR`, x = ±1.05, with two rails each) around a central lawn, outer lawns beyond them, balustrade split to match.
- Night: Eiffel iron (amber), Notre-Dame stone, Arc de Triomphe stone/bands/ribs, Sacré-Cœur marble and the Louvre walls use `floodMat` (plain by day, warm flood glow at night). The tower lost its slight metalness on the iron.

### People pass (2026-10-21)
- Kit `person()` rebuilt (all cities): two trouser legs, flared coat with arms, head with a hair cap; the umbrella is a domed `lathe` canopy (r 0.085, about 1.4 shoulder widths, was a 0.11 cone) held over the right shoulder and tipped forward. Height 0.23.
- Paris figures stand at y 0.04 (paving top), in `COATS` (charcoal, trench, navy, burgundy, camel, cream, olive) with random facing. Crowds use rejection sampling: clear of the four tower leg footprints and of the pyramid and its three pools (the old scatter put people inside both).
- Nine walkers on `anim.follow` closed loops (each `mergeStatic` first, ~5 draws): four round the Champ de Mars, two passing under the tower arch, three along the Cour Napoléon's south side.

## Left open
- The Horloge dome is faceted by flat shading rather than four curved faces; a `profile`-built dome would be smoother but was not needed.
- Puddles are static (they do not react to the rain level).
- Rodin is not needed for Paris: all its landmarks are architecture.

## Next
- None pending for Paris; remaining polish is optional (curved Horloge faces, rain-driven puddles).
