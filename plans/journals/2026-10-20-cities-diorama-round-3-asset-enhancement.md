---
title: Cities Diorama round 3 asset enhancement
date: 2026-10-20
summary: "Ripple water, shopfronts, crosswalks, dev hot-swap; 12 cities enhanced; budgets enforced by test"
---

# Cities Diorama round 3 asset enhancement

## What happened
- Kit: `waterMat(color)` (onBeforeCompile ripple normals from world position; merges without UVs; time uniform advanced by the stage), `building({ shop })` lit shopfront + fascia + awning, `crosswalk()`, `mergeStatic` exported.
- Dev: city modules hot-swap in place via `import.meta.hot.accept('./cities')` and `Stage.show(scene, 'replace')`, keeping the camera. Fixes the close-up workflow that sibling saves used to reset with full reloads.
- 12 city agents enhanced heroes (One WTC chamfered facets, Opera House smooth shell vaults, Tokyo Tower lattice, Petronas banded glazing, Palm Jumeirah fronds, Sphinx face, Eiffel open first deck...) and filler/street level.
- Budgets now enforced in tests/cities.test.ts: <90k triangles, <=220 draw calls. Hanoi 298 -> 152 draws, NY 278 -> 178.

## Notes
- Someone refactored src/main.ts concurrently (CityPicker, fetchWeatherMany, NIGHT_THEME). Left untouched; a stray renderMenu HMR error during that window came from the in-progress refactor.

## Next steps
- Sydney Opera House is still a simplification; tall back towers still overlap the title on landscape.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
