# City improvements

Audit of every city against its poster (`assets/<slug>.jpeg`, where one exists) or the real landmarks, made on 2026-10-21. Each city was opened in the dev server by day and by night, zoomed in on the landmarks, and checked against its source file. Line numbers refer to the code at that date and will drift as files change; the function names stay valid. Items marked `[unverified]` come from coordinates in the code, not from a screenshot.

Budgets are measured after `mergeStatic`. The limits are 90,000 triangles and 220 draw calls per city (`tests/cities.test.ts`).

## Priorities

Each city has its own file: status (budget, what the 2026-10-21 passes changed and left open, next steps), then the original audit findings. Two passes ran on 2026-10-21: the first fixed layout bugs, the second added the missing landmarks and night lighting (`floodMat`, `windowMaterial`, `lampMaterial`).

| City | Budget now (tris / draws) | Second pass 2026-10-21 | Next |
|---|---|---|---|
| [Paris](paris.md) | 52,242 / 109 | Faceted Horloge dome, puddles, Sacré-Cœur paired stairs, landmarks floodlit | Four curved dome faces (optional); rain-driven puddles |
| [New York](new-york.md) | 47,600 / 176 | Empire State wings, piers and lit lantern; Chrysler tower; One WTC lit; torch and bridge lamps; wider inlet | Flatiron wedge, Times Square billboards, bridge stays |
| [Sydney](sydney.md) | 64,203 / 184 | Luna Park, Fort Denison, ferry wharf, North Shore blocks, Walsh Bay roofs, 3 new CBD crowns, beacon night-only | Denser Rocks, longer liner |
| [Rome](rome.md) | 50,276 / 99 | Trevi niches and attic; St Peter's oval colonnade and statue balustrade; landmarks floodlit; bridge corner | Colosseum brick, Pantheon drum, bridge statues |
| [Kuala Lumpur](kuala-lumpur.md) | 53,896 / 139 | Masjid Jamek, Suria KLCC podium, lit windows, KL Tower bands, statue at the cave foot, stairs to a lit cave | Batu cliff and Murugan via Rodin (manifest ready); boats vs arch bridges; Masjid Negara |
| [Tokyo](tokyo.md) | 38,160 / 167 | Lathe Fuji with crater and snow, Senso-ji rebuilt, Shibuya people off the lanes, walkers, lit towers and lanterns | Raise the road bridge; Shibuya 109, glass towers |
| [London](london.md) | 39,968 / 175 | Gherkin, fatter lit Eye, St Paul's ×1.3 and unhidden, quieter Shard bands, boats and Westminster piers | Westminster arches, Tower Bridge span |
| [Dubai](dubai.md) | 21,010 / 114 | Lit Burj Khalifa (18 twisting levels), Burj Al Arab sail, Frame, twist tower; Emirates Towers; Metro and train; larger camels | Fountains, yachts, Palm arc, Dubai Mall |
| [Cairo](cairo.md) | 38,316 / 107 | Giza rock plateau, paved plazas and streets, Qasr el-Nil bridge, lamps, mashrabiya houses, Sphinx pit, citadel battlements, bigger lotus | Mosque via Rodin (image saved, needs GLB); caravan; felucca tints |
| [Rio de Janeiro](rio-de-janeiro.md) | 30,428 / 152 | Night lighting (Christ, favela, stadium, cable car, beach) | Corcovado via Rodin (needs image); Christ pedestal |
| [San Francisco](san-francisco.md) | 30,126 / 165 | Cars in platoons (198 → 165 draws); lit Golden Gate; Ferry Building and piers; Alcatraz ×1.4; terraced Telegraph Hill; Salesforce taller than Transamerica | Painted Ladies variety, Sutro Tower, fog |
| [Hanoi](hanoi.md) | 86,302 / 169 | Reworked from `assets/hanoi.png` and checked region by region; layout read through a homography: larger lake, Long Bien corner to corner, Flag Tower and Mausoleum as a balanced pair along the front edge, Mausoleum facing a courtyard with the flagpole on its axis; motorbikes re-baked at 1,500 tris and painted as the asset; Hoan Kiem detail pass (Turtle Tower, island, Huc bridge, curb and hedge, night lighting); correct Vietnamese flags; no swan boats | Triangle headroom is now ~3.7k |
| [Ho Chi Minh City](ho-chi-minh.md) | 86,616 / 159 | Built from `assets/ho-chi-minh.png` through a homography and a rectified ground plan: Saigon River inside a stone curb with the real Ba Son arch pylon and lit stays, Landmark 81, Bitexco with its helipad and terraced podium, Independence Palace, Notre-Dame, Opera House, Post Office, Ben Thanh with today's square in front of its south gate (Tran Nguyen Han on horseback, the Quach Thi Trang bust) and a signalised crossroads at its corner, shophouses, stalls; scooter packs on `motorbike-lite` | Static traffic lights; packs overlap where paths share a lane; ~3.4k triangle headroom |

## Cross-cutting findings

1. **Layout clashes are the most common bug.** Roads, lanes and lamp rows run through buildings or piers, trees and houses stand in rivers, and props hang over the plinth. Cars on `anim.follow` lanes make the clashes obvious: they drive through towers in San Francisco, Dubai and New York, through the Tower Bridge piers in London and through lamp posts in Kuala Lumpur. Check new placements against lane coordinates.
2. **Bridges that did not cross their river.** Fixed 2026-10-21: Brooklyn Bridge spans an inlet, Kuala Lumpur's `archBridge()` is a shallow arch. Hanoi no longer has a river: its poster shows Long Bien as a viaduct along the edge. Still open: Tokyo's road bridge sits at water level (boats turn back) and boats still pass through the Kuala Lumpur arches.
3. **Coplanar flat slabs z-fight.** Two `patch`/`box` slabs that overlap with tops at the same height flicker, worst under rain lighting. Overlapping ground slabs must differ in height by at least 0.005. Fixed 2026-10-21 for every lead the audit found (Paris, Rome, Kuala Lumpur, Dubai, Tokyo station, Rio pitch lines).
4. **Landmarks went dark at night.** Fixed 2026-10-21 in every city: glazing uses `windowMaterial`, beacons and deck lamps `lampMaterial`, and stone or metal landmarks `floodMat` (plain by day, floodlit at night). Still unlit: the Cairo Tower shaft and the pyramids.
5. **Follow-up work from the Rodin placements:** done 2026-10-21 (Rio bay and cable car, Hanoi rider colours, Dubai camel caravan, Trevi colours).
6. **Draw calls, not triangles, were the tighter limit** for San Francisco (198/220) and Hanoi (201/220). San Francisco went from 198 to 165 by welding cars into platoons (`convoy()` in `san-francisco.ts`). The Hanoi rework fell to 158.

## Rodin candidates

Most cities need none. Rodin is only worth it for organic forms that would be at least ~120px on screen ([rodin-pipeline.md](../rodin-pipeline.md)).

| City | Candidate | Why |
|---|---|---|
| Rio de Janeiro | Corcovado massif (manifest `corcovado`, needs the Gemini image) | About 350px on screen. The lathe cone with box buttresses clashes with the baked Sugarloaf next to it. |
| Kuala Lumpur | Batu Caves cliff, Murugan statue (manifest `batu-cliff`, `murugan-statue`, need images) | The cliff is about 250px and the largest gap against both posters. The statue is borderline (~110px). |
| Cairo | Muhammad Ali Mosque body and domes (manifest `muhammad-ali-mosque`, image saved, needs the Rodin GLB) | The dome cascade reads as grey bubbles procedurally; minarets and citadel stay procedural. |
| Tokyo | None: the procedural `lathe` Fuji (second pass) reads well. | |
| San Francisco | None: Telegraph Hill rebuilt procedurally in terraces. | |
| Hanoi | Done 2026-10-21: re-baked at 1,500 tris (4 parts) | Painted as the asset: charcoal rider and tyres, straw hat; `BIKE_COLORS` tints only the scooter body. |
| Ho Chi Minh City | Done 2026-10-21: `motorbike-lite`, the Hanoi scooter baked at 700 tris (manifest `from`) | Twice the riders for the same budget. The statues (palm plaza, roundabout, Our Lady of Peace) stay under ~60px and procedural. |
