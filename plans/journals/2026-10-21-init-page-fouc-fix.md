# 2026-10-21 — Initial page flash (unstyled brand SVG) fixed

**Symptom.** On a cold load at `localhost:5173`, before the diorama appeared, the page showed a full-viewport black and blue diamond.

**Root cause.** `src/style.css` was imported only from `src/main.ts`. In Vite dev, CSS imported from JS is injected as a `<style>` tag after the module graph loads, and three.js makes that graph large. Until then the raw HTML painted unstyled. The `.brand` logo `<svg viewBox>` has no intrinsic size, so it stretched to the viewport width. Its fills fell back to the link colour (`currentColor`, blue) and to black (the undefined `var(--bg-top)`).

**Fix.** Moved the stylesheet to a render-blocking `<link rel="stylesheet" href="/src/style.css">` in `index.html` `<head>` and removed `import './style.css'` from `src/main.ts`. Vite still bundles and hashes it, including the Montserrat `@import`.

**Verification.**
- With JS disabled, the page renders styled: the logo is 30×30 and the gradient background shows.
- `bun run build` emits `<link rel="stylesheet" href="./assets/index-*.css">`.
- 96/96 tests pass.
