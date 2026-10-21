import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    // three.js alone is ~700 kB minified; app chunks stay far below this.
    chunkSizeWarningLimit: 800,
    rolldownOptions: {
      output: {
        // three.js changes far less often than app code, so it gets its own
        // long-cached chunk: a deploy that only touches the app keeps it.
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The persistent transform cache does not see files added to an
    // `import.meta.glob` directory, so new cities would be skipped by tests.
    fsModuleCache: false,
  },
});
