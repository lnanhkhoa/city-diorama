# Suspense-based city loading (2026-10-21)

**Change.** `App.tsx` dropped its hand-written loader: the async `show()`, the `navigation` counter, `currentRef`, and the `stageCity`/`loading` state. In their place:

- `route` (state) drives the header and URL. `staged = useDeferredValue(route, null)` drives the stage.
- `StagedDiorama` calls `use(registry.cityBuild(slug))`. When a deferred render suspends, React keeps the previous city on stage, and `loading = staged !== route` drives the loader. A newer navigation replaces the pending deferred render, so slow loads can no longer overwrite a newer choice.
- `cityBuild` returns one stable promise per city that resolves to null on failure. A failure therefore never reaches an error boundary, which would unmount the canvas. `StagedDiorama` reports the result (`onSettled`), and App then shows the toast and puts the header and URL back on the city still on stage.
- `Route` carries its registry. Without it, a dev HMR registry swap would make the urgent render ask a fresh registry for the city on stage, and that render would suspend and show the fallback.
- `Diorama` takes `build`/`mode` instead of a request object. It skips a swap when the build function is unchanged, which happens when a failed load falls back to the city already on stage.
- `loadedCity` was removed. `loadCity` now returns the same promise per city.

**Trade-off.** A failed `cityBuild` result is cached for the page's lifetime: re-rendering must not refetch, or React would loop. Chromium already caches failed module fetches the same way.

**Verification.** typecheck, build, and 110 tests, including a new `cityBuild` test for a stable promise that resolves null. In the browser, with chunk delays and an aborted request injected:

- First load: loader shows, then done, then the canvas appears.
- Rome followed quickly by Tokyo: the stage goes straight to Tokyo.
- An aborted load of Cairo: the toast appears and the header and URL return to Tokyo.
- An HMR edit of Sydney does not reload the page.
- Arrow navigation and Save still work.
