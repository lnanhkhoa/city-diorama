---
title: Cities Diorama bootstrap and 3D asset upgrade
date: 2026-10-20
summary: "Vite+Three.js diorama app for 12 cities; kit, lighting and hero landmarks upgraded via 3dviz-pro-max"
---

# Cities Diorama bootstrap and 3D asset upgrade

## What happened
- Bootstrapped a Vite 8 + Three.js 0.186 + TS app (bun) rendering procedural isometric city dioramas with Open-Meteo live weather, poster export and hash routing. 12 cities, one module each, built in parallel by subagents against a shared kit.
- Upgraded 3D assets per 3dviz-pro-max: kit buildings gained base course, sill courses, cornice, door, parapet + rooftop plant / chimneys; towers gained lobby, setback ledges, crown; clustered trees, wheeled vehicles, bevelled display plinth. Key light defined by azimuth/elevation from camera-left plus rim; GTAO via EffectComposer with MSAA target. Hero landmarks rebuilt per city (Opera House shells, Burj Khalifa setbacks, Christ the Redeemer, Sphinx, Eiffel lattice, Notre-Dame, Petronas star plan, Skytree, Westminster).

## Root causes found
- mergeStatic: merged meshes with matrixAutoUpdate=false never got matrixWorldNeedsUpdate -> identity world matrix until a parent forced it. Fixed by flagging dirty.
- Vitest 5 fsModuleCache served a stale import.meta.glob result, silently testing 1 of 12 cities. Disabled fsModuleCache in vite.config.ts.
- Animator.follow used JS % with negative offsets -> objects before path start; with reduced motion nothing was ever placed (all movers stacked at origin). Fixed wrap, and Stage.show calls update(0,0) once.
- Stale headless captures came from the frozen background tab, not slow frames; bringToFront before capture.

## Decisions
- Kept procedural Three.js over Blender->GLB (Blender 5.2.1 available) to keep one construction convention and synchronous builds.
- Kept Promise.withResolvers (Baseline widely available by 2026-09).
- Landscape layout moves weather into one row so tall heroes are not hidden behind the temperature.

## Next steps
- Draw calls peak at ~300 (Hanoi motorbikes, NY); instancing movers would help low-end mobile.
- Not deployed; no live target in the brief.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
